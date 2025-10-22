import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';

const execAsync = promisify(exec);

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly backupDir = '/tmp/backups';

  constructor(private configService: ConfigService) {
    this.ensureBackupDir();
  }

  /**
   * Создать директорию для временных бэкапов
   */
  private async ensureBackupDir() {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
      this.logger.log(`Backup directory ensured: ${this.backupDir}`);
    } catch (error) {
      this.logger.error(`Failed to create backup directory: ${error.message}`);
    }
  }

  /**
   * Создать бэкап базы данных через pg_dump
   */
  async createBackup(fileName: string): Promise<{ filePath: string; size: number }> {
    const filePath = path.join(this.backupDir, fileName);
    const databaseUrl = this.configService.get<string>('DATABASE_URL');

    if (!databaseUrl) {
      throw new Error('DATABASE_URL not configured');
    }

    this.logger.log(`Starting backup to ${filePath}`);

    try {
      // pg_dump с компрессией
      const command = `pg_dump "${databaseUrl}" | gzip > "${filePath}"`;
      
      await execAsync(command, {
        maxBuffer: 1024 * 1024 * 100, // 100MB buffer
        timeout: 30 * 60 * 1000, // 30 минут timeout
      });

      // Получить размер файла
      const stats = await fs.stat(filePath);
      
      this.logger.log(`Backup completed: ${filePath} (${this.formatBytes(stats.size)})`);

      return {
        filePath,
        size: stats.size,
      };
    } catch (error) {
      this.logger.error(`Backup failed: ${error.message}`);
      // Удалить частично созданный файл
      try {
        await fs.unlink(filePath);
      } catch {}
      throw new Error(`Database backup failed: ${error.message}`);
    }
  }

  /**
   * Восстановить базу данных из файла
   */
  async restoreBackup(filePath: string): Promise<void> {
    const databaseUrl = this.configService.get<string>('DATABASE_URL');

    if (!databaseUrl) {
      throw new Error('DATABASE_URL not configured');
    }

    this.logger.log(`Starting restore from ${filePath}`);

    try {
      // Проверить существование файла
      await fs.access(filePath);

      // pg_restore с распаковкой
      const command = `gunzip -c "${filePath}" | psql "${databaseUrl}"`;
      
      await execAsync(command, {
        maxBuffer: 1024 * 1024 * 100,
        timeout: 60 * 60 * 1000, // 60 минут для восстановления
      });

      this.logger.log(`Restore completed from ${filePath}`);
    } catch (error) {
      this.logger.error(`Restore failed: ${error.message}`);
      throw new Error(`Database restore failed: ${error.message}`);
    }
  }

  /**
   * Удалить временный файл бэкапа
   */
  async deleteLocalBackup(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
      this.logger.log(`Deleted local backup: ${filePath}`);
    } catch (error) {
      this.logger.warn(`Failed to delete local backup: ${error.message}`);
    }
  }

  /**
   * Проверить подключение к базе данных
   */
  async checkConnection(): Promise<boolean> {
    const databaseUrl = this.configService.get<string>('DATABASE_URL');

    if (!databaseUrl) {
      return false;
    }

    try {
      const command = `psql "${databaseUrl}" -c "SELECT 1"`;
      await execAsync(command, { timeout: 5000 });
      return true;
    } catch (error) {
      this.logger.error(`Database connection check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Получить информацию о базе данных
   */
  async getDatabaseInfo(): Promise<{
    version: string;
    size: string;
    tables: number;
  }> {
    const databaseUrl = this.configService.get<string>('DATABASE_URL');

    if (!databaseUrl) {
      throw new Error('DATABASE_URL not configured');
    }

    try {
      // Получить версию PostgreSQL
      const versionCmd = `psql "${databaseUrl}" -t -c "SELECT version()"`;
      const { stdout: version } = await execAsync(versionCmd);

      // Получить размер базы
      const sizeCmd = `psql "${databaseUrl}" -t -c "SELECT pg_size_pretty(pg_database_size(current_database()))"`;
      const { stdout: size } = await execAsync(sizeCmd);

      // Количество таблиц
      const tablesCmd = `psql "${databaseUrl}" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'"`;
      const { stdout: tables } = await execAsync(tablesCmd);

      return {
        version: version.trim(),
        size: size.trim(),
        tables: parseInt(tables.trim(), 10),
      };
    } catch (error) {
      this.logger.error(`Failed to get database info: ${error.message}`);
      throw new Error(`Failed to get database info: ${error.message}`);
    }
  }

  /**
   * Форматировать байты в читаемый формат
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
}

