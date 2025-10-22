import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as fs from 'fs/promises';
import { createReadStream } from 'fs';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor(private configService: ConfigService) {
    const region = this.configService.get<string>('S3_REGION', 'us-east-1');
    const accessKeyId = this.configService.get<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('S3_SECRET_ACCESS_KEY');
    const endpoint = this.configService.get<string>('S3_ENDPOINT');
    this.bucketName = this.configService.get<string>('S3_BUCKET_NAME', 'devcrm-backups');

    if (!accessKeyId || !secretAccessKey) {
      this.logger.warn('S3 credentials not configured. Upload/download will fail.');
    }

    this.s3Client = new S3Client({
      region,
      credentials: accessKeyId && secretAccessKey ? {
        accessKeyId,
        secretAccessKey,
      } : undefined,
      endpoint,
      forcePathStyle: !!endpoint, // Для Minio
    });

    this.logger.log(`S3Service initialized with bucket: ${this.bucketName}`);
  }

  /**
   * Загрузить файл в S3
   */
  async uploadFile(localPath: string, s3Key: string): Promise<string> {
    this.logger.log(`Uploading ${localPath} to s3://${this.bucketName}/${s3Key}`);

    try {
      const fileContent = await fs.readFile(localPath);

      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: s3Key,
          Body: fileContent,
          ContentType: 'application/gzip',
          Metadata: {
            'uploaded-at': new Date().toISOString(),
          },
        }),
      );

      const url = `s3://${this.bucketName}/${s3Key}`;
      this.logger.log(`Upload completed: ${url}`);

      return url;
    } catch (error) {
      this.logger.error(`Upload failed: ${error.message}`);
      throw new Error(`S3 upload failed: ${error.message}`);
    }
  }

  /**
   * Скачать файл из S3
   */
  async downloadFile(s3Key: string, localPath: string): Promise<string> {
    this.logger.log(`Downloading s3://${this.bucketName}/${s3Key} to ${localPath}`);

    try {
      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: s3Key,
        }),
      );

      // Записать в файл
      const bodyContents = await response.Body.transformToByteArray();
      await fs.writeFile(localPath, bodyContents);

      this.logger.log(`Download completed: ${localPath}`);
      return localPath;
    } catch (error) {
      this.logger.error(`Download failed: ${error.message}`);
      throw new Error(`S3 download failed: ${error.message}`);
    }
  }

  /**
   * Удалить файл из S3
   */
  async deleteFile(s3Key: string): Promise<void> {
    this.logger.log(`Deleting s3://${this.bucketName}/${s3Key}`);

    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: s3Key,
        }),
      );

      this.logger.log(`File deleted from S3: ${s3Key}`);
    } catch (error) {
      this.logger.error(`Delete failed: ${error.message}`);
      throw new Error(`S3 delete failed: ${error.message}`);
    }
  }

  /**
   * Получить список всех файлов в S3
   */
  async listFiles(prefix?: string): Promise<Array<{ key: string; size: number; lastModified: Date }>> {
    this.logger.log(`Listing files in s3://${this.bucketName}/${prefix || ''}`);

    try {
      const response = await this.s3Client.send(
        new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: prefix,
        }),
      );

      const files = (response.Contents || []).map((item) => ({
        key: item.Key,
        size: item.Size,
        lastModified: item.LastModified,
      }));

      this.logger.log(`Found ${files.length} files in S3`);
      return files;
    } catch (error) {
      this.logger.error(`List failed: ${error.message}`);
      throw new Error(`S3 list failed: ${error.message}`);
    }
  }

  /**
   * Проверить существование файла в S3
   */
  async fileExists(s3Key: string): Promise<boolean> {
    try {
      await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: s3Key,
        }),
      );
      return true;
    } catch (error) {
      if (error.name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Получить размер файла в S3
   */
  async getFileSize(s3Key: string): Promise<number> {
    try {
      const response = await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: s3Key,
        }),
      );
      return response.ContentLength || 0;
    } catch (error) {
      this.logger.error(`Failed to get file size: ${error.message}`);
      return 0;
    }
  }

  /**
   * Получить presigned URL для скачивания
   */
  async getDownloadUrl(s3Key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      });

      const url = await getSignedUrl(this.s3Client, command, { expiresIn });
      return url;
    } catch (error) {
      this.logger.error(`Failed to generate download URL: ${error.message}`);
      throw new Error(`Failed to generate download URL: ${error.message}`);
    }
  }

  /**
   * Удалить все файлы старше определенной даты
   */
  async deleteOldFiles(prefix: string, olderThanDays: number): Promise<number> {
    this.logger.log(`Deleting files older than ${olderThanDays} days from ${prefix}`);

    try {
      const files = await this.listFiles(prefix);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      let deletedCount = 0;

      for (const file of files) {
        if (file.lastModified < cutoffDate) {
          await this.deleteFile(file.key);
          deletedCount++;
        }
      }

      this.logger.log(`Deleted ${deletedCount} old files from S3`);
      return deletedCount;
    } catch (error) {
      this.logger.error(`Failed to delete old files: ${error.message}`);
      throw new Error(`Failed to delete old files: ${error.message}`);
    }
  }
}

