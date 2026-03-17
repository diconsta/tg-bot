import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MediaGroupCacheEntity } from './entities/media-group-cache.entity';

@Injectable()
export class MediaGroupCacheService {
  constructor(
    @InjectRepository(MediaGroupCacheEntity)
    private readonly repo: Repository<MediaGroupCacheEntity>,
  ) {}

  async get(mediaGroupId: string): Promise<MediaGroupCacheEntity | null> {
    return this.repo.findOne({ where: { mediaGroupId } });
  }

  /**
   * Inserts if not exists (ON CONFLICT DO NOTHING).
   * Returns { messageId, isNew: true } if we created it,
   * or { messageId, isNew: false } if another invocation already did.
   */
  async getOrCreate(
    mediaGroupId: string,
    messageId: number,
    chatId: string,
    threadId: string,
  ): Promise<{ messageId: number; isNew: boolean }> {
    const result = await this.repo
      .createQueryBuilder()
      .insert()
      .into(MediaGroupCacheEntity)
      .values({ mediaGroupId, messageId, chatId, threadId })
      .onConflict(`("mediaGroupId") DO NOTHING`)
      .execute();

    if (result.raw.length > 0) {
      return { messageId, isNew: true };
    }

    // Another invocation already inserted — fetch its messageId
    const existing = await this.repo.findOne({ where: { mediaGroupId } });
    return { messageId: existing.messageId, isNew: false };
  }

  /**
   * Atomically increments processedCount and returns the new value.
   * Used to determine which invocation is the last one for an album.
   */
  async incrementProcessed(mediaGroupId: string): Promise<number> {
    const result = await this.repo
      .createQueryBuilder()
      .update(MediaGroupCacheEntity)
      .set({ processedCount: () => '"processedCount" + 1' })
      .where('"mediaGroupId" = :mediaGroupId', { mediaGroupId })
      .returning('"processedCount"')
      .execute();
    return result.raw[0].processedCount as number;
  }

  async getProcessedCount(mediaGroupId: string): Promise<number> {
    const entity = await this.repo.findOne({ where: { mediaGroupId } });
    return entity?.processedCount ?? 0;
  }
}
