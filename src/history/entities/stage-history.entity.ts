import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ObjectEntity } from '../../objects/entities/object.entity';
import { MasterStageEntity } from '../../stages/entities/master-stage.entity';
import { HistoryAction } from '../../common/enums';

@Entity('stage_history')
@Index(['objectId', 'createdAt'])
export class StageHistoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  objectId: string;

  @Column({ type: 'uuid' })
  @Index()
  stageId: string;

  @Column({
    type: 'enum',
    enum: HistoryAction,
  })
  @Index()
  action: HistoryAction;

  @Column({ type: 'varchar', length: 255, nullable: true })
  telegramUserId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  username: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => ObjectEntity, (object) => object.history, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'objectId' })
  object: ObjectEntity;

  @ManyToOne(() => MasterStageEntity, { eager: true })
  @JoinColumn({ name: 'stageId' })
  stage: MasterStageEntity;
}
