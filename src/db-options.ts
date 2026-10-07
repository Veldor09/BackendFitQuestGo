import { join } from 'path';

const ext = __filename.endsWith('.ts') ? 'ts' : 'js';

export function opcionesConexion() {
  const ssl =
    process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined;
  const migrations = [join(__dirname, 'migrations', `*.${ext}`)];

  if (process.env.DATABASE_URL) {
    return { url: process.env.DATABASE_URL, ssl, migrations };
  }
  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    ssl,
    migrations,
  };
}
