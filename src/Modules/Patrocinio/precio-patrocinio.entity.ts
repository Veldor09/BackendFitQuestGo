
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PlanPatrocinio } from './plan-patrocinio.entity';

@Entity('precios_patrocinio')
export class PrecioPatrocinio {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'plan_id', type: 'int' })
  planId: number;

  @ManyToOne(() => PlanPatrocinio, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'plan_id' })
  plan: PlanPatrocinio;

  @Column({ type: 'varchar', length: 3 })
  moneda: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  importe: string;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'timestamptz' })
  actualizadoEn: Date;
}
