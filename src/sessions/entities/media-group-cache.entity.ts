import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm';

export interface PendingPhoto {
  fileId: string;
  fileUniqueId: string;
  fileSize?: number;
}

@Entity('media_group_cache')
export class MediaGroupCacheEntity {
  @PrimaryColumn()
  mediaGroupId: string;

  @Column()
  messageId: number;

  @Column()
  chatId: string;

  @Column()
  threadId: string;

  @Column({ type: 'jsonb', default: '[]' })
  pendingPhotos: PendingPhoto[];

  @Column({ default: false })
  finalized: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
