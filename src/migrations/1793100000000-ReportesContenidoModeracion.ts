import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReportesContenidoModeracion1793100000000
  implements MigrationInterface
{
  name = 'ReportesContenidoModeracion1793100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reportes_contenido" ADD "es_foto" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "reportes_contenido" ADD "resolucion" character varying(20)`,
    );
    await queryRunner.query(
      `ALTER TABLE "eventos" ADD "desactivado" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `DELETE FROM "reportes_contenido" a USING "reportes_contenido" b WHERE a."reportado_por" = b."reportado_por" AND a."tipo_contenido" = b."tipo_contenido" AND a."contenido_id" = b."contenido_id" AND a."id" > b."id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reportes_contenido" ADD CONSTRAINT "UQ_reportes_contenido_persona_contenido" UNIQUE ("reportado_por", "tipo_contenido", "contenido_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reportes_contenido" DROP CONSTRAINT "UQ_reportes_contenido_persona_contenido"`,
    );
    await queryRunner.query(`ALTER TABLE "eventos" DROP COLUMN "desactivado"`);
    await queryRunner.query(
      `ALTER TABLE "reportes_contenido" DROP COLUMN "resolucion"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reportes_contenido" DROP COLUMN "es_foto"`,
    );
  }
}
