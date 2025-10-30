import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );

  // Enable CORS
  app.enableCors({
    origin: [
      'https://callcentre.test-shem.ru',
      'https://dir.test-shem.ru',
      'https://master.test-shem.ru',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:3003',
    ],
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Swagger documentation (только в development)
  const swaggerEnabled = process.env.SWAGGER_ENABLED !== 'false' && process.env.NODE_ENV !== 'production';
  
  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('Backup Service API')
      .setDescription('PostgreSQL Backup & Restore Service with S3 Storage (READ-ONLY)')
      .setVersion('1.0')
      .addTag('Backup')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
    logger.log(`📚 Swagger docs available at http://localhost:${process.env.PORT || 5009}/api/docs`);
  }

  const port = process.env.PORT || 5009;
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 Backup Service is running on port ${port}`);
  logger.log(`🔒 Mode: scheduler-only (read-only API)`);
  logger.log(`📊 Health check: http://localhost:${port}/api/v1/backup/health`);
}

bootstrap();

