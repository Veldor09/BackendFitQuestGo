import { MigrationInterface, QueryRunner } from 'typeorm';

export class RegistrosAuditoria1792500000000 implements MigrationInterface {
  name = 'RegistrosAuditoria1792500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "registros_auditoria" (
        "id" SERIAL NOT NULL,
        "administrador_id" integer NOT NULL,
        "accion" varchar(80) NOT NULL,
        "entidad" varchar(60) NOT NULL,
        "entidad_id" integer,
        "detalle" jsonb,
        "creado_en" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_registros_auditoria" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_auditoria_administrador_fecha"
      ON "registros_auditoria" ("administrador_id", "creado_en")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_auditoria_accion_fecha"
      ON "registros_auditoria" ("accion", "creado_en")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_auditoria_entidad_fecha"
      ON "registros_auditoria" ("entidad", "creado_en")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "registros_auditoria"');
  }
}
