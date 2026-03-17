import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('user_sessions')
export class UserSessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  userId: string;

  @Column()
  chatId: string;

  @Column()
  threadId: string;

  @Column({ default: 'AWAITING_PHOTOS' })
  state: string;

  @Column({ nullable: true })
  objectId: string;

  @Column({ nullable: true })
  stageId: string;

  @Column({ nullable: true })
  stageIndex: number;

  @Column({ nullable: true })
  stageName: string;

  @Column({ nullable: true })
  finishButtonMessageId: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
