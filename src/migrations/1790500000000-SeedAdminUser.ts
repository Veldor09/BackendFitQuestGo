import { MigrationInterface, QueryRunner } from 'typeorm';

// Cuenta administrativa para usar
//  correo:      admin@gmail.com
//contrasena:  admin123

export class SeedAdminUser1790500000000 implements MigrationInterface {
  name = 'SeedAdminUser1790500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // `ON CONFLICT` -> si el correo ya existe, no hace nada (migracion reejecutable).
    await queryRunner.query(`
      INSERT INTO "usuarios"
        ("nombre_user", "email_user", "password_user_hash", "idrol", "estado")
      VALUES (
        'Administrador',
        'admin@gmail.com',
        '$2b$12$05i8FXYpeRN5DFh8MujWte.TTgEHABKpGIsfJvLYXAt3O.OTPI1O2',
        3,
        'Activado'
      )
      ON CONFLICT ("email_user") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "usuarios" WHERE "email_user" = 'admin@gmail.com'`,
    );
  }
}
