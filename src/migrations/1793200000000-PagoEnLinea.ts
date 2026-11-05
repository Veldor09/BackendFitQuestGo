import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Pago en linea de la suscripcion (ONVO):
 * - `pago_ref`: id de la sesion de Checkout en la pasarela. Una solicitud con
 *   `pago_ref` es un pago en linea; sin el, es una de las de SINPE manual de antes.
 * - `pagada_en`: cuando se confirmo el pago.
 */
export class PagoEnLinea1793200000000 implements MigrationInterface {
  name = 'PagoEnLinea1793200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "suscripciones"
        ADD COLUMN IF NOT EXISTS "pago_ref" character varying(64),
        ADD COLUMN IF NOT EXISTS "pagada_en" TIMESTAMP WITH TIME ZONE
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_suscripciones_pago_ref"
      ON "suscripciones" ("pago_ref")
      WHERE "pago_ref" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_suscripciones_pago_ref"`);
    await queryRunner.query(`
      ALTER TABLE "suscripciones"
        DROP COLUMN IF EXISTS "pagada_en",
        DROP COLUMN IF EXISTS "pago_ref"
    `);
  }
}
