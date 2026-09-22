import { MigrationInterface, QueryRunner } from 'typeorm';

export class AceptacionTerminos1791000000000 implements MigrationInterface {
  name = 'AceptacionTerminos1791000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "usuarios" ADD COLUMN "terminos_aceptados_en" TIMESTAMP WITH TIME ZONE NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "usuarios" DROP COLUMN "terminos_aceptados_en"`,
    );
  }
}
