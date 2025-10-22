import { Module } from '@nestjs/common';
import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';
import { BackupScheduler } from './backup.scheduler';
import { PrismaService } from '../prisma/prisma.service';
import { DatabaseService } from '../database/database.service';
import { S3Service } from '../s3/s3.service';

@Module({
  controllers: [BackupController],
  providers: [
    BackupService,
    BackupScheduler,
    PrismaService,
    DatabaseService,
    S3Service,
  ],
  exports: [BackupService],
})
export class BackupModule {}

