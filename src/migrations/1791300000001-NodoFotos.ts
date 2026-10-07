import { MigrationInterface, QueryRunner } from 'typeorm';

export class NodoFotos1791300000001 implements MigrationInterface {
  name = 'NodoFotos1791300000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "nodo_fotos" ("nodo_id" integer NOT NULL, "contenido" bytea NOT NULL, "tipo_mime" character varying(30) NOT NULL, "actualizado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_nodo_fotos" PRIMARY KEY ("nodo_id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "nodo_fotos" ADD CONSTRAINT "FK_nodo_fotos_nodo" FOREIGN KEY ("nodo_id") REFERENCES "nodos"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "nodo_fotos" DROP CONSTRAINT "FK_nodo_fotos_nodo"`,
    );
    await queryRunner.query(`DROP TABLE "nodo_fotos"`);
  }
}
