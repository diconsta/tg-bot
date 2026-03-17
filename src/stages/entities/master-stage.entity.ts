import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('master_stages')
export class MasterStageEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int', unique: true })
  @Index()
  stageIndex: number;

  @Column({ type: 'varchar', length: 255 })
  stageName: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'int' })
  orderNo: number;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
