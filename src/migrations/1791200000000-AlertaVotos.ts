import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlertaVotos1791200000000 implements MigrationInterface {
  name = 'AlertaVotos1791200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "alerta_votos" ("id" SERIAL NOT NULL, "alerta_id" integer NOT NULL, "usuario_id" integer NOT NULL, "tipo" character varying(10) NOT NULL, "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_alerta_votos_alerta_usuario" UNIQUE ("alerta_id", "usuario_id"), CONSTRAINT "PK_alerta_votos" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "alerta_votos" ADD CONSTRAINT "FK_alerta_votos_alerta" FOREIGN KEY ("alerta_id") REFERENCES "alertas"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "alerta_votos" ADD CONSTRAINT "FK_alerta_votos_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "alerta_votos" DROP CONSTRAINT "FK_alerta_votos_usuario"`,
    );
    await queryRunner.query(
      `ALTER TABLE "alerta_votos" DROP CONSTRAINT "FK_alerta_votos_alerta"`,
    );
    await queryRunner.query(`DROP TABLE "alerta_votos"`);
  }
}
