import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StagesService } from './stages.service';
import { MasterStageEntity } from './entities/master-stage.entity';
import { ObjectStageEntity } from './entities/object-stage.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([MasterStageEntity, ObjectStageEntity]),
  ],
  providers: [StagesService],
  exports: [StagesService],
})
export class StagesModule {}
