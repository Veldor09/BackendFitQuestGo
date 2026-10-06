import { MigrationInterface, QueryRunner } from 'typeorm';

export class ActividadesYFavoritas1791300000000 implements MigrationInterface {
  name = 'ActividadesYFavoritas1791300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "actividades" text[] NOT NULL DEFAULT '{}'`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "rutas_favoritas" (
        "usuario_id" integer NOT NULL,
        "ruta_id" integer NOT NULL,
        "guardado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_rutas_favoritas" PRIMARY KEY ("usuario_id", "ruta_id"),
        CONSTRAINT "FK_rutas_favoritas_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_rutas_favoritas_ruta" FOREIGN KEY ("ruta_id") REFERENCES "rutas"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "rutas_favoritas"`);
    await queryRunner.query(
      `ALTER TABLE "usuarios" DROP COLUMN IF EXISTS "actividades"`,
    );
  }
}
