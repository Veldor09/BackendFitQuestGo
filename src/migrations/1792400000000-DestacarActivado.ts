import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * El interruptor "Destacar" del dueno en puntos y eventos (monetizacion). Solo
 * agrega una columna con valor por defecto a cada tabla: nada que ya exista
 * cambia y todo queda apagado hasta que su dueno lo encienda.
 */
export class DestacarActivado1792400000000 implements MigrationInterface {
  name = 'DestacarActivado1792400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "nodos" ADD COLUMN IF NOT EXISTS "destacar_activado" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "eventos" ADD COLUMN IF NOT EXISTS "destacar_activado" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "eventos" DROP COLUMN IF EXISTS "destacar_activado"`,
    );
    await queryRunner.query(
      `ALTER TABLE "nodos" DROP COLUMN IF EXISTS "destacar_activado"`,
    );
  }
}
