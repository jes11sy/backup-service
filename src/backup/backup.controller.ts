import { Controller, Get, Post, Delete, Param, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BackupService } from './backup.service';
import { BackupScheduler } from './backup.scheduler';
import { CreateBackupDto } from './dto/create-backup.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { QueryBackupsDto } from './dto/query-backups.dto';
import { DatabaseService } from '../database/database.service';

@ApiTags('Backup')
@Controller('api/v1/backup')
export class BackupController {
  constructor(
    private readonly backupService: BackupService,
    private readonly backupScheduler: BackupScheduler,
    private readonly databaseService: DatabaseService,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Health check' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  async health() {
    const dbConnected = await this.databaseService.checkConnection();
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: dbConnected ? 'connected' : 'disconnected',
    };
  }

  @Post('create')
  @ApiOperation({ summary: 'Create a new backup' })
  @ApiResponse({ status: 201, description: 'Backup created successfully' })
  async createBackup(@Body() createBackupDto: CreateBackupDto) {
    return this.backupService.createBackup(createBackupDto.type);
  }

  @Get('list')
  @ApiOperation({ summary: 'Get all backups with pagination' })
  @ApiResponse({ status: 200, description: 'List of backups' })
  async getAllBackups(@Query() query: QueryBackupsDto) {
    return this.backupService.getAllBackups(query);
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get backup statistics' })
  @ApiResponse({ status: 200, description: 'Backup statistics' })
  async getStatistics() {
    return this.backupService.getStatistics();
  }

  @Get('database/info')
  @ApiOperation({ summary: 'Get database information' })
  @ApiResponse({ status: 200, description: 'Database information' })
  async getDatabaseInfo() {
    return this.databaseService.getDatabaseInfo();
  }

  @Get('schedule')
  @ApiOperation({ summary: 'Get all backup schedules' })
  @ApiResponse({ status: 200, description: 'List of schedules' })
  async getSchedules() {
    const schedules = await this.backupService.getSchedules();
    
    // Добавить информацию о следующем запуске
    return schedules.map(schedule => ({
      ...schedule,
      nextRun: this.backupScheduler.getNextRunTime(schedule.type),
    }));
  }

  @Post('schedule')
  @ApiOperation({ summary: 'Update backup schedule' })
  @ApiResponse({ status: 200, description: 'Schedule updated' })
  async updateSchedule(@Body() updateScheduleDto: UpdateScheduleDto) {
    const schedule = await this.backupService.updateSchedule(
      updateScheduleDto.type,
      updateScheduleDto,
    );

    // Обновить cron job
    if (updateScheduleDto.cronExpression !== undefined || updateScheduleDto.enabled !== undefined) {
      await this.backupScheduler.updateSchedule(
        updateScheduleDto.type,
        updateScheduleDto.cronExpression || schedule.cronExpression,
        updateScheduleDto.enabled ?? schedule.enabled,
      );
    }

    return schedule;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get backup by ID' })
  @ApiResponse({ status: 200, description: 'Backup details' })
  @ApiResponse({ status: 404, description: 'Backup not found' })
  async getBackupById(@Param('id') id: string) {
    return this.backupService.getBackupById(id);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore from backup' })
  @ApiResponse({ status: 200, description: 'Database restored successfully' })
  @ApiResponse({ status: 404, description: 'Backup not found' })
  async restoreBackup(@Param('id') id: string) {
    await this.backupService.restoreBackup(id);
    return {
      message: 'Database restored successfully',
      backupId: id,
      restoredAt: new Date().toISOString(),
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete backup' })
  @ApiResponse({ status: 204, description: 'Backup deleted successfully' })
  @ApiResponse({ status: 404, description: 'Backup not found' })
  async deleteBackup(@Param('id') id: string) {
    await this.backupService.deleteBackup(id);
  }
}

