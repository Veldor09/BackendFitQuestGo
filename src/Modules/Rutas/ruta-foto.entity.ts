import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Ruta } from './ruta.entity';

/**
 * Foto de una ruta (una por ruta). Va en la base de datos, no en disco (el disco del servidor
 * se pierde en cada despliegue) y en su propia tabla, para que listar no
 * arrastre los bytes (`rutas.con_foto` avisa si hay una).
 */
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
