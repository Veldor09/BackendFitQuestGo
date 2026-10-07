import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SoloAutorPublico } from '../../common/autor-publico';
import { User } from '../Usuarios/user.entity';
import { EstadoAlerta, GravedadAlerta } from './estado-alerta.enum';
import { TipoAlerta } from './tipo-alerta.enum';

@Entity('alertas')
export class Alerta {
  @PrimaryGeneratedColumn()
  id: number;

  // Clave de la lista cerrada `TipoAlerta` (arbol_caido, bache, ...).
  // Candidata a catalogo editable (ADM-11), igual que Nodo.categoria.
  @Column({ type: 'varchar', length: 50 })
  tipo: TipoAlerta;

  // Solo cuando `tipo` es `otro`: lo que escribio quien reporto.
  @Column({ name: 'tipo_otro', type: 'varchar', length: 50, nullable: true })
  tipoOtro: string | null;

  @Column({ type: 'varchar', length: 10 })
  gravedad: GravedadAlerta;

  @Column({ type: 'double precision' })
  lat: number;

  @Column({ type: 'double precision' })
  lng: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  descripcion: string | null;

  @Column({ type: 'varchar', length: 20, default: EstadoAlerta.Activa })
  estado: EstadoAlerta;

  // "Ya no esta" acumulados (ALR-05). Sin tabla de votos individuales por
  // ahora: mismo criterio de simplicidad que Nodo.categoria.
  @Column({ name: 'confirmaciones_no', type: 'int', default: 0 })
  confirmacionesNo: number;

  @SoloAutorPublico()
  @ManyToOne(() => User, { eager: true, nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'creado_por' })
  creadoPor: User;

  // `timestamptz` explicito: ver nota en Nodo.creadoEn sobre por que el tipo
  // `timestamp` por defecto desfasa la hora al leerla de vuelta.
  @CreateDateColumn({ type: 'timestamptz' })
  creadoEn: Date;

  @Column({ name: 'expira_en', type: 'timestamptz' })
  expiraEn: Date;
}
