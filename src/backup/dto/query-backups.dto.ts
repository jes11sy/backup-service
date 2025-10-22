import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BackupType, BackupStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class QueryBackupsDto {
  @ApiProperty({
    description: 'Page number (0-indexed)',
    required: false,
    default: 0,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  skip?: number = 0;

  @ApiProperty({
    description: 'Number of items per page',
    required: false,
    default: 50,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  take?: number = 50;

  @ApiProperty({
    description: 'Filter by backup type',
    enum: BackupType,
    required: false,
  })
  @IsEnum(BackupType)
  @IsOptional()
  type?: BackupType;

  @ApiProperty({
    description: 'Filter by backup status',
    enum: BackupStatus,
    required: false,
  })
  @IsEnum(BackupStatus)
  @IsOptional()
  status?: BackupStatus;
}

