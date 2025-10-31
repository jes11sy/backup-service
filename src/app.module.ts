import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { BackupModule } from './backup/backup.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    PrometheusModule.register({
      defaultMetrics: { enabled: true },
      path: '/metrics',
    }),
    BackupModule,
  ],
})
export class AppModule {}

