import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull, LessThan } from 'typeorm';
import { ObjectEntity } from './entities/object.entity';
import { CreateObjectDto } from './dto/create-object.dto';
import { ObjectStatus } from '../common/enums';

@Injectable()
export class ObjectsService {
  private readonly logger = new Logger(ObjectsService.name);

  constructor(
    @InjectRepository(ObjectEntity)
    private objectRepository: Repository<ObjectEntity>,
  ) {}

  async create(createObjectDto: CreateObjectDto): Promise<ObjectEntity> {
    const object = this.objectRepository.create({
      ...createObjectDto,
      currentStageId: null, // Will be set when stages are assigned
      paused: false,
      status: ObjectStatus.ACTIVE,
    });

    const savedObject = await this.objectRepository.save(object);
    this.logger.log(
      `Created object: ${savedObject.name} (ID: ${savedObject.id})`,
    );

    return savedObject;
  }

  async findById(id: string): Promise<ObjectEntity> {
    const object = await this.objectRepository.findOne({
      where: { id },
      relations: ['objectStages', 'objectStages.stage', 'photos', 'history', 'currentStage'],
    });

    if (!object) {
      throw new NotFoundException(`Object with ID ${id} not found`);
    }

    return object;
  }

  async findByTelegramIds(
    chatId: string,
    threadId: string,
  ): Promise<ObjectEntity | null> {
    return this.objectRepository.findOne({
      where: {
        telegramChatId: chatId,
        telegramThreadId: threadId,
      },
      relations: ['objectStages', 'objectStages.stage', 'photos', 'currentStage'],
    });
  }

  async findActiveObjects(): Promise<ObjectEntity[]> {
    return this.objectRepository.find({
      where: {
        paused: false,
        status: Not(ObjectStatus.DONE),
      },
      relations: ['objectStages', 'objectStages.stage', 'currentStage'],
    });
  }

  async findObjectsForReminder(): Promise<ObjectEntity[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.objectRepository.find({
      where: [
        {
          paused: false,
          status: Not(ObjectStatus.DONE),
          lastPromptAt: IsNull(),
        },
        {
          paused: false,
          status: Not(ObjectStatus.DONE),
          lastPromptAt: LessThan(today),
        },
      ],
      relations: ['objectStages', 'objectStages.stage', 'currentStage'],
    });
  }

  async findStalledStages(stalledDays: number): Promise<ObjectEntity[]> {
    const stalledDate = new Date();
    stalledDate.setDate(stalledDate.getDate() - stalledDays);

    return this.objectRepository
      .createQueryBuilder('object')
      .leftJoinAndSelect('object.objectStages', 'objectStage')
      .leftJoinAndSelect('objectStage.stage', 'stage')
      .leftJoinAndSelect('object.currentStage', 'currentStage')
      .where('object.paused = :paused', { paused: false })
      .andWhere('object.status = :status', { status: ObjectStatus.ACTIVE })
      .andWhere(
        'objectStage.stageId = object.currentStageId AND objectStage.isCompleted = :isCompleted',
        { isCompleted: false },
      )
      .andWhere('objectStage.createdAt < :stalledDate', { stalledDate })
      .getMany();
  }

  async updateLastPromptAt(id: string): Promise<void> {
    await this.objectRepository.update(id, {
      lastPromptAt: new Date(),
    });
    this.logger.log(`Updated lastPromptAt for object ${id}`);
  }

  async setCurrentStage(id: string, stageId: string): Promise<ObjectEntity> {
    const object = await this.findById(id);
    object.currentStageId = stageId;

    await this.objectRepository.save(object);
    this.logger.log(`Object ${id} current stage set to ${stageId}`);

    return object;
  }

