const { spawnSync } = require('child_process');

const name = process.argv[2];

if (!name) {
  console.error('Uso: pnpm migration:generate <NombreDeLaMigracion>');
  process.exit(1);
}

const migrationPath = `src/migrations/${name}`;

const result = spawnSync(
  'pnpm',
  [
    'exec',
    'typeorm-ts-node-commonjs',
    'migration:generate',
    '-d',
    'src/data-source.ts',
    migrationPath,
  ],
  { stdio: 'inherit', shell: true },
);

process.exit(result.status ?? 1);
