import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Evento } from './evento.entity';

/**
 * Foto de un evento (una por evento). Va en la base de datos, no en disco (el disco del servidor
 * se pierde en cada despliegue) y en su propia tabla, para que listar no
 * arrastre los bytes (`eventos.con_foto` avisa si hay una).
 */
@Entity('evento_fotos')
export class EventoFoto {
  @PrimaryColumn({ name: 'evento_id', type: 'int' })
  eventoId: number;

  @OneToOne(() => Evento, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'evento_id',
    foreignKeyConstraintName: 'FK_evento_fotos_evento',
  })
  evento: Evento;

  @Column({ type: 'bytea' })
  contenido: Buffer;

  @Column({ name: 'tipo_mime', type: 'varchar', length: 30 })
  tipoMime: string;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'timestamptz' })
  actualizadoEn: Date;
}
