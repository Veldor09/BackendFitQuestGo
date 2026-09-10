import { MigrationInterface, QueryRunner } from 'typeorm';

export class RutasYNodos1790700000000 implements MigrationInterface {
  name = 'RutasYNodos1790700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "rutas" ("id" SERIAL NOT NULL, "nombre" character varying(100) NOT NULL, "actividad" character varying(30) NOT NULL, "dificultad" character varying(20) NOT NULL DEFAULT 'moderada', "distancia_km" numeric(6,2) NOT NULL DEFAULT '0', "puntos" jsonb NOT NULL, "estado" character varying(20) NOT NULL DEFAULT 'Privada', "creado_en" TIMESTAMP NOT NULL DEFAULT now(), "creado_por" integer NOT NULL, CONSTRAINT "PK_80408b869ec5168c98210b8eba8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "nodos" ("id" SERIAL NOT NULL, "nombre" character varying(100) NOT NULL, "categoria" character varying(50) NOT NULL, "lat" double precision NOT NULL, "lng" double precision NOT NULL, "descripcion" character varying(500), "estado" character varying(20) NOT NULL DEFAULT 'Pendiente', "creado_en" TIMESTAMP NOT NULL DEFAULT now(), "creado_por" integer NOT NULL, CONSTRAINT "PK_5ed9e54eb263e0d87ac7529848e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "rutas" ADD CONSTRAINT "FK_5bcf5dac0d7af4e0eb847d7d4b6" FOREIGN KEY ("creado_por") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "nodos" ADD CONSTRAINT "FK_abaf2952bac981b2420b78876c5" FOREIGN KEY ("creado_por") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "nodos" DROP CONSTRAINT "FK_abaf2952bac981b2420b78876c5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rutas" DROP CONSTRAINT "FK_5bcf5dac0d7af4e0eb847d7d4b6"`,
    );
    await queryRunner.query(`DROP TABLE "nodos"`);
    await queryRunner.query(`DROP TABLE "rutas"`);
  }
}
