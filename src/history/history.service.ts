import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StageHistoryEntity } from './entities/stage-history.entity';
import { CreateHistoryDto } from './dto/create-history.dto';
import { HistoryAction } from '../common/enums';

@Injectable()
export class HistoryService {
  private readonly logger = new Logger(HistoryService.name);

  constructor(
    @InjectRepository(StageHistoryEntity)
    private historyRepository: Repository<StageHistoryEntity>,
  ) {}

  async create(createHistoryDto: CreateHistoryDto): Promise<StageHistoryEntity> {
    const history = this.historyRepository.create(createHistoryDto);
    const savedHistory = await this.historyRepository.save(history);

    this.logger.log(
      `Created history record: ${createHistoryDto.action} for object ${createHistoryDto.objectId}, stage ${createHistoryDto.stageId}`,
    );

    return savedHistory;
  }

  async recordPhotoAdded(
    objectId: string,
    stageId: string,
    userId?: string,
    username?: string,
  ): Promise<StageHistoryEntity> {
    return this.create({
      objectId,
      stageId,
      action: HistoryAction.PHOTO_ADDED,
      telegramUserId: userId,
      username,
    });
  }

  async recordStageCompleted(
    objectId: string,
    stageId: string,
    userId?: string,
    username?: string,
  ): Promise<StageHistoryEntity> {
    return this.create({
      objectId,
      stageId,
      action: HistoryAction.STAGE_COMPLETED,
      telegramUserId: userId,
      username,
    });
  }

  async recordPaused(
    objectId: string,
    stageId: string,
    userId?: string,
    username?: string,
  ): Promise<StageHistoryEntity> {
    return this.create({
      objectId,
      stageId,
      action: HistoryAction.PAUSED,
      telegramUserId: userId,
      username,
    });
  }

  async recordResumed(
    objectId: string,
    stageId: string,
    userId?: string,
    username?: string,
  ): Promise<StageHistoryEntity> {
    return this.create({
      objectId,
      stageId,
      action: HistoryAction.RESUMED,
      telegramUserId: userId,
      username,
    });
  }

  async findByObject(objectId: string): Promise<StageHistoryEntity[]> {
    return this.historyRepository.find({
      where: { objectId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByObjectAndAction(
    objectId: string,
    action: HistoryAction,
  ): Promise<StageHistoryEntity[]> {
    return this.historyRepository.find({
      where: { objectId, action },
      order: { createdAt: 'DESC' },
    });
  }
}
