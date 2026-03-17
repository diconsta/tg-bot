import { Module } from '@nestjs/common';
import { GoogleDriveStorageService } from './google-drive-storage.service';

@Module({
  providers: [GoogleDriveStorageService],
  exports: [GoogleDriveStorageService],
})
export class StorageModule {}
