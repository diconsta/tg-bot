import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoordinatorsService } from './coordinators.service';
import { CoordinatorEntity } from './entities/coordinator.entity';
import { ObjectEntity } from '../objects/entities/object.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CoordinatorEntity, ObjectEntity])],
  providers: [CoordinatorsService],
  exports: [CoordinatorsService],
})
export class CoordinatorsModule {}
