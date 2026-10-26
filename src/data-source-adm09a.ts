
import 'dotenv/config';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { opcionesConexion } from './db-options';
import { PlanesYSuscripciones1792900000000 } from './migrations/1792900000000-PlanesYSuscripciones';

// DataSource temporal para pruebas aisladas de ADM-09A.
// No modifica la configuración principal del backend.
const configuracion = opcionesConexion();

export default new DataSource({
  type: 'postgres',
  ...configuracion,
  entities: [join(__dirname, '**', '*.entity.{ts,js}')],
  migrations: [PlanesYSuscripciones1792900000000],
  namingStrategy: new SnakeNamingStrategy(),
  synchronize: false,
  migrationsRun: false,
});
