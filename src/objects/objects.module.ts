import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ObjectsService } from './objects.service';
import { ObjectEntity } from './entities/object.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ObjectEntity])],
  providers: [ObjectsService],
  exports: [ObjectsService],
})
export class ObjectsModule {}
