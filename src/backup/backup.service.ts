import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DatabaseService } from '../database/database.service';
import { S3Service } from '../s3/s3.service';
import { BackupType, BackupStatus } from '@prisma/client';
import * as path from 'path';

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(
    private prisma: PrismaService,
    private databaseService: DatabaseService,
    private s3Service: S3Service,
  ) {}

  /**
   * Создать новый бэкап
   */
  async createBackup(type: BackupType = BackupType.MANUAL): Promise<any> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const fileName = `backup-${timestamp}.sql.gz`;
    const s3Key = `${type.toLowerCase()}/${fileName}`;

    // Создать запись в БД
    const backupLog = await this.prisma.backupLog.create({
      data: {
        fileName,
        s3Key,
        s3Bucket: process.env.S3_BUCKET_NAME || 'devcrm-backups',
        type,
        status: BackupStatus.IN_PROGRESS,
      },
    });

    this.logger.log(`Starting backup ${backupLog.id} (${type})`);

    try {
      // 1. Создать бэкап через pg_dump
      const { filePath, size } = await this.databaseService.createBackup(fileName);

      // 2. Загрузить в S3
      await this.s3Service.uploadFile(filePath, s3Key);

      // 3. Удалить локальный файл
      await this.databaseService.deleteLocalBackup(filePath);

      // 4. Обновить статус
      await this.prisma.backupLog.update({
        where: { id: backupLog.id },
        data: {
          status: BackupStatus.COMPLETED,
          size: BigInt(size),
          completedAt: new Date(),
        },
      });

      this.logger.log(`Backup ${backupLog.id} completed successfully`);

      return this.getBackupById(backupLog.id);
    } catch (error) {
      // Обновить статус на FAILED
      await this.prisma.backupLog.update({
        where: { id: backupLog.id },
        data: {
          status: BackupStatus.FAILED,
          errorMessage: error.message,
          completedAt: new Date(),
        },
      });

      this.logger.error(`Backup ${backupLog.id} failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Получить все бэкапы с пагинацией
   */
  async getAllBackups(params: {
    skip?: number;
    take?: number;
    type?: BackupType;
    status?: BackupStatus;
  }) {
    const { skip = 0, take = 50, type, status } = params;

    const where = {
      ...(type && { type }),
      ...(status && { status }),
    };

    const [backups, total] = await Promise.all([
      this.prisma.backupLog.findMany({
        where,
        skip,
        take,
        orderBy: { startedAt: 'desc' },
      }),
      this.prisma.backupLog.count({ where }),
    ]);

    return {
      data: backups.map(this.formatBackup),
      total,
      page: Math.floor(skip / take) + 1,
      pageSize: take,
    };
  }

  /**
   * Получить бэкап по ID
   */
  async getBackupById(id: string) {
    const backup = await this.prisma.backupLog.findUnique({
      where: { id },
    });

    if (!backup) {
      throw new NotFoundException(`Backup ${id} not found`);
    }

    return this.formatBackup(backup);
  }

  /**
   * Восстановить из бэкапа
   */
  async restoreBackup(id: string): Promise<void> {
    const backup = await this.prisma.backupLog.findUnique({
      where: { id },
    });

    if (!backup) {
      throw new NotFoundException(`Backup ${id} not found`);
    }

    if (backup.status !== BackupStatus.COMPLETED) {
      throw new Error(`Cannot restore from backup with status: ${backup.status}`);
    }

    this.logger.log(`Restoring from backup ${id}`);

    try {
      // 1. Скачать из S3
      const localPath = path.join('/tmp/backups', `restore-${backup.fileName}`);
      await this.s3Service.downloadFile(backup.s3Key, localPath);

      // 2. Восстановить через pg_restore
      await this.databaseService.restoreBackup(localPath);

      // 3. Удалить локальный файл
      await this.databaseService.deleteLocalBackup(localPath);

      this.logger.log(`Restore from backup ${id} completed`);
    } catch (error) {
      this.logger.error(`Restore from backup ${id} failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Удалить бэкап
   */
  async deleteBackup(id: string): Promise<void> {
    const backup = await this.prisma.backupLog.findUnique({
      where: { id },
    });

    if (!backup) {
      throw new NotFoundException(`Backup ${id} not found`);
    }

    this.logger.log(`Deleting backup ${id}`);

    try {
      // Удалить из S3
      if (backup.status === BackupStatus.COMPLETED) {
        await this.s3Service.deleteFile(backup.s3Key);
      }

      // Обновить статус в БД
      await this.prisma.backupLog.update({
        where: { id },
        data: { status: BackupStatus.DELETED },
      });

      this.logger.log(`Backup ${id} deleted`);
    } catch (error) {
      this.logger.error(`Failed to delete backup ${id}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Получить настройки расписания
   */
  async getSchedules() {
    return this.prisma.backupSchedule.findMany({
      orderBy: { type: 'asc' },
    });
  }

  /**
   * Обновить настройки расписания
   */
  async updateSchedule(type: BackupType, data: {
    cronExpression?: string;
    enabled?: boolean;
    retentionDays?: number;
  }) {
    return this.prisma.backupSchedule.upsert({
      where: { type },
      update: {
        ...data,
        updatedAt: new Date(),
      },
      create: {
        type,
        cronExpression: data.cronExpression || '0 3 * * *',
        enabled: data.enabled ?? true,
        retentionDays: data.retentionDays || 30,
      },
    });
  }

  /**
   * Очистка старых бэкапов
   */
  async cleanupOldBackups(type: BackupType, retentionDays: number): Promise<number> {
    this.logger.log(`Cleaning up ${type} backups older than ${retentionDays} days`);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // Найти старые бэкапы
    const oldBackups = await this.prisma.backupLog.findMany({
      where: {
        type,
        status: BackupStatus.COMPLETED,
        startedAt: {
          lt: cutoffDate,
        },
      },
    });

    let deletedCount = 0;

    for (const backup of oldBackups) {
      try {
        await this.deleteBackup(backup.id);
        deletedCount++;
      } catch (error) {
        this.logger.error(`Failed to delete backup ${backup.id}: ${error.message}`);
      }
    }

    this.logger.log(`Cleaned up ${deletedCount} old ${type} backups`);
    return deletedCount;
  }

  /**
   * Получить статистику бэкапов
   */
  async getStatistics() {
    const [total, byType, byStatus, totalSize, latest] = await Promise.all([
      this.prisma.backupLog.count(),
      this.prisma.backupLog.groupBy({
        by: ['type'],
        _count: true,
      }),
      this.prisma.backupLog.groupBy({
        by: ['status'],
        _count: true,
      }),
      this.prisma.backupLog.aggregate({
        _sum: { size: true },
        where: { status: BackupStatus.COMPLETED },
      }),
      this.prisma.backupLog.findFirst({
        where: { status: BackupStatus.COMPLETED },
        orderBy: { completedAt: 'desc' },
      }),
    ]);

    return {
      total,
      byType: byType.reduce((acc, item) => {
        acc[item.type] = item._count;
        return acc;
      }, {}),
      byStatus: byStatus.reduce((acc, item) => {
        acc[item.status] = item._count;
        return acc;
      }, {}),
      totalSize: totalSize._sum.size ? Number(totalSize._sum.size) : 0,
      latestBackup: latest ? this.formatBackup(latest) : null,
    };
  }

  /**
   * Форматировать объект бэкапа для ответа
   */
  private formatBackup(backup: any) {
    return {
      ...backup,
      size: backup.size ? Number(backup.size) : null,
    };
  }
}

