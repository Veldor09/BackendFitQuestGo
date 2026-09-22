import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedRoles1787847558198 implements MigrationInterface {
  name = 'SeedRoles1787847558198';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "roles" ("idrol", "nombre_rol") VALUES
        (1, 'UserNormal'),
        (2, 'Empresa'),
        (3, 'Admin')
    `);

    await queryRunner.query(
      `SELECT setval(pg_get_serial_sequence('roles', 'idrol'), (SELECT MAX("idrol") FROM "roles"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "roles" WHERE "idrol" IN (1, 2, 3)`);
    await queryRunner.query(
      `SELECT setval(pg_get_serial_sequence('roles', 'idrol'), 1, false)`,
    );
  }
}
