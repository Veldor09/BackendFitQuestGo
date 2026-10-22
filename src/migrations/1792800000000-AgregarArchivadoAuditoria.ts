
import {
  MigrationInterface,
  QueryRunner,
} from 'typeorm';

export class AgregarArchivadoAuditoria1792800000000
  implements MigrationInterface
{
  name = 'AgregarArchivadoAuditoria1792800000000';

  public async up(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "registros_auditoria"
      ADD COLUMN IF NOT EXISTS "archivado"
        boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "archivado_por"
        integer NULL,
      ADD COLUMN IF NOT EXISTS "archivado_en"
        timestamptz NULL
    `);
  }

  public async down(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "registros_auditoria"
      DROP COLUMN IF EXISTS "archivado_en",
      DROP COLUMN IF EXISTS "archivado_por",
      DROP COLUMN IF EXISTS "archivado"
    `);
  }
}
