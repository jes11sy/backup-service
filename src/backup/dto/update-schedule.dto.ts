import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BackupType } from '@prisma/client';

export class UpdateScheduleDto {
  @ApiProperty({
    description: 'Backup type',
    enum: BackupType,
  })
  @IsEnum(BackupType)
  type: BackupType;

  @ApiProperty({
    description: 'Cron expression (e.g., "0 3 * * *")',
    required: false,
  })
  @IsString()
  @IsOptional()
  cronExpression?: string;

  @ApiProperty({
    description: 'Enable or disable scheduled backups',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @ApiProperty({
    description: 'Number of days to retain backups',
    required: false,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  retentionDays?: number;
}

