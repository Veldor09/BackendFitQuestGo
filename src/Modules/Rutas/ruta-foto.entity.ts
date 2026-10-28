import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Ruta } from './ruta.entity';

@Entity('ruta_fotos')
export class RutaFoto {
  @PrimaryColumn({ name: 'ruta_id', type: 'int' })
  rutaId: number;

  @OneToOne(() => Ruta, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'ruta_id',
    foreignKeyConstraintName: 'FK_ruta_fotos_ruta',
  })
  ruta: Ruta;

  @Column({ type: 'bytea' })
  contenido: Buffer;

  @Column({ name: 'tipo_mime', type: 'varchar', length: 30 })
  tipoMime: string;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'timestamptz' })
  actualizadoEn: Date;
}
