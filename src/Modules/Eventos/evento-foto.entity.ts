import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Evento } from './evento.entity';

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
