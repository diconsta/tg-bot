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
import { MasterStageEntity } from './master-stage.entity';

@Entity('object_stages')
@Index(['objectId', 'stageId'], { unique: true })
export class ObjectStageEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  objectId: string;

  @Column({ type: 'uuid' })
  @Index()
  stageId: string;

  @Column({ type: 'boolean', default: false })
  @Index()
  isCompleted: boolean;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => ObjectEntity, (object) => object.objectStages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'objectId' })
  object: ObjectEntity;

  @ManyToOne(() => MasterStageEntity, {
    eager: true,
  })
  @JoinColumn({ name: 'stageId' })
  stage: MasterStageEntity;
}
