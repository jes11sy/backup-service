import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { BackupService } from './backup.service';
import { BackupType } from '@prisma/client';
import { CronJob } from 'cron';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BackupScheduler implements OnModuleInit {
  private readonly logger = new Logger(BackupScheduler.name);

  constructor(
    private backupService: BackupService,
    private prisma: PrismaService,
    private schedulerRegistry: SchedulerRegistry,
  ) {}

  async onModuleInit() {
    // Инициализировать расписания из БД
    await this.initializeSchedules();
  }

  /**
   * Инициализировать расписания из БД
   */
  private async initializeSchedules() {
    this.logger.log('Initializing backup schedules from database...');

    try {
      const schedules = await this.backupService.getSchedules();

      for (const schedule of schedules) {
        if (schedule.enabled) {
          this.addCronJob(schedule.type, schedule.cronExpression);
        }
      }

      // Создать дефолтные расписания если их нет
      if (schedules.length === 0) {
        await this.createDefaultSchedules();
      }
    } catch (error) {
      this.logger.error(`Failed to initialize schedules: ${error.message}`);
    }
  }

  /**
   * Создать дефолтные расписания
   */
  private async createDefaultSchedules() {
    const defaultSchedules = [
      {
        type: BackupType.DAILY,
        cronExpression: '0 3 * * *', // Каждый день в 3:00 AM
        retentionDays: 7,
      },
      {
        type: BackupType.WEEKLY,
        cronExpression: '0 2 * * 0', // Каждое воскресенье в 2:00 AM
        retentionDays: 30,
      },
      {
        type: BackupType.MONTHLY,
        cronExpression: '0 1 1 * *', // 1-го числа каждого месяца в 1:00 AM
        retentionDays: 365,
      },
    ];

    for (const schedule of defaultSchedules) {
      await this.backupService.updateSchedule(schedule.type, schedule);
      this.addCronJob(schedule.type, schedule.cronExpression);
    }

    this.logger.log('Default schedules created');
  }

  /**
   * Добавить cron job
   */
  private addCronJob(type: BackupType, cronExpression: string) {
    const jobName = `backup-${type.toLowerCase()}`;

    try {
      // Удалить существующий job если есть
      if (this.schedulerRegistry.doesExist('cron', jobName)) {
        this.schedulerRegistry.deleteCronJob(jobName);
      }

      // Создать новый job
      const job = new CronJob(cronExpression, async () => {
        await this.executeBackup(type);
      });

      this.schedulerRegistry.addCronJob(jobName, job);
      job.start();

      this.logger.log(`Scheduled ${type} backup with cron: ${cronExpression}`);
    } catch (error) {
      this.logger.error(`Failed to schedule ${type} backup: ${error.message}`);
    }
  }

  /**
   * Выполнить бэкап по расписанию
   */
  private async executeBackup(type: BackupType) {
    this.logger.log(`Starting scheduled ${type} backup...`);

    try {
      // Создать бэкап
      const backup = await this.backupService.createBackup(type);
      this.logger.log(`Scheduled ${type} backup completed: ${backup.id}`);

      // Получить настройки retention
      const schedules = await this.backupService.getSchedules();
      const schedule = schedules.find(s => s.type === type);

      if (schedule && schedule.retentionDays > 0) {
        // Очистить старые бэкапы
        await this.backupService.cleanupOldBackups(type, schedule.retentionDays);
      }

      // Обновить lastRun и nextRun
      if (schedule) {
        const job = this.schedulerRegistry.getCronJob(`backup-${type.toLowerCase()}`);
        await this.prisma.backupSchedule.update({
          where: { type },
          data: {
            lastRun: new Date(),
            nextRun: job.nextDate().toJSDate(),
          },
        });
      }
    } catch (error) {
      this.logger.error(`Scheduled ${type} backup failed: ${error.message}`);
      // Можно добавить уведомления через email/telegram
    }
  }

  /**
   * Обновить расписание (вызывается из API)
   */
  async updateSchedule(type: BackupType, cronExpression: string, enabled: boolean) {
    const jobName = `backup-${type.toLowerCase()}`;

    if (enabled) {
      this.addCronJob(type, cronExpression);
    } else {
      if (this.schedulerRegistry.doesExist('cron', jobName)) {
        this.schedulerRegistry.deleteCronJob(jobName);
        this.logger.log(`Disabled ${type} backup schedule`);
      }
    }
  }

  /**
   * Manual trigger для тестирования (можно вызвать из API)
   */
  async triggerBackupNow(type: BackupType) {
    await this.executeBackup(type);
  }

  /**
   * Получить информацию о следующем запуске
   */
  getNextRunTime(type: BackupType): Date | null {
    const jobName = `backup-${type.toLowerCase()}`;
    
    try {
      if (this.schedulerRegistry.doesExist('cron', jobName)) {
        const job = this.schedulerRegistry.getCronJob(jobName);
        return job.nextDate().toJSDate();
      }
    } catch (error) {
      this.logger.error(`Failed to get next run time for ${type}: ${error.message}`);
    }

    return null;
  }
}

