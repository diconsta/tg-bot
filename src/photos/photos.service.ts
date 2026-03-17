import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { StagePhotoEntity } from './entities/stage-photo.entity';

export interface TelegramPhotoData {
  fileId: string;
  fileUniqueId: string;
  fileName?: string;
  fileSize?: number;
  driveFileId?: string;
  driveUrl?: string;
  driveFolderPath?: string;
}

@Injectable()
export class PhotosService {
  private readonly logger = new Logger(PhotosService.name);
  private readonly minPhotos: number;
  private readonly maxPhotos: number;

  constructor(
    @InjectRepository(StagePhotoEntity)
    private photoRepository: Repository<StagePhotoEntity>,
    private configService: ConfigService,
  ) {
    this.minPhotos = this.configService.get<number>(
      'app.photos.minPhotosPerStage',
    );
    this.maxPhotos = this.configService.get<number>(
      'app.photos.maxPhotosPerStage',
    );
  }

  async addPhoto(
    objectId: string,
    stageId: string,
    photoData: TelegramPhotoData,
  ): Promise<StagePhotoEntity> {
    const currentCount = await this.countPhotosForStage(objectId, stageId);

    if (currentCount >= this.maxPhotos) {
      throw new BadRequestException(
        `Maximum of ${this.maxPhotos} photos per stage has been reached`,
      );
    }

    const photo = this.photoRepository.create({
      objectId,
      stageId,
      telegramFileId: photoData.fileId,
      telegramFileUniqueId: photoData.fileUniqueId,
      fileName: photoData.fileName,
      fileSize: photoData.fileSize,
      driveFileId: photoData.driveFileId,
      driveUrl: photoData.driveUrl,
      driveFolderPath: photoData.driveFolderPath,
    });

    const savedPhoto = await this.photoRepository.save(photo);
    this.logger.log(`Added photo to object ${objectId}, stage ${stageId}`);

    return savedPhoto;
  }

  async addMultiplePhotos(
    objectId: string,
    stageId: string,
    photosData: TelegramPhotoData[],
  ): Promise<StagePhotoEntity[]> {
    const currentCount = await this.countPhotosForStage(objectId, stageId);

    if (currentCount + photosData.length > this.maxPhotos) {
      throw new BadRequestException(
        `Adding ${photosData.length} photos would exceed the maximum of ${this.maxPhotos} photos per stage`,
      );
    }

    const savedPhotos: StagePhotoEntity[] = [];

    for (const photoData of photosData) {
      const photo = await this.addPhoto(objectId, stageId, photoData);
      savedPhotos.push(photo);
    }

    this.logger.log(
      `Added ${savedPhotos.length} photos to object ${objectId}, stage ${stageId}`,
    );

    return savedPhotos;
  }

  async countPhotosForStage(objectId: string, stageId: string): Promise<number> {
    return this.photoRepository.count({
      where: { objectId, stageId },
    });
  }

  async findByObjectAndStage(
    objectId: string,
    stageId: string,
  ): Promise<StagePhotoEntity[]> {
    return this.photoRepository.find({
      where: { objectId, stageId },
      order: { createdAt: 'ASC' },
    });
  }

  async validateMinimumPhotos(
    objectId: string,
    stageId: string,
  ): Promise<boolean> {
    const count = await this.countPhotosForStage(objectId, stageId);
    return count >= this.minPhotos;
  }

  getMinPhotosRequired(): number {
    return this.minPhotos;
  }

  getMaxPhotosAllowed(): number {
    return this.maxPhotos;
  }
}
