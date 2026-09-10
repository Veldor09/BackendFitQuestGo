import { MigrationInterface, QueryRunner } from 'typeorm';

export class Alertas1790800000000 implements MigrationInterface {
  name = 'Alertas1790800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "alertas" ("id" SERIAL NOT NULL, "tipo" character varying(50) NOT NULL, "gravedad" character varying(10) NOT NULL, "lat" double precision NOT NULL, "lng" double precision NOT NULL, "descripcion" character varying(500), "estado" character varying(20) NOT NULL DEFAULT 'Activa', "confirmaciones_no" integer NOT NULL DEFAULT '0', "creado_en" TIMESTAMP NOT NULL DEFAULT now(), "expira_en" TIMESTAMP WITH TIME ZONE NOT NULL, "creado_por" integer NOT NULL, CONSTRAINT "PK_b474c4021f8d6e4e13383ef1106" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "alertas" ADD CONSTRAINT "FK_2d97103f3559afe192b0d0be6f8" FOREIGN KEY ("creado_por") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "alertas" DROP CONSTRAINT "FK_2d97103f3559afe192b0d0be6f8"`,
    );
    await queryRunner.query(`DROP TABLE "alertas"`);
  }
}
