import { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificacionesEInsignias1791600000000 implements MigrationInterface {
  name = 'NotificacionesEInsignias1791600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Crear tabla notificacion
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notificacion" (
        "id" SERIAL NOT NULL,
        "id_usuario" integer NOT NULL,
        "categoria" character varying(50) NOT NULL,
        "titulo" character varying(160) NOT NULL,
        "mensaje" text NOT NULL,
        "leida" boolean NOT NULL DEFAULT false,
        "referencia_tipo" character varying(50),
        "referencia_id" integer,
        "creada_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notificacion" PRIMARY KEY ("id"),
        CONSTRAINT "FK_notificacion_usuario" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notificacion_usuario_leida_creada" ON "notificacion" ("id_usuario", "leida", "creada_en" DESC)
    `);

    // 2. Crear tabla insignia (catálogo)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "insignia" (
        "id" SERIAL NOT NULL,
        "codigo" character varying(50) NOT NULL,
        "nombre" character varying(100) NOT NULL,
        "descripcion" text NOT NULL,
        "emoji" character varying(10) NOT NULL,
        "tipo" character varying(20) NOT NULL,
        "meta" numeric(10,2),
        "activa" boolean NOT NULL DEFAULT true,
        CONSTRAINT "UQ_insignia_codigo" UNIQUE ("codigo"),
        CONSTRAINT "PK_insignia" PRIMARY KEY ("id")
      )
    `);

    // 3. Crear tabla usuario_insignia
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "usuario_insignia" (
        "id" SERIAL NOT NULL,
        "id_usuario" integer NOT NULL,
        "id_insignia" integer NOT NULL,
        "obtenida_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_usuario_insignia" UNIQUE ("id_usuario", "id_insignia"),
        CONSTRAINT "PK_usuario_insignia" PRIMARY KEY ("id"),
        CONSTRAINT "FK_usuario_insignia_usuario" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_usuario_insignia_insignia" FOREIGN KEY ("id_insignia") REFERENCES "insignia"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_usuario_insignia_usuario" ON "usuario_insignia" ("id_usuario")
    `);

    // 4. Seed del catálogo inicial de insignias
    await queryRunner.query(`
      INSERT INTO "insignia" ("codigo", "nombre", "descripcion", "emoji", "tipo", "meta", "activa")
      VALUES
        ('PRIMERA_RUTA', 'Primera ruta', 'Crea tu primera ruta', '🥾', 'hito', 1, true),
        ('PRIMERA_ALERTA', 'Vigilante', 'Reporta tu primera alerta', '⚠️', 'hito', 1, true),
        ('PRIMER_PUNTO_INTERES', 'Descubridor', 'Crea tu primer punto de interés', '📍', 'hito', 1, true),
        ('KM_10', 'Principiante', 'Recorre 10 km acumulados', '🌱', 'km', 10, true),
        ('KM_50', 'Veterano', 'Recorre 50 km acumulados', '🏆', 'km', 50, true),
        ('KM_100', 'Experto', 'Recorre 100 km acumulados', '🚀', 'km', 100, true),
        ('ALERTA_LIKE', 'Aliado de la comunidad', 'Recibe tu primer "me gusta" en una alerta', '👍', 'hito', 1, false)
      ON CONFLICT ("codigo") DO NOTHING
    `);

    // 5. Backfill opcional: otorgar insignias que los usuarios existentes ya cumplen sin notificaciones
    // PRIMERA_RUTA
    await queryRunner.query(`
      INSERT INTO "usuario_insignia" ("id_usuario", "id_insignia", "obtenida_en")
      SELECT DISTINCT r.creado_por, i.id, now()
      FROM "rutas" r
      CROSS JOIN "insignia" i
      WHERE i.codigo = 'PRIMERA_RUTA'
      ON CONFLICT ("id_usuario", "id_insignia") DO NOTHING
    `);

    // PRIMERA_ALERTA
    await queryRunner.query(`
      INSERT INTO "usuario_insignia" ("id_usuario", "id_insignia", "obtenida_en")
      SELECT DISTINCT a.creado_por, i.id, now()
      FROM "alertas" a
      CROSS JOIN "insignia" i
      WHERE i.codigo = 'PRIMERA_ALERTA'
      ON CONFLICT ("id_usuario", "id_insignia") DO NOTHING
    `);

    // PRIMER_PUNTO_INTERES
    await queryRunner.query(`
      INSERT INTO "usuario_insignia" ("id_usuario", "id_insignia", "obtenida_en")
      SELECT DISTINCT n.creado_por, i.id, now()
      FROM "nodos" n
      CROSS JOIN "insignia" i
      WHERE i.codigo = 'PRIMER_PUNTO_INTERES'
      ON CONFLICT ("id_usuario", "id_insignia") DO NOTHING
    `);

    // KM_10
    await queryRunner.query(`
      INSERT INTO "usuario_insignia" ("id_usuario", "id_insignia", "obtenida_en")
      SELECT r.creado_por, i.id, now()
      FROM "rutas" r
      CROSS JOIN "insignia" i
      WHERE i.codigo = 'KM_10' AND r.estado != 'Rechazada'
      GROUP BY r.creado_por, i.id
      HAVING SUM(CAST(r.distancia_km AS float)) >= 10
      ON CONFLICT ("id_usuario", "id_insignia") DO NOTHING
    `);

    // KM_50
    await queryRunner.query(`
      INSERT INTO "usuario_insignia" ("id_usuario", "id_insignia", "obtenida_en")
      SELECT r.creado_por, i.id, now()
      FROM "rutas" r
      CROSS JOIN "insignia" i
      WHERE i.codigo = 'KM_50' AND r.estado != 'Rechazada'
      GROUP BY r.creado_por, i.id
      HAVING SUM(CAST(r.distancia_km AS float)) >= 50
      ON CONFLICT ("id_usuario", "id_insignia") DO NOTHING
    `);

    // KM_100
    await queryRunner.query(`
      INSERT INTO "usuario_insignia" ("id_usuario", "id_insignia", "obtenida_en")
      SELECT r.creado_por, i.id, now()
      FROM "rutas" r
      CROSS JOIN "insignia" i
      WHERE i.codigo = 'KM_100' AND r.estado != 'Rechazada'
      GROUP BY r.creado_por, i.id
      HAVING SUM(CAST(r.distancia_km AS float)) >= 100
      ON CONFLICT ("id_usuario", "id_insignia") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "usuario_insignia"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "insignia"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notificacion"`);
  }
}
