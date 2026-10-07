import { MigrationInterface, QueryRunner } from 'typeorm';

export class NodosPatrocinados1791800000000 implements MigrationInterface {
  name = 'NodosPatrocinados1791800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "nodos" ADD COLUMN IF NOT EXISTS "beneficio" varchar(300)`,
    );
    await queryRunner.query(
      `ALTER TABLE "nodos" ADD COLUMN IF NOT EXISTS "patrocinado" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "nodos" DROP COLUMN IF EXISTS "patrocinado"`,
    );
    await queryRunner.query(
      `ALTER TABLE "nodos" DROP COLUMN IF EXISTS "beneficio"`,
    );
  }
}
