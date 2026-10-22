import { MigrationInterface, QueryRunner } from 'typeorm';

export class RutasPublicacionDirecta1792600000000
  implements MigrationInterface
{
  name = 'RutasPublicacionDirecta1792600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "rutas" SET "estado" = 'Publicada', "visibilidad" = 'publica' WHERE "estado" = 'Pendiente'`,
    );
    await queryRunner.query(
      `UPDATE "rutas" SET "visibilidad" = 'privada' WHERE "visibilidad" NOT IN ('privada', 'publica')`,
    );
  }

  public async down(): Promise<void> {
    // No hay vuelta atras: no se sabe cuales estaban pendientes ni cuales eran de amigos.
  }
}
