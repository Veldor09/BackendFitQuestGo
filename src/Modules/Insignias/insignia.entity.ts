import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { TipoInsignia } from './insignia.enum';
import { UsuarioInsignia } from './usuario-insignia.entity';

@Entity('insignia')
export class Insignia {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  codigo: string;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @Column({ type: 'text' })
  descripcion: string;

  @Column({ type: 'varchar', length: 10 })
  emoji: string;

  @Column({ type: 'varchar', length: 20 })
  tipo: TipoInsignia;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  meta: number | null;

  @Column({ type: 'boolean', default: true })
  activa: boolean;

  @OneToMany(() => UsuarioInsignia, (ui) => ui.insignia)
  usuariosInsignias: UsuarioInsignia[];
}
