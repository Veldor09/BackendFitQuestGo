import { MigrationInterface, QueryRunner } from 'typeorm';

export class UsuarioFotos1791900000000 implements MigrationInterface {
  name = 'UsuarioFotos1791900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "usuario_fotos" (
        "usuario_id" integer NOT NULL,
        "contenido" bytea NOT NULL,
        "tipo_mime" varchar(30) NOT NULL,
        "actualizado_en" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_usuario_fotos" PRIMARY KEY ("usuario_id"),
        CONSTRAINT "FK_usuario_fotos_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "usuario_fotos"`);
  }
}
