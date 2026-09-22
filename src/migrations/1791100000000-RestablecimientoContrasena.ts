import { MigrationInterface, QueryRunner } from 'typeorm';

export class RestablecimientoContrasena1791100000000 implements MigrationInterface {
  name = 'RestablecimientoContrasena1791100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "restablecimientos_contrasena" (
        "id" SERIAL PRIMARY KEY,
        "usuario_id" INTEGER NOT NULL,
        "hash_codigo" VARCHAR(64) NOT NULL,
        "expira_en" TIMESTAMP WITH TIME ZONE NOT NULL,
        "usado" BOOLEAN NOT NULL DEFAULT false,
        "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_restablecimientos_usuario_id"
      ON "restablecimientos_contrasena" ("usuario_id")
    `);
    await queryRunner.query(
      `ALTER TABLE "restablecimientos_contrasena" ADD CONSTRAINT "FK_867496e067353c4c2658148aaef" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "restablecimientos_contrasena"`);
  }
}