  async progressToNextStage(id: string): Promise<ObjectEntity> {
    const object = await this.findById(id);

    this.logger.debug(`Current stage before progression: ${object.currentStage?.stageName} (ID: ${object.currentStageId})`);
    this.logger.debug(`Object stages: ${object.objectStages.map(os => `${os.stage.stageIndex}:${os.stage.stageName} (completed: ${os.isCompleted}, active: ${os.stage.active})`).join(', ')}`);

    // Find the next incomplete stage
    const nextStage = object.objectStages
      .sort((a, b) => a.stage.orderNo - b.stage.orderNo)
      .find(os => !os.isCompleted && os.stage.active);

    this.logger.debug(`Next stage found: ${nextStage ? `${nextStage.stage.stageIndex}:${nextStage.stage.stageName}` : 'NONE'}`);

    if (!nextStage) {
      // No more stages, mark as DONE
      this.logger.log(`Object ${id} marked as DONE (all stages completed)`);

      await this.objectRepository.update(id, {
        status: ObjectStatus.DONE,
        currentStageId: null,
      });
    } else {
      this.logger.log(
        `Object ${id} progressing to stage ${nextStage.stage.stageIndex}:${nextStage.stage.stageName} (ID: ${nextStage.stageId})`,
      );

      await this.objectRepository.update(id, {
        currentStageId: nextStage.stageId,
      });
    }

    // Reload the object with all relations - using fresh query
    const reloadedObject = await this.objectRepository.findOne({
      where: { id },
      relations: ['objectStages', 'objectStages.stage', 'photos', 'history', 'currentStage'],
    });

    if (!reloadedObject) {
      throw new NotFoundException(`Object ${id} not found after progression`);
    }

    this.logger.debug(`Reloaded currentStage: ${reloadedObject.currentStage?.stageIndex}:${reloadedObject.currentStage?.stageName} (ID: ${reloadedObject.currentStageId})`);

    return reloadedObject;
  }

  async togglePause(id: string): Promise<ObjectEntity> {
    const object = await this.findById(id);
    object.paused = !object.paused;

    await this.objectRepository.save(object);
    this.logger.log(
      `Object ${id} ${object.paused ? 'paused' : 'resumed'}`,
    );

    return object;
  }

  async updateStatus(id: string, status: ObjectStatus): Promise<ObjectEntity> {
    const object = await this.findById(id);
    object.status = status;

    await this.objectRepository.save(object);
    this.logger.log(`Object ${id} status changed to ${status}`);

    return object;
  }

  async generateReport(id: string, photoCountsMap: Map<string, number>): Promise<string> {
    const object = await this.findById(id);

    let report = `📊 <b>Raport obiektu</b>\n\n`;
    report += `<b>Obiekt:</b> ${object.name}\n`;
    report += `<b>Status:</b> ${object.status}\n`;
    report += `<b>Utworzono:</b> ${this.formatDate(object.createdAt)}\n\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Sort stages by order number
    const sortedStages = object.objectStages
      .sort((a, b) => a.stage.orderNo - b.stage.orderNo);

    for (const objectStage of sortedStages) {
      const stage = objectStage.stage;
      const photoCount = photoCountsMap.get(stage.id) || 0;

      report += `<b>Stage ${stage.stageIndex}: ${stage.stageName}</b>\n`;

      if (objectStage.isCompleted) {
        report += `✅ Zakończono: ${this.formatDate(objectStage.completedAt)}\n`;
      } else if (object.currentStageId === stage.id) {
        report += `⏳ W trakcie\n`;
      } else {
        report += `⏸ Nie rozpoczęto\n`;
      }

      report += `📷 Zdjęcia: ${photoCount}\n\n`;
    }

    if (object.status === ObjectStatus.DONE) {
      report += `━━━━━━━━━━━━━━━━━━━━━\n`;
      report += `🎉 <b>Wszystkie etapy zakończone!</b>`;
    }

    return report;
  }

  private formatDate(date: Date | null): string {
    if (!date) {
      return 'N/A';
    }

    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();

    return `${day}.${month}.${year}`;
  }
}
