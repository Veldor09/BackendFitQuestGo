import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../Usuarios/user.entity';
import { EstadoReporteContenido } from './estado-reporte-contenido.enum';
import { TipoContenidoReportado } from './tipo-contenido-reportado.enum';

@Entity('reportes_contenido')
export class ReporteContenido {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reportado_por' })
  reportadoPor: User;

  @Column({ name: 'tipo_contenido', type: 'varchar', length: 20 })
  tipoContenido: TipoContenidoReportado;

  @Column({ name: 'contenido_id', type: 'int' })
  contenidoId: number;

  @Column({ type: 'varchar', length: 100 })
  motivo: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  descripcion: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: EstadoReporteContenido.Pendiente,
  })
  estado: EstadoReporteContenido;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;

  @Column({ name: 'resuelto_en', type: 'timestamptz', nullable: true })
  resueltoEn: Date | null;
}
