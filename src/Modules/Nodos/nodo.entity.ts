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
import { CategoriaNodo } from './categoria-nodo.enum';
import { EstadoNodo } from './estado-nodo.enum';

@Entity('nodos')
export class Nodo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  // Clave de la lista cerrada `CategoriaNodo` (agua, mirador, ...). Candidata
  // a moverse a un catalogo editable (ADM-11) cuando haga falta.
  @Column({ type: 'varchar', length: 50 })
  categoria: CategoriaNodo;

  // Solo cuando `categoria` es `otro`: lo que escribio quien lo propuso.
  @Column({
    name: 'categoria_otro',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  categoriaOtro: string | null;

  // Hay una foto en `nodo_fotos`; se pide aparte (GET /nodos/:id/foto).
  @Column({ name: 'con_foto', type: 'boolean', default: false })
  conFoto: boolean;

  @Column({ type: 'double precision' })
  lat: number;

  @Column({ type: 'double precision' })
  lng: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  descripcion: string | null;

  @Column({ type: 'varchar', length: 20, default: EstadoNodo.Pendiente })
  estado: EstadoNodo;

  @SoloAutorPublico()
  @ManyToOne(() => User, { eager: true, nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'creado_por' })
  creadoPor: User;

  // `timestamptz` explicito: la columna `timestamp` por defecto no guarda
  // zona horaria, y el driver de pg la reinterpreta segun el TZ del proceso
  // de Node al leerla de vuelta (aqui, UTC-6), desfasando la hora 6h.
  @CreateDateColumn({ type: 'timestamptz' })
  creadoEn: Date;
}
