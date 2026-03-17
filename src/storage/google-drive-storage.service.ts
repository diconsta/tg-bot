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
  private folderCache: Map<string, string> = new Map();

  constructor(private configService: ConfigService) {
    this.sharedDriveId = this.configService.get<string>('app.googleDrive.sharedDriveId');
    this.initializeDrive();
  }

  private initializeDrive() {
    const serviceAccountPath = this.configService.get<string>('app.googleDrive.serviceAccountPath');

    if (!serviceAccountPath || !this.sharedDriveId) {
      this.logger.warn('Google Drive not configured - storage disabled');
      this.logger.warn('Set GOOGLE_SERVICE_ACCOUNT_PATH and GOOGLE_SHARED_DRIVE_ID in .env');
      return;
    }

    try {
      const auth = new google.auth.GoogleAuth({
        keyFile: serviceAccountPath,
        scopes: ['https://www.googleapis.com/auth/drive.file'],
      });

      this.driveClient = google.drive({ version: 'v3', auth });
      this.logger.log(`Google Drive initialized with Shared Drive: ${this.sharedDriveId}`);
    } catch (error) {
      this.logger.error(`Failed to initialize Google Drive: ${error.message}`);
    }
  }

  /**
   * Upload a photo to Google Shared Drive
   * Creates folder structure: Object Name / Stage Name / photo.jpg
   */
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
      // Get or create object folder
      const objectFolderId = await this.getOrCreateFolder(objectName, this.sharedDriveId);

      // Get or create stage folder inside object folder
      const stageFolderId = await this.getOrCreateFolder(stageName, objectFolderId);

      // Create readable stream from buffer
      const bufferStream = new Readable();
      bufferStream.push(buffer);
      bufferStream.push(null);

      // Upload file to stage folder
      const fileMetadata: drive_v3.Schema$File = {
        name: fileName,
        parents: [stageFolderId],
      };

      const media = {
        mimeType: 'image/jpeg',
        body: bufferStream,
      };

      const response = await this.driveClient.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, webViewLink',
        supportsAllDrives: true, // Required for Shared Drives
      });

      const fileId = response.data.id;
      const webViewLink = response.data.webViewLink;

      this.logger.log(`Photo uploaded to Shared Drive: ${fileName} (${fileId})`);

      return {
        driveFileId: fileId,
        driveUrl: webViewLink,
        driveFolderPath: `${objectName}/${stageName}`,
      };
    } catch (error) {
      this.logger.error(`Failed to upload to Google Drive: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get or create a folder in Shared Drive
   */
  private async getOrCreateFolder(folderName: string, parentId: string): Promise<string> {
    const cacheKey = `${parentId}:${folderName}`;

    // Check cache first
    if (this.folderCache.has(cacheKey)) {
      return this.folderCache.get(cacheKey);
    }

    try {
      // Search for existing folder
      const response = await this.driveClient.files.list({
        q: `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        corpora: 'drive',
        driveId: this.sharedDriveId,
      });

      if (response.data.files && response.data.files.length > 0) {
        // Folder exists
        const folderId = response.data.files[0].id;
        this.folderCache.set(cacheKey, folderId);
        this.logger.debug(`Found existing folder: ${folderName} (${folderId})`);
        return folderId;
      }

      // Create new folder
      const folderMetadata: drive_v3.Schema$File = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      };

      const folderResponse = await this.driveClient.files.create({
        requestBody: folderMetadata,
        fields: 'id',
        supportsAllDrives: true,
      });

      const folderId = folderResponse.data.id;
      this.folderCache.set(cacheKey, folderId);
      this.logger.log(`Created folder: ${folderName} (${folderId})`);

      return folderId;
    } catch (error) {
      this.logger.error(`Error managing folder ${folderName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if Google Drive is enabled and configured
   */
  isEnabled(): boolean {
    return !!this.driveClient;
  }
}
