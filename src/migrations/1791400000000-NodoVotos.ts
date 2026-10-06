import { MigrationInterface, QueryRunner } from 'typeorm';

export class NodoVotos1791400000000 implements MigrationInterface {
  name = 'NodoVotos1791400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "nodo_votos" ("id" SERIAL NOT NULL, "nodo_id" integer NOT NULL, "usuario_id" integer NOT NULL, "tipo" character varying(10) NOT NULL, "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_nodo_votos_nodo_usuario" UNIQUE ("nodo_id", "usuario_id"), CONSTRAINT "PK_nodo_votos" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "nodo_votos" ADD CONSTRAINT "FK_nodo_votos_nodo" FOREIGN KEY ("nodo_id") REFERENCES "nodos"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "nodo_votos" ADD CONSTRAINT "FK_nodo_votos_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "nodo_votos" DROP CONSTRAINT "FK_nodo_votos_usuario"`,
    );
    await queryRunner.query(
      `ALTER TABLE "nodo_votos" DROP CONSTRAINT "FK_nodo_votos_nodo"`,
    );
    await queryRunner.query(`DROP TABLE "nodo_votos"`);
  }
}
