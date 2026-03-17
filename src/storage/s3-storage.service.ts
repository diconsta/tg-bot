import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

export interface S3UploadResult {
  s3Key: string;
  s3Url: string;
  bucket: string;
}

@Injectable()
export class S3StorageService {
  private readonly logger = new Logger(S3StorageService.name);
  private s3Client: S3Client;
  private bucketName: string;
  private baseFolder: string;

  constructor(private configService: ConfigService) {
    const region = this.configService.get<string>('app.aws.region');
    const accessKeyId = this.configService.get<string>('app.aws.accessKeyId');
    const secretAccessKey = this.configService.get<string>('app.aws.secretAccessKey');

    this.bucketName = this.configService.get<string>('app.aws.s3BucketName');
    this.baseFolder = this.configService.get<string>('app.aws.s3BaseFolder');

    if (!accessKeyId || !secretAccessKey) {
      this.logger.warn('AWS credentials not configured - S3 storage disabled');
      return;
    }

    this.s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    this.logger.log(`S3 storage initialized: bucket=${this.bucketName}, region=${region}`);
  }

  /**
   * Upload a photo to S3
   * @param buffer - Photo buffer
   * @param objectName - Object name (e.g., "Building A - Warsaw")
   * @param stageName - Stage name (e.g., "Stage 1 - Demontaż")
   * @param fileName - File name (e.g., "photo_123.jpg")
   * @returns S3 upload result with key and URL
   */
  async uploadPhoto(
    buffer: Buffer,
    objectName: string,
    stageName: string,
    fileName: string,
  ): Promise<S3UploadResult> {
    if (!this.s3Client) {
      throw new Error('S3 client not initialized - check AWS credentials');
    }

    // Sanitize folder names (remove special characters that might cause issues)
    const sanitizedObjectName = this.sanitizeFolderName(objectName);
    const sanitizedStageName = this.sanitizeFolderName(stageName);

    // Build S3 key: objects/Building A - Warsaw/Stage 1 - Demontaż/photo_123.jpg
    const s3Key = `${this.baseFolder}/${sanitizedObjectName}/${sanitizedStageName}/${fileName}`;

    this.logger.log(`Uploading photo to S3: ${s3Key}`);

    try {
      const upload = new Upload({
        client: this.s3Client,
        params: {
          Bucket: this.bucketName,
          Key: s3Key,
          Body: buffer,
          ContentType: 'image/jpeg',
        },
      });

      await upload.done();

      const s3Url = `https://${this.bucketName}.s3.amazonaws.com/${s3Key}`;

      this.logger.log(`Photo uploaded successfully: ${s3Key}`);

      return {
        s3Key,
        s3Url,
        bucket: this.bucketName,
      };
    } catch (error) {
      this.logger.error(`Failed to upload photo to S3: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Sanitize folder names to be S3-safe
   * Removes or replaces characters that might cause issues
   */
  private sanitizeFolderName(name: string): string {
    // Replace problematic characters with safe alternatives
    return name
      .replace(/\//g, '-') // Replace forward slashes
      .replace(/\\/g, '-') // Replace backslashes
      .replace(/[<>:"|?*]/g, '') // Remove invalid characters
      .trim();
  }

  /**
   * Check if S3 is enabled and configured
   */
  isEnabled(): boolean {
    return !!this.s3Client;
  }
}
