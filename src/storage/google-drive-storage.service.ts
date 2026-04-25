import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { drive_v3 } from 'googleapis';
import { Readable } from 'stream';

export interface DriveUploadResult {
  driveFileId: string;
  driveUrl: string;
  driveFolderPath: string;
}

@Injectable()
export class GoogleDriveStorageService {
  private readonly logger = new Logger(GoogleDriveStorageService.name);
  private driveClient: drive_v3.Drive | null = null;
  private sharedDriveId: string;

  constructor(private configService: ConfigService) {
    this.sharedDriveId = this.configService.get<string>('app.googleDrive.sharedDriveId');
    this.initializeDrive();
  }

  private initializeDrive() {
    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    const serviceAccountPath = this.configService.get<string>('app.googleDrive.serviceAccountPath');

    if (!this.sharedDriveId) {
      this.logger.warn('Google Drive not configured - GOOGLE_SHARED_DRIVE_ID missing');
      return;
    }

    try {
      let credentials: object | undefined;

      if (serviceAccountJson) {
        credentials = JSON.parse(serviceAccountJson);

        if (credentials.private_key) {
          // 🔥 КРИТИЧНО
          credentials.private_key = credentials.private_key
            .replace(/\\n/g, '\n')
            .replace(/\r/g, '');
        }
      }

      const authOptions = credentials
        ? { credentials, scopes: ['https://www.googleapis.com/auth/drive'] }
        : serviceAccountPath
          ? { keyFile: serviceAccountPath, scopes: ['https://www.googleapis.com/auth/drive'] }
          : null;

      if (!authOptions) {
        this.logger.warn('Google Drive not configured - set GOOGLE_SERVICE_ACCOUNT_JSON env var');
        return;
      }

      const auth = new google.auth.GoogleAuth(authOptions);
      this.driveClient = google.drive({ version: 'v3', auth });
      this.logger.log(`Google Drive initialized with Shared Drive: ${this.sharedDriveId}`);
    } catch (error) {
      this.logger.error(`Failed to initialize Google Drive: ${error.message}`);
    }
  }

  async uploadPhoto(
    buffer: Buffer,
    objectName: string,
    stageName: string,
    fileName: string,
  ): Promise<DriveUploadResult> {
    if (!this.driveClient) {
      throw new Error('Google Drive client not initialized');
    }

    // Get or create folder structure (no in-memory cache — serverless safe)
    const objectFolderId = await this.getOrCreateFolder(objectName, this.sharedDriveId);
    const stageFolderId = await this.getOrCreateFolder(stageName, objectFolderId);

    const bufferStream = new Readable();
    bufferStream.push(buffer);
    bufferStream.push(null);

    const response = await this.driveClient.files.create({
      requestBody: {
        name: fileName,
        parents: [stageFolderId],
      },
      media: {
        mimeType: 'image/jpeg',
        body: bufferStream,
      },
      fields: 'id, webViewLink',
      supportsAllDrives: true,
    });

    this.logger.log(`Photo uploaded to Shared Drive: ${fileName} (${response.data.id})`);

    return {
      driveFileId: response.data.id,
      driveUrl: response.data.webViewLink,
      driveFolderPath: `${objectName}/${stageName}`,
    };
  }

  private async getOrCreateFolder(folderName: string, parentId: string): Promise<string> {
    const response = await this.driveClient.files.list({
      q: `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id)',
      spaces: 'drive',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      corpora: 'drive',
      driveId: this.sharedDriveId,
    });

    if (response.data.files?.length > 0) {
      return response.data.files[0].id;
    }

    const folderResponse = await this.driveClient.files.create({
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      },
      fields: 'id',
      supportsAllDrives: true,
    });

    this.logger.log(`Created Drive folder: ${folderName} (${folderResponse.data.id})`);
    return folderResponse.data.id;
  }

  isEnabled(): boolean {
    return !!this.driveClient;
  }
}
