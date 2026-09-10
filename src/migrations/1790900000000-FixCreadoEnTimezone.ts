import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `creado_en` en nodos/rutas/alertas se creo como `timestamp` (sin zona
 * horaria). Postgres guarda esa hora "pelada"; al leerla, el driver de pg la
 * reinterpreta con el TZ del proceso de Node (aqui, UTC-6) y la desfasa 6h
 * al convertirla a UTC. `USING ... AT TIME ZONE 'UTC'` le dice a Postgres
 * que el valor ya guardado ES UTC, asi que la conversion no pierde datos ni
 * desplaza las horas existentes.
 */
export class FixCreadoEnTimezone1790900000000 implements MigrationInterface {
  name = 'FixCreadoEnTimezone1790900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const tabla of ['nodos', 'rutas', 'alertas']) {
      await queryRunner.query(
        `ALTER TABLE "${tabla}" ALTER COLUMN "creado_en" TYPE TIMESTAMP WITH TIME ZONE USING "creado_en" AT TIME ZONE 'UTC'`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const tabla of ['nodos', 'rutas', 'alertas']) {
      await queryRunner.query(
        `ALTER TABLE "${tabla}" ALTER COLUMN "creado_en" TYPE TIMESTAMP USING "creado_en" AT TIME ZONE 'UTC'`,
      );
    }
  }
}
