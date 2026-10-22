import { MigrationInterface, QueryRunner } from 'typeorm';

/** Una foto opcional por ruta y por evento (en la base, como las de los nodos). */
export class FotosRutasEventos1792700000000 implements MigrationInterface {
  name = 'FotosRutasEventos1792700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "rutas" ADD "con_foto" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "eventos" ADD "con_foto" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `CREATE TABLE "ruta_fotos" ("ruta_id" integer NOT NULL, "contenido" bytea NOT NULL, "tipo_mime" character varying(30) NOT NULL, "actualizado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ruta_fotos" PRIMARY KEY ("ruta_id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "ruta_fotos" ADD CONSTRAINT "FK_ruta_fotos_ruta" FOREIGN KEY ("ruta_id") REFERENCES "rutas"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE TABLE "evento_fotos" ("evento_id" integer NOT NULL, "contenido" bytea NOT NULL, "tipo_mime" character varying(30) NOT NULL, "actualizado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_evento_fotos" PRIMARY KEY ("evento_id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "evento_fotos" ADD CONSTRAINT "FK_evento_fotos_evento" FOREIGN KEY ("evento_id") REFERENCES "eventos"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "evento_fotos" DROP CONSTRAINT "FK_evento_fotos_evento"`,
    );
    await queryRunner.query(`DROP TABLE "evento_fotos"`);
    await queryRunner.query(
      `ALTER TABLE "ruta_fotos" DROP CONSTRAINT "FK_ruta_fotos_ruta"`,
    );
    await queryRunner.query(`DROP TABLE "ruta_fotos"`);
    await queryRunner.query(`ALTER TABLE "eventos" DROP COLUMN "con_foto"`);
    await queryRunner.query(`ALTER TABLE "rutas" DROP COLUMN "con_foto"`);
  }
}
