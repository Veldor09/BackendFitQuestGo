import { MigrationInterface, QueryRunner } from 'typeorm';

/** Telefonos que aceptaron avisos fuera de la app (token de Firebase Cloud Messaging). */
export class DispositivosPush1793000000000 implements MigrationInterface {
  name = 'DispositivosPush1793000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "dispositivos_push" ("id" SERIAL NOT NULL, "usuario_id" integer NOT NULL, "token" character varying(512) NOT NULL, "plataforma" character varying(10) NOT NULL, "idioma" character varying(5) NOT NULL DEFAULT 'es', "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "actualizado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_dispositivos_push" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_dispositivos_push_token" ON "dispositivos_push" ("token")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_dispositivos_push_usuario" ON "dispositivos_push" ("usuario_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "dispositivos_push" ADD CONSTRAINT "FK_dispositivos_push_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "dispositivos_push" DROP CONSTRAINT "FK_dispositivos_push_usuario"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_dispositivos_push_usuario"`);
    await queryRunner.query(`DROP INDEX "UQ_dispositivos_push_token"`);
    await queryRunner.query(`DROP TABLE "dispositivos_push"`);
  }
}
