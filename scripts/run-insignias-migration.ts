import 'dotenv/config';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { opcionesConexion } from '../src/db-options';
import { InsigniasAmpliadas1792100000000 } from '../src/migrations/1792100000000-InsigniasAmpliadas';

const NOMBRE_MIGRACION = 'InsigniasAmpliadas1792100000000';

async function main(): Promise<void> {
  const ejecutar = process.argv.includes('--execute');

  const dataSource = new DataSource({
    type: 'postgres',
    ...opcionesConexion(),
    namingStrategy: new SnakeNamingStrategy(),
    migrations: [InsigniasAmpliadas1792100000000],
    synchronize: false,
    migrationsRun: false,
  });

  if (!ejecutar) {
    console.log('MODO VERIFICACIÓN: no se modificará PostgreSQL.');
  }

  await dataSource.initialize();

  try {
    const pendientes = await dataSource.showMigrations();

    console.log(`Migración seleccionada: ${NOMBRE_MIGRACION}`);
    console.log(`Existen migraciones pendientes: ${pendientes}`);

    if (!ejecutar) {
      console.log('Verificación completada. Para ejecutar se requiere --execute.');
      return;
    }

    if (!pendientes) {
      console.log('La migración seleccionada ya está registrada.');
      return;
    }

    const migraciones = await dataSource.runMigrations({
      transaction: 'all',
    });

    const nombres = migraciones.map((migracion) => migracion.name);

    if (
      nombres.length !== 1 ||
      nombres[0] !== NOMBRE_MIGRACION
    ) {
      throw new Error(`Resultado inesperado: ${nombres.join(', ')}`);
    }

    console.log(`Migración ejecutada correctamente: ${NOMBRE_MIGRACION}`);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error('Error al procesar la migración:', error);
  process.exitCode = 1;
});
