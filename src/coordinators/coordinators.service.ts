import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { CoordinatorEntity } from './entities/coordinator.entity';
import { CoordinatorRole } from '../common/enums';
import { ObjectEntity } from '../objects/entities/object.entity';

@Injectable()
export class CoordinatorsService {
  private readonly logger = new Logger(CoordinatorsService.name);
  private readonly superadminIds: string[];

  constructor(
    @InjectRepository(CoordinatorEntity)
    private coordinatorRepository: Repository<CoordinatorEntity>,
    @InjectRepository(ObjectEntity)
    private objectRepository: Repository<ObjectEntity>,
    private configService: ConfigService,
  ) {
    this.superadminIds = this.configService.get<string[]>('app.telegram.superadminIds') || [];
    if (this.superadminIds.length > 0) {
      this.logger.log(`Loaded ${this.superadminIds.length} superadmin user ID(s)`);
    }
  }

  /**
   * Check if user is a superadmin (configured in environment)
   */
  isSuperadmin(userId: string): boolean {
    return this.superadminIds.includes(userId);
  }

  async findByTelegramUserId(userId: string): Promise<CoordinatorEntity | null> {
    return this.coordinatorRepository.findOne({
      where: { telegramUserId: userId, isActive: true },
      relations: ['objects'],
    });
  }

  async findById(id: string): Promise<CoordinatorEntity> {
    const coordinator = await this.coordinatorRepository.findOne({
      where: { id },
      relations: ['objects'],
    });

    if (!coordinator) {
      throw new NotFoundException(`Coordinator with ID ${id} not found`);
    }

    return coordinator;
  }

  async canManageObject(userId: string, objectId: string): Promise<boolean> {
    // Superadmins can manage everything
    if (this.isSuperadmin(userId)) {
      return true;
    }

    const coordinator = await this.findByTelegramUserId(userId);

    if (!coordinator || !coordinator.isActive) {
      return false;
    }

    // Admins can manage everything
    if (coordinator.role === CoordinatorRole.ADMIN) {
      return true;
    }

    // Coordinators can only manage assigned objects
    if (coordinator.role === CoordinatorRole.COORDINATOR) {
      return coordinator.objects.some((obj) => obj.id === objectId);
    }

    // Viewers cannot manage anything
    return false;
  }

  async canViewObject(userId: string, objectId: string): Promise<boolean> {
    // Superadmins can view everything
    if (this.isSuperadmin(userId)) {
      return true;
    }

    const coordinator = await this.findByTelegramUserId(userId);

    if (!coordinator || !coordinator.isActive) {
      return false;
    }

    // Admins and viewers can view everything
    if (
      coordinator.role === CoordinatorRole.ADMIN ||
      coordinator.role === CoordinatorRole.VIEWER
    ) {
      return true;
    }

    // Coordinators can view their assigned objects
    return coordinator.objects.some((obj) => obj.id === objectId);
  }

  async isAdmin(userId: string): Promise<boolean> {
    // Superadmins are considered admins
    if (this.isSuperadmin(userId)) {
      return true;
    }

    const coordinator = await this.findByTelegramUserId(userId);
    return coordinator?.role === CoordinatorRole.ADMIN && coordinator.isActive;
  }

  async create(
    telegramUserId: string,
    username?: string,
    firstName?: string,
    lastName?: string,
    role: CoordinatorRole = CoordinatorRole.COORDINATOR,
  ): Promise<CoordinatorEntity> {
    // Check if coordinator already exists
    const existing = await this.coordinatorRepository.findOne({
      where: { telegramUserId },
    });

    if (existing) {
      throw new BadRequestException(
        `Coordinator with Telegram user ID ${telegramUserId} already exists`,
      );
    }

    const coordinator = this.coordinatorRepository.create({
      telegramUserId,
      username,
      firstName,
      lastName,
      role,
      isActive: true,
    });

    const saved = await this.coordinatorRepository.save(coordinator);
    this.logger.log(
      `Created coordinator: ${username || telegramUserId} with role ${role}`,
    );

    return saved;
  }

  async assignToObject(
    coordinatorId: string,
    objectId: string,
  ): Promise<void> {
    const coordinator = await this.findById(coordinatorId);
    const object = await this.objectRepository.findOne({
      where: { id: objectId },
      relations: ['coordinators'],
    });

    if (!object) {
      throw new NotFoundException(`Object with ID ${objectId} not found`);
    }

    // Check if already assigned
    const alreadyAssigned = object.coordinators.some(
      (c) => c.id === coordinatorId,
    );

    if (alreadyAssigned) {
      throw new BadRequestException(
        `Coordinator is already assigned to this object`,
      );
    }

    object.coordinators.push(coordinator);
    await this.objectRepository.save(object);

    this.logger.log(
      `Assigned coordinator ${coordinator.telegramUserId} to object ${object.name}`,
    );
  }

  async unassignFromObject(
    coordinatorId: string,
    objectId: string,
  ): Promise<void> {
    const object = await this.objectRepository.findOne({
      where: { id: objectId },
      relations: ['coordinators'],
    });

    if (!object) {
      throw new NotFoundException(`Object with ID ${objectId} not found`);
    }

    object.coordinators = object.coordinators.filter(
      (c) => c.id !== coordinatorId,
    );

    await this.objectRepository.save(object);
    this.logger.log(
      `Unassigned coordinator ${coordinatorId} from object ${object.name}`,
    );
  }

  async updateRole(
    coordinatorId: string,
    newRole: CoordinatorRole,
  ): Promise<CoordinatorEntity> {
    const coordinator = await this.findById(coordinatorId);
    coordinator.role = newRole;

    await this.coordinatorRepository.save(coordinator);
    this.logger.log(
      `Updated coordinator ${coordinator.telegramUserId} role to ${newRole}`,
    );

    return coordinator;
  }

  async deactivate(coordinatorId: string): Promise<void> {
    const coordinator = await this.findById(coordinatorId);
    coordinator.isActive = false;

    await this.coordinatorRepository.save(coordinator);
    this.logger.log(`Deactivated coordinator ${coordinator.telegramUserId}`);
  }

  async activate(coordinatorId: string): Promise<void> {
    const coordinator = await this.findById(coordinatorId);
    coordinator.isActive = true;

    await this.coordinatorRepository.save(coordinator);
    this.logger.log(`Activated coordinator ${coordinator.telegramUserId}`);
  }

  async findAll(): Promise<CoordinatorEntity[]> {
    return this.coordinatorRepository.find({
      relations: ['objects'],
      order: { createdAt: 'DESC' },
    });
  }

  async findCoordinatorsForObject(
    objectId: string,
  ): Promise<CoordinatorEntity[]> {
    const object = await this.objectRepository.findOne({
      where: { id: objectId },
      relations: ['coordinators'],
    });

    if (!object) {
      throw new NotFoundException(`Object with ID ${objectId} not found`);
    }

    return object.coordinators;
  }

  async getOrCreateCoordinator(
    telegramUserId: string,
    username?: string,
    firstName?: string,
    lastName?: string,
  ): Promise<CoordinatorEntity> {
    let coordinator = await this.coordinatorRepository.findOne({
      where: { telegramUserId },
    });

    if (!coordinator) {
      coordinator = await this.create(
        telegramUserId,
        username,
        firstName,
        lastName,
      );
      this.logger.log(
        `Auto-created coordinator for user ${username || telegramUserId}`,
      );
    }

    return coordinator;
  }
}
