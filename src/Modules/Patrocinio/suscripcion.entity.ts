
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../Usuarios/user.entity';
import { PlanPatrocinio } from './plan-patrocinio.entity';

export enum EstadoSuscripcion {
  Solicitada = 'Solicitada',
  Activa = 'Activa',
  Vencida = 'Vencida',
  Suspendida = 'Suspendida',
  Rechazada = 'Rechazada',
}

@Entity('suscripciones')
export class Suscripcion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'usuario_id', type: 'int' })
  usuarioId: number;

  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: User;

  @Column({ name: 'plan_id', type: 'int' })
  planId: number;

  @ManyToOne(() => PlanPatrocinio, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'plan_id' })
  plan: PlanPatrocinio;

  @Column({
    type: 'varchar',
    length: 20,
    default: EstadoSuscripcion.Solicitada,
  })
  estado: EstadoSuscripcion;

  @Column({ type: 'varchar', length: 2 })
  pais: string;

  @Column({ type: 'varchar', length: 3 })
  moneda: string;

  @Column({
    name: 'precio_aplicado',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  precioAplicado: string | null;

  @Column({
    name: 'inicia_en',
    type: 'timestamptz',
    nullable: true,
  })
  iniciaEn: Date | null;

  @Column({
    name: 'vence_en',
    type: 'timestamptz',
    nullable: true,
  })
  venceEn: Date | null;

  @Column({
    name: 'administrador_id',
    type: 'int',
    nullable: true,
  })
  administradorId: number | null;

  @ManyToOne(() => User, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'administrador_id' })
  administrador: User | null;

  @CreateDateColumn({
    name: 'creado_en',
    type: 'timestamptz',
  })
  creadoEn: Date;

  @UpdateDateColumn({
    name: 'actualizado_en',
    type: 'timestamptz',
  })
  actualizadoEn: Date;
}
