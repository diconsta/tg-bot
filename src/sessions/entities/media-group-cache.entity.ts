import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm';

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

  @Column({ default: 0 })
  processedCount: number;

  @CreateDateColumn()
  createdAt: Date;
}
