import { IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BackupType } from '@prisma/client';

export class CreateBackupDto {
  @ApiProperty({
    description: 'Type of backup',
    enum: BackupType,
    default: BackupType.MANUAL,
  })
  @IsEnum(BackupType)
  @IsOptional()
  type?: BackupType = BackupType.MANUAL;
}

