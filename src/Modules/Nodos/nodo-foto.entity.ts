import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Nodo } from './nodo.entity';

/**
 * Foto de un nodo (una por nodo). Va en la base de datos, no en disco: el
 * disco del servidor se pierde en cada despliegue y las fotos se quedarian
 * colgando. Vive en su propia tabla para que listar nodos no arrastre los
 * bytes (`nodos.con_foto` avisa si hay una).
 */
@Entity('nodo_fotos')
export class NodoFoto {
  @PrimaryColumn({ name: 'nodo_id', type: 'int' })
  nodoId: number;

  @OneToOne(() => Nodo, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'nodo_id',
    foreignKeyConstraintName: 'FK_nodo_fotos_nodo',
  })
  nodo: Nodo;

  @Column({ type: 'bytea' })
  contenido: Buffer;

  @Column({ name: 'tipo_mime', type: 'varchar', length: 30 })
  tipoMime: string;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'timestamptz' })
  actualizadoEn: Date;
}
