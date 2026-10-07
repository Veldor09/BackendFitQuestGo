import { MigrationInterface, QueryRunner } from 'typeorm';

export class RutaVisibilidad1791500000000 implements MigrationInterface {
  name = 'RutaVisibilidad1791500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "rutas" ADD COLUMN IF NOT EXISTS "visibilidad" varchar(20) NOT NULL DEFAULT 'privada'`,
    );
    // Las rutas que ya pidieron publicacion o estan publicadas eran publicas.
    await queryRunner.query(
      `UPDATE "rutas" SET "visibilidad" = 'publica' WHERE "estado" IN ('Pendiente', 'Publicada')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "rutas" DROP COLUMN IF EXISTS "visibilidad"`);
  }
}
