import { MigrationInterface, QueryRunner } from 'typeorm';

// Cuenta de usuario normal para pruebas
//  correo:      usuario@gmail.com
//  contrasena:  usuario123

export class SeedUsuarioNormal1790600000000 implements MigrationInterface {
  name = 'SeedUsuarioNormal1790600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // `ON CONFLICT` -> si el correo ya existe, no hace nada (migracion reejecutable).
    await queryRunner.query(`
      INSERT INTO "usuarios"
        ("nombre_user", "email_user", "password_user_hash", "idrol", "estado")
      VALUES (
        'Usuario Prueba',
        'usuario@gmail.com',
        '$2b$12$dxxzZuPjrmG3p3soHXdecOz.gj/Sh9VsyzMpBLhCpHJCN0ek8opL6',
        1,
        'Activado'
      )
      ON CONFLICT ("email_user") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "usuarios" WHERE "email_user" = 'usuario@gmail.com'`,
    );
  }
}
