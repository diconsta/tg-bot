import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MasterStageEntity } from './entities/master-stage.entity';
import { ObjectStageEntity } from './entities/object-stage.entity';

@Injectable()
export class StagesService {
  private readonly logger = new Logger(StagesService.name);

  constructor(
    @InjectRepository(MasterStageEntity)
    private masterStageRepository: Repository<MasterStageEntity>,
    @InjectRepository(ObjectStageEntity)
    private objectStageRepository: Repository<ObjectStageEntity>,
  ) {}

  /**
   * Get all master stages ordered by orderNo
   */
  async getAllMasterStages(): Promise<MasterStageEntity[]> {
    return this.masterStageRepository.find({
      where: { active: true },
      order: { orderNo: 'ASC' },
    });
  }

  /**
   * Get master stage by ID
   */
  async getMasterStageById(stageId: string): Promise<MasterStageEntity> {
    const stage = await this.masterStageRepository.findOne({
      where: { id: stageId },
    });

    if (!stage) {
      throw new NotFoundException(`Master stage ${stageId} not found`);
    }

    return stage;
  }

  /**
   * Get master stage by stageIndex
   */
  async getMasterStageByIndex(stageIndex: number): Promise<MasterStageEntity> {
    const stage = await this.masterStageRepository.findOne({
      where: { stageIndex },
    });

    if (!stage) {
      throw new NotFoundException(`Master stage with index ${stageIndex} not found`);
    }

    return stage;
  }

  /**
   * Assign all master stages to a new object
   */
  async assignStagesToObject(objectId: string): Promise<ObjectStageEntity[]> {
    const masterStages = await this.getAllMasterStages();
    const objectStages: ObjectStageEntity[] = [];

    for (const masterStage of masterStages) {
      const objectStage = this.objectStageRepository.create({
        objectId,
        stageId: masterStage.id,
        isCompleted: false,
      });
      objectStages.push(objectStage);
    }

    const savedStages = await this.objectStageRepository.save(objectStages);
    this.logger.log(
      `Assigned ${savedStages.length} stages to object ${objectId}`,
    );

    return savedStages;
  }

  /**
   * Get all object stages for an object
   */
  async getObjectStages(objectId: string): Promise<ObjectStageEntity[]> {
    return this.objectStageRepository.find({
      where: { objectId },
      relations: ['stage'],
      order: { stage: { orderNo: 'ASC' } },
    });
  }

  /**
   * Get specific object stage
   */
  async getObjectStage(
    objectId: string,
    stageId: string,
  ): Promise<ObjectStageEntity> {
    const objectStage = await this.objectStageRepository.findOne({
      where: { objectId, stageId },
      relations: ['stage'],
    });

    if (!objectStage) {
      throw new NotFoundException(
        `Object stage not found for object ${objectId} and stage ${stageId}`,
      );
    }

    return objectStage;
  }

  /**
   * Complete a stage for an object
   */
  async completeStage(
    objectId: string,
    stageId: string,
  ): Promise<ObjectStageEntity> {
    const objectStage = await this.getObjectStage(objectId, stageId);

    this.logger.debug(`Completing stage ${objectStage.stage.stageIndex}:${objectStage.stage.stageName} (ID: ${stageId}) for object ${objectId}`);

    if (objectStage.isCompleted) {
      this.logger.warn(
        `Stage ${stageId} for object ${objectId} is already completed`,
      );
      return objectStage;
    }

    objectStage.isCompleted = true;
    objectStage.completedAt = new Date();

    const saved = await this.objectStageRepository.save(objectStage);
    this.logger.log(`Completed stage ${objectStage.stage.stageIndex}:${objectStage.stage.stageName} (ID: ${stageId}) for object ${objectId}`);

    return saved;
  }

  /**
   * Check if a stage is completed
   */
  async isStageCompleted(objectId: string, stageId: string): Promise<boolean> {
    const objectStage = await this.getObjectStage(objectId, stageId);
    return objectStage.isCompleted;
  }

  /**
   * Get the next incomplete stage for an object
   */
  async getNextIncompleteStage(
    objectId: string,
  ): Promise<ObjectStageEntity | null> {
    const objectStage = await this.objectStageRepository
      .createQueryBuilder('os')
      .leftJoinAndSelect('os.stage', 'stage')
      .where('os.objectId = :objectId', { objectId })
      .andWhere('os.isCompleted = :isCompleted', { isCompleted: false })
      .andWhere('stage.active = :active', { active: true })
      .orderBy('stage.orderNo', 'ASC')
      .getOne();

    return objectStage || null;
  }

}
