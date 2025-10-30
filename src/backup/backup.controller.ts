import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiExcludeEndpoint } from '@nestjs/swagger';
import { DatabaseService } from '../database/database.service';

@ApiTags('Backup')
@Controller('api/v1/backup')
export class BackupController {
  constructor(
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
      mode: 'scheduler-only (no public API)',
    };
  }

  // ❌ ВСЕ ОСТАЛЬНЫЕ ENDPOINT'Ы УДАЛЕНЫ ДЛЯ БЕЗОПАСНОСТИ
  //
  // Причина: даже read-only endpoint'ы раскрывают чувствительную информацию:
  // - Список backup'ов (когда делаются, размеры)
  // - Структура БД
  // - Статистика
  //
  // Для мониторинга используйте:
  // 1. kubectl logs -n backend -l app=backup-service
  // 2. kubectl exec -it deployment/backup-service -- npm run status
  // 3. Prometheus metrics (если настроены)
  //
  // Для manual операций:
  // kubectl exec -it deployment/backup-service -- sh
}

