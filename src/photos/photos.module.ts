import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PhotosService } from './photos.service';
import { StagePhotoEntity } from './entities/stage-photo.entity';

@Module({
  imports: [TypeOrmModule.forFeature([StagePhotoEntity])],
  providers: [PhotosService],
  exports: [PhotosService],
})
export class PhotosModule {}
