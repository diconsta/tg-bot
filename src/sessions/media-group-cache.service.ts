import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  MediaGroupCacheEntity,
  PendingPhoto,
} from './entities/media-group-cache.entity';

@Injectable()
export class MediaGroupCacheService {
  constructor(
    @InjectRepository(MediaGroupCacheEntity)
    private readonly repo: Repository<MediaGroupCacheEntity>,
  ) {}

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
   * Atomically appends a photo to the pendingPhotos JSON array.
   */
  async appendPendingPhoto(
    mediaGroupId: string,
    photo: PendingPhoto,
  ): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .update(MediaGroupCacheEntity)
      .set({ pendingPhotos: () => `"pendingPhotos" || :photo::jsonb` })
      .setParameter('photo', JSON.stringify([photo]))
      .where('"mediaGroupId" = :mediaGroupId', { mediaGroupId })
      .execute();
  }

  async getPendingPhotos(mediaGroupId: string): Promise<PendingPhoto[]> {
    const entity = await this.repo.findOne({ where: { mediaGroupId } });
    return entity?.pendingPhotos ?? [];
  }

  /**
   * Atomically claims finalization. Returns true only for the one invocation
   * that successfully flips finalized from false → true.
   */
  async tryFinalize(mediaGroupId: string): Promise<boolean> {
    const result = await this.repo
      .createQueryBuilder()
      .update(MediaGroupCacheEntity)
      .set({ finalized: true })
      .where('"mediaGroupId" = :mediaGroupId AND "finalized" = false', {
        mediaGroupId,
      })
      .execute();
    return (result.affected ?? 0) > 0;
  }
}
