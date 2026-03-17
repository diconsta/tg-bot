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
    await this.repo.query(
      `UPDATE "media_group_cache" SET "pendingPhotos" = "pendingPhotos" || $1::jsonb WHERE "mediaGroupId" = $2`,
      [JSON.stringify([photo]), mediaGroupId],
    );
  }

  async getPendingPhotos(mediaGroupId: string): Promise<PendingPhoto[]> {
    const rows: { pendingPhotos: PendingPhoto[] }[] = await this.repo.query(
      `SELECT "pendingPhotos" FROM "media_group_cache" WHERE "mediaGroupId" = $1`,
      [mediaGroupId],
    );
    return rows[0]?.pendingPhotos ?? [];
  }

  /**
   * Atomically marks the album as finalized.
   * Returns true only for the one invocation that successfully flips finalized false → true.
   * Raw query used because pg's rowCount is reliable at the driver level.
   */
  async tryFinalize(mediaGroupId: string): Promise<boolean> {
    // pg driver returns [rows, rowCount]
    const [, rowCount] = (await this.repo.query(
      `UPDATE "media_group_cache" SET "finalized" = true WHERE "mediaGroupId" = $1 AND "finalized" = false`,
      [mediaGroupId],
    )) as [unknown[], number];
    return rowCount > 0;
  }
}
