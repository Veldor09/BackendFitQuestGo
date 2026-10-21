import { MigrationInterface, QueryRunner } from 'typeorm';

export class Calificaciones1792500000000 implements MigrationInterface {
  name = 'Calificaciones1792500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "calificaciones" ("id" SERIAL NOT NULL, "tipo" character varying(10) NOT NULL, "objeto_id" integer NOT NULL, "clave" character varying(32) NOT NULL DEFAULT '', "usuario_id" integer NOT NULL, "valor" character varying(10) NOT NULL, "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "actualizado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_calificaciones_objeto_usuario" UNIQUE ("tipo", "objeto_id", "clave", "usuario_id"), CONSTRAINT "PK_calificaciones" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_calificaciones_objeto" ON "calificaciones" ("tipo", "objeto_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "calificaciones" ADD CONSTRAINT "FK_calificaciones_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "calificaciones" DROP CONSTRAINT "FK_calificaciones_usuario"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_calificaciones_objeto"`);
    await queryRunner.query(`DROP TABLE "calificaciones"`);
  }
}
