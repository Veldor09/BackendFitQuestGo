import { MigrationInterface, QueryRunner } from 'typeorm';

export class UsuarioIntereses1791200000000 implements MigrationInterface {
  name = 'UsuarioIntereses1791200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "intereses" text[] NOT NULL DEFAULT '{}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "usuarios" DROP COLUMN IF EXISTS "intereses"`,
    );
  }
}
