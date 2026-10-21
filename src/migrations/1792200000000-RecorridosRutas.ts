import { MigrationInterface, QueryRunner } from 'typeorm';

export class RecorridosRutas1792200000000 implements MigrationInterface {
  name = 'RecorridosRutas1792200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "recorridos_rutas" (
        "id" SERIAL NOT NULL,
        "ruta_id" integer NOT NULL,
        "usuario_id" integer NOT NULL,
        "distancia_km" numeric(6,2) NOT NULL DEFAULT '0.00',
        "duracion_segundos" integer NOT NULL DEFAULT 0,
        "iniciado_en" TIMESTAMP WITH TIME ZONE NOT NULL,
        "finalizado_en" TIMESTAMP WITH TIME ZONE NOT NULL,
        "puntos" jsonb NOT NULL DEFAULT '[]',
        "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_recorridos_rutas" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `ALTER TABLE "recorridos_rutas" ADD CONSTRAINT "FK_recorridos_rutas_ruta" FOREIGN KEY ("ruta_id") REFERENCES "rutas"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "recorridos_rutas" ADD CONSTRAINT "FK_recorridos_rutas_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "recorridos_rutas" DROP CONSTRAINT "FK_recorridos_rutas_usuario"`,
    );
    await queryRunner.query(
      `ALTER TABLE "recorridos_rutas" DROP CONSTRAINT "FK_recorridos_rutas_ruta"`,
    );
    await queryRunner.query(`DROP TABLE "recorridos_rutas"`);
  }
}
