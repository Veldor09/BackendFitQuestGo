import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Una suscripcion `Activa` exigia un administrador (`administrador_id`) porque
 * siempre la aprobaba una persona. Con el pago en linea el plan se activa solo
 * al confirmarse el pago, sin administrador: ahora basta con `pagada_en`.
 *
 * Se agrega como migracion nueva (y no se edita la anterior) porque
 * `1793200000000-PagoEnLinea` ya pudo correr en otros ambientes.
 */
export class ActivacionPorPago1793300000000 implements MigrationInterface {
  name = 'ActivacionPorPago1793300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "suscripciones"
        DROP CONSTRAINT IF EXISTS "CHK_suscripciones_activa"
    `);
    await queryRunner.query(`
      ALTER TABLE "suscripciones"
        ADD CONSTRAINT "CHK_suscripciones_activa"
        CHECK (
          "estado" <> 'Activa'
          OR (
            "inicia_en" IS NOT NULL
            AND "vence_en" IS NOT NULL
            AND "precio_aplicado" IS NOT NULL
            AND ("administrador_id" IS NOT NULL OR "pagada_en" IS NOT NULL)
          )
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "suscripciones"
        DROP CONSTRAINT IF EXISTS "CHK_suscripciones_activa"
    `);
    await queryRunner.query(`
      ALTER TABLE "suscripciones"
        ADD CONSTRAINT "CHK_suscripciones_activa"
        CHECK (
          "estado" <> 'Activa'
          OR (
            "inicia_en" IS NOT NULL
            AND "vence_en" IS NOT NULL
            AND "precio_aplicado" IS NOT NULL
            AND "administrador_id" IS NOT NULL
          )
        )
    `);
  }
}
