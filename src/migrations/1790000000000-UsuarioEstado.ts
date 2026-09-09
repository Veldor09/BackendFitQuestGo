import {MigrationInterface,QueryRunner,} from 'typeorm';

export class UsuarioEstado1790000000000 implements MigrationInterface {
  name = 'UsuarioEstado1790000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "usuarios" ADD "estado" character varying(20) NOT NULL DEFAULT 'Activado'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "usuarios" DROP COLUMN "estado"`);
  }
}
