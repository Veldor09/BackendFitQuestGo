
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('registros_auditoria')
@Index('IDX_auditoria_administrador_fecha', [
  'administradorId',
  'creadoEn',
])
@Index('IDX_auditoria_accion_fecha', [
  'accion',
  'creadoEn',
])
@Index('IDX_auditoria_entidad_fecha', [
  'entidad',
  'creadoEn',
])
export class RegistroAuditoria {
  @PrimaryGeneratedColumn({
    name: 'id',
  })
  id: number;

  @Column({
    name: 'administrador_id',
    type: 'integer',
  })
  administradorId: number;

  @Column({
    name: 'accion',
    type: 'varchar',
    length: 80,
  })
  accion: string;

  @Column({
    name: 'entidad',
    type: 'varchar',
    length: 60,
  })
  entidad: string;

  @Column({
    name: 'entidad_id',
    type: 'integer',
    nullable: true,
  })
  entidadId: number | null;

  @Column({
    name: 'detalle',
    type: 'jsonb',
    nullable: true,
  })
  detalle: Record<string, unknown> | null;

  @CreateDateColumn({
    name: 'creado_en',
    type: 'timestamptz',
    default: () => 'now()',
  })
  creadoEn: Date;
}
