import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('restablecimientos_contrasena')
@Index(['usuarioId'])
export class RestablecimientoContrasena {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  usuarioId: number;

  @Column({ type: 'varchar', length: 64 })
  hashCodigo: string;

  @Column({ type: 'timestamptz' })
  expiraEn: Date;

  @Column({ type: 'boolean', default: false })
  usado: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  creadoEn: Date;
}
