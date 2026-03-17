import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  Index,
} from 'typeorm';
import { ObjectEntity } from '../../objects/entities/object.entity';
import { CoordinatorRole } from '../../common/enums';

@Entity('coordinators')
export class CoordinatorEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  @Index()
  telegramUserId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  username: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  firstName: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  lastName: string;

  @Column({
    type: 'enum',
    enum: CoordinatorRole,
    default: CoordinatorRole.COORDINATOR,
  })
  @Index()
  role: CoordinatorRole;

  @Column({ type: 'boolean', default: true })
  @Index()
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToMany(() => ObjectEntity, (object) => object.coordinators)
  objects: ObjectEntity[];
}
