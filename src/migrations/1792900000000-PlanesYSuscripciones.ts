
import { MigrationInterface, QueryRunner } from 'typeorm';

export class PlanesYSuscripciones1792900000000
  implements MigrationInterface
{
  name = 'PlanesYSuscripciones1792900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Planes de patrocinio
    await queryRunner.query(`
      CREATE TABLE "planes_patrocinio" (
        "id" SERIAL NOT NULL,
        "nombre" character varying(100) NOT NULL,
        "duracion_dias" integer NOT NULL DEFAULT 30,
        "activo" boolean NOT NULL DEFAULT true,
        "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "actualizado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_planes_patrocinio" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_planes_patrocinio_nombre" UNIQUE ("nombre"),
        CONSTRAINT "CHK_planes_duracion"
          CHECK ("duracion_dias" > 0)
      )
    `);

    // 2. Precios configurables por moneda
    await queryRunner.query(`
      CREATE TABLE "precios_patrocinio" (
        "id" SERIAL NOT NULL,
        "plan_id" integer NOT NULL,
        "moneda" character varying(3) NOT NULL,
        "importe" numeric(12, 2) NOT NULL,
        "activo" boolean NOT NULL DEFAULT true,
        "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "actualizado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_precios_patrocinio" PRIMARY KEY ("id"),
        CONSTRAINT "FK_precios_plan"
          FOREIGN KEY ("plan_id")
          REFERENCES "planes_patrocinio"("id")
          ON DELETE RESTRICT,
        CONSTRAINT "UQ_precios_plan_moneda"
          UNIQUE ("plan_id", "moneda"),
        CONSTRAINT "CHK_precios_importe"
          CHECK ("importe" > 0),
        CONSTRAINT "CHK_precios_moneda"
          CHECK ("moneda" IN ('CRC', 'USD', 'EUR'))
      )
    `);

    // 3. Suscripciones
    // Los nombres usuario_id, estado, inicia_en y vence_en
    // son compatibles con SuscripcionesVigentesSql.
    await queryRunner.query(`
      CREATE TABLE "suscripciones" (
        "id" SERIAL NOT NULL,
        "usuario_id" integer NOT NULL,
        "plan_id" integer NOT NULL,
        "estado" character varying(20) NOT NULL DEFAULT 'Solicitada',
        "pais" character varying(2) NOT NULL,
        "moneda" character varying(3) NOT NULL,
        "precio_aplicado" numeric(12, 2),
        "inicia_en" TIMESTAMP WITH TIME ZONE,
        "vence_en" TIMESTAMP WITH TIME ZONE,
        "administrador_id" integer,
        "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "actualizado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_suscripciones" PRIMARY KEY ("id"),
        CONSTRAINT "FK_suscripciones_usuario"
          FOREIGN KEY ("usuario_id")
          REFERENCES "usuarios"("id")
          ON DELETE RESTRICT,
        CONSTRAINT "FK_suscripciones_plan"
          FOREIGN KEY ("plan_id")
          REFERENCES "planes_patrocinio"("id")
          ON DELETE RESTRICT,
        CONSTRAINT "FK_suscripciones_administrador"
          FOREIGN KEY ("administrador_id")
          REFERENCES "usuarios"("id")
          ON DELETE SET NULL,
        CONSTRAINT "CHK_suscripciones_estado"
          CHECK (
            "estado" IN (
              'Solicitada',
              'Activa',
              'Vencida',
              'Suspendida',
              'Rechazada'
            )
          ),
        CONSTRAINT "CHK_suscripciones_moneda"
          CHECK ("moneda" IN ('CRC', 'USD', 'EUR')),
        CONSTRAINT "CHK_suscripciones_pais"
          CHECK ("pais" ~ '^[A-Z]{2}$'),
        CONSTRAINT "CHK_suscripciones_precio"
          CHECK (
            "precio_aplicado" IS NULL
            OR "precio_aplicado" > 0
          ),
        CONSTRAINT "CHK_suscripciones_vigencia"
          CHECK (
            ("inicia_en" IS NULL AND "vence_en" IS NULL)
            OR (
              "inicia_en" IS NOT NULL
              AND "vence_en" IS NOT NULL
              AND "vence_en" > "inicia_en"
            )
          ),
        CONSTRAINT "CHK_suscripciones_activa"
          CHECK (
            "estado" <> 'Activa'
            OR (
              "inicia_en" IS NOT NULL
              AND "vence_en" IS NOT NULL
              AND "precio_aplicado" IS NOT NULL
              AND "administrador_id" IS NOT NULL
            )
          )
      )
    `);

    // Evita más de una solicitud pendiente o suscripción
    // activa por usuario.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_suscripciones_usuario_en_proceso"
      ON "suscripciones" ("usuario_id")
      WHERE "estado" IN ('Solicitada', 'Activa')
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_suscripciones_estado_vencimiento"
      ON "suscripciones" ("estado", "vence_en")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_suscripciones_plan"
      ON "suscripciones" ("plan_id")
    `);

    // 4. Historial de renovaciones
    await queryRunner.query(`
      CREATE TABLE "renovaciones_suscripcion" (
        "id" SERIAL NOT NULL,
        "suscripcion_id" integer NOT NULL,
        "administrador_id" integer NOT NULL,
        "precio_aplicado" numeric(12, 2) NOT NULL,
        "moneda" character varying(3) NOT NULL,
        "periodo_desde" TIMESTAMP WITH TIME ZONE NOT NULL,
        "periodo_hasta" TIMESTAMP WITH TIME ZONE NOT NULL,
        "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_renovaciones_suscripcion" PRIMARY KEY ("id"),
        CONSTRAINT "FK_renovaciones_suscripcion"
          FOREIGN KEY ("suscripcion_id")
          REFERENCES "suscripciones"("id")
          ON DELETE RESTRICT,
        CONSTRAINT "FK_renovaciones_administrador"
          FOREIGN KEY ("administrador_id")
          REFERENCES "usuarios"("id")
          ON DELETE RESTRICT,
        CONSTRAINT "CHK_renovaciones_precio"
          CHECK ("precio_aplicado" > 0),
        CONSTRAINT "CHK_renovaciones_moneda"
          CHECK ("moneda" IN ('CRC', 'USD', 'EUR')),
        CONSTRAINT "CHK_renovaciones_periodo"
          CHECK ("periodo_hasta" > "periodo_desde")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_renovaciones_suscripcion_fecha"
      ON "renovaciones_suscripcion" ("suscripcion_id", "creado_en")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX "IDX_renovaciones_suscripcion_fecha"
    `);

    await queryRunner.query(`
      DROP TABLE "renovaciones_suscripcion"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_suscripciones_plan"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_suscripciones_estado_vencimiento"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_suscripciones_usuario_en_proceso"
    `);

    await queryRunner.query(`
      DROP TABLE "suscripciones"
    `);

    await queryRunner.query(`
      DROP TABLE "precios_patrocinio"
    `);

    await queryRunner.query(`
      DROP TABLE "planes_patrocinio"
    `);
  }
}
