import 'dotenv/config';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { opcionesConexion } from './db-options';

//Para CLI de migraciones
export default new DataSource({
  type: 'postgres',
  ...opcionesConexion(),
  entities: [join(__dirname, '**', '*.entity.{ts,js}')],
  namingStrategy: new SnakeNamingStrategy(),
});
