import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { drive_v3 } from 'googleapis';
import { Readable } from 'stream';
import { ServiceAccountCredentials } from './serviceAccountCredentials.model';

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
    this.sharedDriveId = this.configService.get<string>(
      'app.googleDrive.sharedDriveId',
    );
    this.initializeDrive();
  }

  private initializeDrive() {
    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    const serviceAccountPath = this.configService.get<string>(
      'app.googleDrive.serviceAccountPath',
    );

    if (!this.sharedDriveId) {
      this.logger.warn(
        'Google Drive not configured - GOOGLE_SHARED_DRIVE_ID missing',
      );
      return;
    }

    try {
      let credentials: ServiceAccountCredentials | undefined;

      if (serviceAccountJson) {
        credentials = JSON.parse<ServiceAccountCredentials>(serviceAccountJson);

        if (credentials.private_key) {
          // 🔥 КРИТИЧНО - Fix escaped newlines in private key
          const originalLength = credentials.private_key.length;
          credentials.private_key = credentials.private_key
            .replace(/\\n/g, '\n')
            .replace(/\r/g, '');

          this.logger.debug(
            `Private key processed: ${originalLength} -> ${credentials.private_key.length} chars`,
          );

          // Validate private key format
          if (!credentials.private_key.includes('-----BEGIN PRIVATE KEY-----')) {
            this.logger.error('Private key missing BEGIN marker');
          }
          if (!credentials.private_key.includes('-----END PRIVATE KEY-----')) {
            this.logger.error('Private key missing END marker');
          }
        }
      }

      const authOptions = credentials
        ? { credentials, scopes: ['https://www.googleapis.com/auth/drive'] }
        : serviceAccountPath
          ? {
              keyFile: serviceAccountPath,
              scopes: ['https://www.googleapis.com/auth/drive'],
            }
          : null;

      if (!authOptions) {
        this.logger.warn(
          'Google Drive not configured - set GOOGLE_SERVICE_ACCOUNT_JSON env var',
        );
        return;
      }

      const auth = new google.auth.GoogleAuth(authOptions);
      this.driveClient = google.drive({ version: 'v3', auth });
      this.logger.log(
        `Google Drive initialized with Shared Drive: ${this.sharedDriveId}`,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to initialize Google Drive: ${errorMessage}`);
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

    try {
      // Get or create folder structure (no in-memory cache — serverless safe)
      this.logger.debug(
        `Ensuring folder structure exists: ${objectName}/${stageName}`,
      );

      const objectFolderId = await this.getOrCreateFolder(
        objectName,
        this.sharedDriveId,
      );
      const stageFolderId = await this.getOrCreateFolder(
        stageName,
        objectFolderId,
      );

      this.logger.debug(`Uploading ${fileName} to folder ${stageFolderId}`);

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

      this.logger.log(
        `Photo uploaded to Shared Drive: ${fileName} (${response.data.id}) in ${objectName}/${stageName}`,
      );

      return {
        driveFileId: response.data.id,
        driveUrl: response.data.webViewLink,
        driveFolderPath: `${objectName}/${stageName}`,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to upload photo ${fileName} to ${objectName}/${stageName}: ${errorMessage}`,
      );
      throw new Error(
        `Failed to upload photo to Google Drive: ${errorMessage}`,
      );
    }
  }

  private async getOrCreateFolder(
    folderName: string,
    parentId: string,
  ): Promise<string> {
    try {
      // Search for existing folder
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
        this.logger.debug(
          `Found existing folder: ${folderName} (${response.data.files[0].id})`,
        );
        return response.data.files[0].id;
      }

      // Folder doesn't exist, create it
      this.logger.log(
        `Folder "${folderName}" not found in parent ${parentId}, creating...`,
      );

      const folderResponse = await this.driveClient.files.create({
        requestBody: {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentId],
        },
        fields: 'id',
        supportsAllDrives: true,
      });

      if (!folderResponse.data.id) {
        throw new Error(
          `Failed to create folder "${folderName}": No folder ID returned`,
        );
      }

      this.logger.log(
        `Successfully created folder: ${folderName} (${folderResponse.data.id})`,
      );
      return folderResponse.data.id;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Error in getOrCreateFolder for "${folderName}" in parent ${parentId}: ${errorMessage}`,
      );
      throw new Error(
        `Failed to get or create folder "${folderName}": ${errorMessage}`,
      );
    }
  }

  isEnabled(): boolean {
    return !!this.driveClient;
  }
}
