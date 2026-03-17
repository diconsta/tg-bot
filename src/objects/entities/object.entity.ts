import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToMany,
  ManyToOne,
  JoinTable,
  JoinColumn,
  Index,
} from 'typeorm';
import { ObjectStatus } from '../../common/enums';
import { ObjectStageEntity } from '../../stages/entities/object-stage.entity';
import { MasterStageEntity } from '../../stages/entities/master-stage.entity';
import { StagePhotoEntity } from '../../photos/entities/stage-photo.entity';
import { StageHistoryEntity } from '../../history/entities/stage-history.entity';
import { CoordinatorEntity } from '../../coordinators/entities/coordinator.entity';

@Entity('objects')
@Index(['telegramChatId', 'telegramThreadId'], { unique: true })
export class ObjectEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  @Index()
  telegramChatId: string;

  @Column({ type: 'varchar', length: 255 })
  @Index()
  telegramThreadId: string;

  @Column({ type: 'varchar', length: 500 })
  name: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  currentStageId: string;

  @Column({ type: 'boolean', default: false })
  @Index()
  paused: boolean;

  @Column({
    type: 'enum',
    enum: ObjectStatus,
    default: ObjectStatus.ACTIVE,
  })
  @Index()
  status: ObjectStatus;

  @Column({ type: 'timestamp', nullable: true })
  lastPromptAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => ObjectStageEntity, (objectStage) => objectStage.object, {
    cascade: true,
  })
  objectStages: ObjectStageEntity[];

  @ManyToOne(() => MasterStageEntity, { eager: true })
  @JoinColumn({ name: 'currentStageId' })
  currentStage: MasterStageEntity;

  @OneToMany(() => StagePhotoEntity, (photo) => photo.object, { cascade: true })
  photos: StagePhotoEntity[];

  @OneToMany(() => StageHistoryEntity, (history) => history.object, {
    cascade: true,
  })
  history: StageHistoryEntity[];

  @ManyToMany(() => CoordinatorEntity, (coordinator) => coordinator.objects)
  @JoinTable({
    name: 'object_coordinators',
    joinColumn: { name: 'object_id', referencedColumnName: 'id' },
    inverseJoinColumn: {
      name: 'coordinator_id',
      referencedColumnName: 'id',
    },
  })
  coordinators: CoordinatorEntity[];
}
