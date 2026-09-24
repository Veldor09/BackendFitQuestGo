import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { User } from '../Usuarios/user.entity';
import { Ruta } from './ruta.entity';

@Entity('rutas_favoritas')
export class RutaFavorita {
  @PrimaryColumn({ name: 'usuario_id' })
  usuarioId: number;

  @PrimaryColumn({ name: 'ruta_id' })
  rutaId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: User;

  @ManyToOne(() => Ruta, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ruta_id' })
  ruta: Ruta;

  @CreateDateColumn({ type: 'timestamptz', name: 'guardado_en' })
  guardadoEn: Date;
}
