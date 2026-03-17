import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, drive_v3 } from 'googleapis';
import { Readable } from 'stream';

@Injectable()
export class GoogleDriveService {
  private readonly logger = new Logger(GoogleDriveService.name);
  private drive: drive_v3.Drive;
  private rootFolderId: string;
  private isSharedDrive: boolean;

  constructor(private configService: ConfigService) {
    this.initializeDrive();
  }

  private initializeDrive() {
    this.rootFolderId = this.configService.get<string>(
      'app.googleDrive.rootFolderId',
    );
    this.isSharedDrive = this.configService.get<boolean>(
      'app.googleDrive.isSharedDrive',
    ) || false;

    if (!this.rootFolderId) {
      this.logger.error('Google Drive root folder ID is not configured');
      throw new Error('GOOGLE_DRIVE_FOLDER_ID is required');
    }

    if (this.isSharedDrive) {
      this.logger.log('Using Shared Drive mode');
    } else {
      this.logger.log('Using regular folder mode (ensure folder is shared with service account)');
    }

    // Try to use service account JSON file first (more reliable)
    const serviceAccountPath = this.configService.get<string>(
      'app.googleDrive.serviceAccountPath',
    );

    let auth;

    if (serviceAccountPath) {
      // Use service account JSON file
      this.logger.log(`Using Google service account from: ${serviceAccountPath}`);
      auth = new google.auth.GoogleAuth({
        keyFile: serviceAccountPath,
        scopes: ['https://www.googleapis.com/auth/drive'],
      });
    } else {
      // Fallback to environment variables
      const clientEmail = this.configService.get<string>(
        'app.googleDrive.clientEmail',
      );
      const privateKey = this.configService.get<string>(
        'app.googleDrive.privateKey',
      );

      if (!clientEmail || !privateKey) {
        this.logger.error(
          'Google Drive credentials are not configured. Either provide GOOGLE_SERVICE_ACCOUNT_PATH or GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY',
        );
        throw new Error('Google Drive configuration is missing');
      }

      this.logger.log('Using Google credentials from environment variables');
      auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: clientEmail,
          private_key: privateKey,
        },
        scopes: ['https://www.googleapis.com/auth/drive'],
      });
    }

    this.drive = google.drive({ version: 'v3', auth });
    this.logger.log('Google Drive service initialized successfully');
  }

  async createFolderIfNotExists(
    folderName: string,
    parentFolderId?: string,
  ): Promise<string> {
    try {
      const parent = parentFolderId || this.rootFolderId;

      const query = `name='${folderName}' and '${parent}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;

      const listParams: any = {
        q: query,
        fields: 'files(id, name)',
        spaces: 'drive',
      };

      // Add supportsAllDrives for Shared Drives
      if (this.isSharedDrive) {
        listParams.supportsAllDrives = true;
        listParams.includeItemsFromAllDrives = true;
      }

      const existingFolders = await this.drive.files.list(listParams);

      if (existingFolders.data.files?.length > 0) {
        this.logger.log(
          `Folder "${folderName}" already exists with ID: ${existingFolders.data.files[0].id}`,
        );
        return existingFolders.data.files[0].id;
      }

      const folderMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parent],
      };

      const createParams: any = {
        requestBody: folderMetadata,
        fields: 'id',
      };

      // Add supportsAllDrives for Shared Drives
      if (this.isSharedDrive) {
        createParams.supportsAllDrives = true;
      }

      const folder = await this.drive.files.create(createParams);

      this.logger.log(`Created folder "${folderName}" with ID: ${folder.data.id}`);
      return folder.data.id;
    } catch (error) {
      this.logger.error(`Failed to create folder "${folderName}": ${error.message}`);
      throw error;
    }
  }

  async uploadPhoto(
    photoBuffer: Buffer,
    fileName: string,
    folderId: string,
  ): Promise<{ fileId: string; url: string }> {
    try {
      const stream = Readable.from(photoBuffer);

      const fileMetadata = {
        name: fileName,
        parents: [folderId],
      };

      const media = {
        mimeType: 'image/jpeg',
        body: stream,
      };

      const createParams: any = {
        requestBody: fileMetadata,
        media: media,
        fields: 'id, webViewLink',
      };

      // Add Shared Drive support
      if (this.isSharedDrive) {
        createParams.supportsAllDrives = true;
      }

      const file = await this.drive.files.create(createParams);

      const permissionParams: any = {
        fileId: file.data.id,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      };

      // Add Shared Drive support for permissions
      if (this.isSharedDrive) {
        permissionParams.supportsAllDrives = true;
      }

      await this.drive.permissions.create(permissionParams);

      const url = await this.generatePublicUrl(file.data.id);

      this.logger.log(`Uploaded photo "${fileName}" with ID: ${file.data.id}`);

      return {
        fileId: file.data.id,
        url,
      };
    } catch (error) {
      this.logger.error(`Failed to upload photo "${fileName}": ${error.message}`);
      throw error;
    }
  }

  async generatePublicUrl(fileId: string): Promise<string> {
    try {
      const getParams: any = {
        fileId: fileId,
        fields: 'webViewLink, webContentLink',
      };

      // Add Shared Drive support
      if (this.isSharedDrive) {
        getParams.supportsAllDrives = true;
      }

      const file = await this.drive.files.get(getParams);

      return (
        file.data.webContentLink ||
        file.data.webViewLink ||
        `https://drive.google.com/file/d/${fileId}/view`
      );
    } catch (error) {
      this.logger.error(`Failed to generate URL for file ${fileId}: ${error.message}`);
      return `https://drive.google.com/file/d/${fileId}/view`;
    }
  }

  async createObjectFolderStructure(
    objectName: string,
    stageNames: string[],
  ): Promise<{ objectFolderId: string; stageFolderIds: Map<number, string> }> {
    try {
      const sanitizedName = this.sanitizeFolderName(objectName);
      const objectFolderId = await this.createFolderIfNotExists(
        sanitizedName,
        this.rootFolderId,
      );

      const stageFolderIds = new Map<number, string>();

      for (let i = 0; i < stageNames.length; i++) {
        const stageNumber = i + 1;
        const stageFolderName = `Stage_${stageNumber}_${stageNames[i]}`;
        const stageFolderId = await this.createFolderIfNotExists(
          stageFolderName,
          objectFolderId,
        );
        stageFolderIds.set(stageNumber, stageFolderId);
      }

      this.logger.log(
        `Created folder structure for object "${objectName}" with ${stageNames.length} stages`,
      );

      return { objectFolderId, stageFolderIds };
    } catch (error) {
      this.logger.error(
        `Failed to create folder structure for object "${objectName}": ${error.message}`,
      );
      throw error;
    }
  }

  private sanitizeFolderName(name: string): string {
    return name.replace(/[<>:"/\\|?*]/g, '_').substring(0, 100);
  }

  async getStageFolderId(
    objectName: string,
    stageIndex: number,
    stageName?: string,
  ): Promise<string> {
    try {
      const sanitizedName = this.sanitizeFolderName(objectName);

      const objectFolderQuery = `name='${sanitizedName}' and '${this.rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;

      const objectListParams: any = {
        q: objectFolderQuery,
        fields: 'files(id)',
      };

      // Add Shared Drive support
      if (this.isSharedDrive) {
        objectListParams.supportsAllDrives = true;
        objectListParams.includeItemsFromAllDrives = true;
      }

      const objectFolders = await this.drive.files.list(objectListParams);

      if (!objectFolders.data.files?.length) {
        throw new Error(`Object folder not found for "${objectName}"`);
      }

      const objectFolderId = objectFolders.data.files[0].id;

      const stageFolderQuery = `name contains 'Stage_${stageIndex}' and '${objectFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;

      const stageListParams: any = {
        q: stageFolderQuery,
        fields: 'files(id)',
      };

      // Add Shared Drive support
      if (this.isSharedDrive) {
        stageListParams.supportsAllDrives = true;
        stageListParams.includeItemsFromAllDrives = true;
      }

      const stageFolders = await this.drive.files.list(stageListParams);

      if (!stageFolders.data.files?.length) {
        throw new Error(
          `Stage folder not found for stage ${stageIndex} in object "${objectName}"`,
        );
      }

      return stageFolders.data.files[0].id;
    } catch (error) {
      this.logger.error(
        `Failed to get stage folder ID for object "${objectName}", stage ${stageIndex}: ${error.message}`,
      );
      throw error;
    }
  }
}
