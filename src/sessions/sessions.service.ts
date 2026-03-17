import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserSessionEntity } from './entities/user-session.entity';

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(UserSessionEntity)
    private readonly repo: Repository<UserSessionEntity>,
  ) {}

  async get(userId: string, chatId: string, threadId: string): Promise<UserSessionEntity | null> {
    return this.repo.findOne({ where: { userId, chatId, threadId } });
  }

  async create(data: Partial<UserSessionEntity>): Promise<UserSessionEntity> {
    return this.repo.save(this.repo.create(data));
  }

  async update(id: string, data: Partial<UserSessionEntity>): Promise<void> {
    await this.repo.update(id, data);
  }

  async delete(userId: string, chatId: string, threadId: string): Promise<void> {
    await this.repo.delete({ userId, chatId, threadId });
  }
}
