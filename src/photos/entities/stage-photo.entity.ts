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

@Entity('stage_photos')
@Index(['objectId', 'stageId'])
export class StagePhotoEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  objectId: string;

  @Column({ type: 'uuid' })
  @Index()
  stageId: string;

  @Column({ type: 'varchar', length: 500 })
  telegramFileId: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  telegramFileUniqueId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  fileName: string;

  @Column({ type: 'int', nullable: true })
  fileSize: number;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  driveFileId: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  driveUrl: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  driveFolderPath: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => ObjectEntity, (object) => object.photos, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'objectId' })
  object: ObjectEntity;

  @ManyToOne(() => MasterStageEntity, { eager: true })
  @JoinColumn({ name: 'stageId' })
  stage: MasterStageEntity;
}
