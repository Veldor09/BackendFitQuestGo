
import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('catalogo_items')
@Index(['catalogo', 'clave'], { unique: true })
export class CatalogoItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 30 })
  catalogo: string;

  @Column({ type: 'varchar', length: 50 })
  clave: string;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @Column({ type: 'boolean', default: true })
  activo: boolean;
}
