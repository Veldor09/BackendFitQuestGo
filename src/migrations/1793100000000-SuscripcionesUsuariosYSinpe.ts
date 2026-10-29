import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * - Los planes tienen audiencia: `empresa` (destacar) o `usuario` (mas descargas
 *   sin conexion).
 * - Cada solicitud lleva su numero de 6 digitos: es lo que la persona escribe en
 *   el detalle del SINPE Movil para que el administrador la encuentre.
 * - Siembra un plan por audiencia, con precio en las tres monedas, SOLO si aun
 *   no hay ninguno: asi toda region tiene plan desde el primer despliegue (las
 *   monedas salen del pais: CR colones, zona euro euros, el resto dolares).
 */
export class SuscripcionesUsuariosYSinpe1793100000000 implements MigrationInterface {
  name = 'SuscripcionesUsuariosYSinpe1793100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "planes_patrocinio"
        ADD "audiencia" character varying(10) NOT NULL DEFAULT 'empresa',
        ADD CONSTRAINT "CHK_planes_audiencia"
          CHECK ("audiencia" IN ('empresa', 'usuario'))
    `);

    await queryRunner.query(`
      ALTER TABLE "suscripciones"
        ADD "numero_solicitud" character varying(6)
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_suscripciones_numero_solicitud"
      ON "suscripciones" ("numero_solicitud")
      WHERE "numero_solicitud" IS NOT NULL
    `);

    await this.sembrar(queryRunner, 'empresa', 'Plan Empresa Mensual', [
      ['CRC', 15000],
      ['USD', 30],
      ['EUR', 27],
    ]);
    await this.sembrar(queryRunner, 'usuario', 'Plan Explorador Mensual', [
      ['CRC', 2500],
      ['USD', 5],
      ['EUR', 4.5],
    ]);
  }

  private async sembrar(
    queryRunner: QueryRunner,
    audiencia: string,
    nombre: string,
    precios: Array<[string, number]>,
  ): Promise<void> {
    const ya = (await queryRunner.query(
      `SELECT 1 FROM "planes_patrocinio" WHERE "audiencia" = $1 LIMIT 1`,
      [audiencia],
    )) as unknown[];
    if (ya.length > 0) return;

    const [plan] = (await queryRunner.query(
      `INSERT INTO "planes_patrocinio" ("nombre", "duracion_dias", "audiencia")
       VALUES ($1, 30, $2) RETURNING "id"`,
      [nombre, audiencia],
    )) as Array<{ id: number }>;

    for (const [moneda, importe] of precios) {
      await queryRunner.query(
        `INSERT INTO "precios_patrocinio" ("plan_id", "moneda", "importe")
         VALUES ($1, $2, $3)`,
        [plan.id, moneda, importe],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_suscripciones_numero_solicitud"`);
    await queryRunner.query(
      `ALTER TABLE "suscripciones" DROP COLUMN "numero_solicitud"`,
    );
    await queryRunner.query(`
      ALTER TABLE "planes_patrocinio"
        DROP CONSTRAINT "CHK_planes_audiencia",
        DROP COLUMN "audiencia"
    `);
  }
}
