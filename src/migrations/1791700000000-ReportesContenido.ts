import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReportesContenido1791700000000 implements MigrationInterface {
  name = 'ReportesContenido1791700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "reportes_contenido" (
        "id" SERIAL NOT NULL,
        "reportado_por" integer NOT NULL,
        "tipo_contenido" character varying(20) NOT NULL,
        "contenido_id" integer NOT NULL,
        "motivo" character varying(100) NOT NULL,
        "descripcion" character varying(500),
        "estado" character varying(20) NOT NULL DEFAULT 'pendiente',
        "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "resuelto_en" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_reportes_contenido" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "reportes_contenido"
      ADD CONSTRAINT "FK_reportes_contenido_usuario"
      FOREIGN KEY ("reportado_por")
      REFERENCES "usuarios"("id")
      ON DELETE CASCADE
      ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_reportes_contenido_estado"
      ON "reportes_contenido" ("estado")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_reportes_contenido_tipo_id"
      ON "reportes_contenido" ("tipo_contenido", "contenido_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX "IDX_reportes_contenido_tipo_id"',
    );
    await queryRunner.query(
      'DROP INDEX "IDX_reportes_contenido_estado"',
    );
    await queryRunner.query(
      'ALTER TABLE "reportes_contenido" DROP CONSTRAINT "FK_reportes_contenido_usuario"',
    );
    await queryRunner.query('DROP TABLE "reportes_contenido"');
  }
}
