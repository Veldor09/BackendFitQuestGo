
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('planes_patrocinio')
export class PlanPatrocinio {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100, unique: true })
  nombre: string;

  @Column({ name: 'duracion_dias', type: 'int', default: 30 })
  duracionDias: number;

  /** A quien va dirigido: `empresa` (destacar) o `usuario` (mas descargas offline). */
  @Column({ type: 'varchar', length: 10, default: 'empresa' })
  audiencia: 'empresa' | 'usuario';

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'timestamptz' })
  actualizadoEn: Date;
}
