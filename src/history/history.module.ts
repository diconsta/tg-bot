import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HistoryService } from './history.service';
import { StageHistoryEntity } from './entities/stage-history.entity';

@Module({
  imports: [TypeOrmModule.forFeature([StageHistoryEntity])],
  providers: [HistoryService],
  exports: [HistoryService],
})
export class HistoryModule {}
