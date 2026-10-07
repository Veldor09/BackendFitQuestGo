import { MigrationInterface, QueryRunner } from 'typeorm';

export class UsuarioTelefono1791600000000 implements MigrationInterface {
  name = 'UsuarioTelefono1791600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "telefono" varchar(20)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "usuarios" DROP COLUMN IF EXISTS "telefono"`,
    );
  }
}
