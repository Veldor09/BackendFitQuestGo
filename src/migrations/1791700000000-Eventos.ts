import { MigrationInterface, QueryRunner } from 'typeorm';

export class Eventos1791700000000 implements MigrationInterface {
  name = 'Eventos1791700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "eventos" (
        "id" SERIAL NOT NULL,
        "nombre" varchar(100) NOT NULL,
        "descripcion" varchar(500),
        "categoria" varchar(30) NOT NULL,
        "fecha_inicio" timestamptz NOT NULL,
        "fecha_fin" timestamptz NOT NULL,
        "areas" jsonb NOT NULL DEFAULT '[]',
        "recorridos" jsonb NOT NULL DEFAULT '[]',
        "creado_por" integer NOT NULL,
        "creado_en" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_eventos" PRIMARY KEY ("id"),
        CONSTRAINT "FK_eventos_creado_por" FOREIGN KEY ("creado_por") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_eventos_fecha_fin" ON "eventos" ("fecha_fin")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_eventos_creado_por" ON "eventos" ("creado_por")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "eventos"`);
  }
}
