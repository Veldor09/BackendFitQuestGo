
import { MigrationInterface, QueryRunner } from 'typeorm';

export class InsigniasAmpliadas1792100000000
  implements MigrationInterface
{
  name = 'InsigniasAmpliadas1792100000000';

  private readonly codigosNuevos = [
    'KM_25',
    'KM_75',
    'KM_150',
    'KM_250',
    'KM_500',
    'KM_750',
    'KM_1000',
    'KM_2500',
    'RUTAS_5',
    'RUTAS_10',
    'RUTAS_20',
    'RUTAS_50',
    'RUTAS_100',
    'RUTAS_200',
    'ALERTAS_5',
    'ALERTAS_10',
    'ALERTAS_25',
    'ALERTAS_50',
    'ALERTAS_100',
    'NODOS_5',
    'NODOS_10',
    'NODOS_25',
    'NODOS_50',
    'NODOS_100',
    'ESPECIAL_MADRUGADOR',
    'ESPECIAL_NOCTURNO',
    'ESPECIAL_FIN_SEMANA',
    'ESPECIAL_COMUNITARIO',
    'ESPECIAL_VARIADO',
    'ESPECIAL_LEYENDA',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Incorporar la métrica de evaluación.
    await queryRunner.query(`
      ALTER TABLE "insignia"
      ADD COLUMN IF NOT EXISTS "metrica" character varying(20)
    `);

    // 2. Asociar las insignias originales con sus métricas.
    await queryRunner.query(`
      UPDATE "insignia"
      SET "metrica" = CASE
        WHEN "codigo" IN ('KM_10', 'KM_50', 'KM_100')
          THEN 'km'
        WHEN "codigo" = 'PRIMERA_RUTA'
          THEN 'rutas'
        WHEN "codigo" = 'PRIMERA_ALERTA'
          THEN 'alertas'
        WHEN "codigo" = 'PRIMER_PUNTO_INTERES'
          THEN 'nodos'
        WHEN "codigo" = 'ALERTA_LIKE'
          THEN 'especial'
        ELSE "metrica"
      END
      WHERE "codigo" IN (
        'KM_10',
        'KM_50',
        'KM_100',
        'PRIMERA_RUTA',
        'PRIMERA_ALERTA',
        'PRIMER_PUNTO_INTERES',
        'ALERTA_LIKE'
      )
    `);

    // 3. Insignias por kilómetros.
    await queryRunner.query(`
      INSERT INTO "insignia"
        ("codigo", "nombre", "descripcion", "emoji", "tipo", "metrica", "meta", "activa")
      VALUES
        ('KM_25', 'Explorador', 'Acumula 25 kilómetros en tus rutas.', '🧭', 'km', 'km', 25, true),
        ('KM_75', 'Aventurero', 'Acumula 75 kilómetros en tus rutas.', '🏕️', 'km', 'km', 75, true),
        ('KM_150', 'Gran caminante', 'Acumula 150 kilómetros en tus rutas.', '🥾', 'km', 'km', 150, true),
        ('KM_250', 'Sin fronteras', 'Acumula 250 kilómetros en tus rutas.', '🌎', 'km', 'km', 250, true),
        ('KM_500', 'Resistencia total', 'Acumula 500 kilómetros en tus rutas.', '💪', 'km', 'km', 500, true),
        ('KM_750', 'Viajero incansable', 'Acumula 750 kilómetros en tus rutas.', '🚴', 'km', 'km', 750, true),
        ('KM_1000', 'Leyenda del camino', 'Acumula 1000 kilómetros en tus rutas.', '👑', 'km', 'km', 1000, true),
        ('KM_2500', 'Conquistador de rutas', 'Acumula 2500 kilómetros en tus rutas.', '🌟', 'km', 'km', 2500, true)
      ON CONFLICT ("codigo") DO NOTHING
    `);

    // 4. Insignias por rutas.
    await queryRunner.query(`
      INSERT INTO "insignia"
        ("codigo", "nombre", "descripcion", "emoji", "tipo", "metrica", "meta", "activa")
      VALUES
        ('RUTAS_5', 'Primeros recorridos', 'Registra 5 rutas.', '🗺️', 'hito', 'rutas', 5, true),
        ('RUTAS_10', 'Explorador constante', 'Registra 10 rutas.', '🥾', 'hito', 'rutas', 10, true),
        ('RUTAS_20', 'Amante de las rutas', 'Registra 20 rutas.', '🏞️', 'hito', 'rutas', 20, true),
        ('RUTAS_50', 'Maestro de caminos', 'Registra 50 rutas.', '🧭', 'hito', 'rutas', 50, true),
        ('RUTAS_100', 'Centurión de rutas', 'Registra 100 rutas.', '🏆', 'hito', 'rutas', 100, true),
        ('RUTAS_200', 'Leyenda exploradora', 'Registra 200 rutas.', '👑', 'hito', 'rutas', 200, true)
      ON CONFLICT ("codigo") DO NOTHING
    `);

    // 5. Insignias por alertas.
    await queryRunner.query(`
      INSERT INTO "insignia"
        ("codigo", "nombre", "descripcion", "emoji", "tipo", "metrica", "meta", "activa")
      VALUES
        ('ALERTAS_5', 'Observador atento', 'Registra 5 alertas para la comunidad.', '👀', 'hito', 'alertas', 5, true),
        ('ALERTAS_10', 'Guardián del camino', 'Registra 10 alertas para la comunidad.', '🛡️', 'hito', 'alertas', 10, true),
        ('ALERTAS_25', 'Vigilante experto', 'Registra 25 alertas para la comunidad.', '🚨', 'hito', 'alertas', 25, true),
        ('ALERTAS_50', 'Protector comunitario', 'Registra 50 alertas para la comunidad.', '🤝', 'hito', 'alertas', 50, true),
        ('ALERTAS_100', 'Centinela legendario', 'Registra 100 alertas para la comunidad.', '🏅', 'hito', 'alertas', 100, true)
      ON CONFLICT ("codigo") DO NOTHING
    `);

    // 6. Insignias por puntos de interés.
    await queryRunner.query(`
      INSERT INTO "insignia"
        ("codigo", "nombre", "descripcion", "emoji", "tipo", "metrica", "meta", "activa")
      VALUES
        ('NODOS_5', 'Descubridor local', 'Registra 5 puntos de interés.', '📍', 'hito', 'nodos', 5, true),
        ('NODOS_10', 'Cartógrafo', 'Registra 10 puntos de interés.', '🗺️', 'hito', 'nodos', 10, true),
        ('NODOS_25', 'Guía de aventuras', 'Registra 25 puntos de interés.', '🧭', 'hito', 'nodos', 25, true),
        ('NODOS_50', 'Explorador de territorios', 'Registra 50 puntos de interés.', '🌄', 'hito', 'nodos', 50, true),
        ('NODOS_100', 'Maestro del mapa', 'Registra 100 puntos de interés.', '🌍', 'hito', 'nodos', 100, true)
      ON CONFLICT ("codigo") DO NOTHING
    `);

    // 7. Insignias especiales sin reglas automáticas implementadas.
    await queryRunner.query(`
      INSERT INTO "insignia"
        ("codigo", "nombre", "descripcion", "emoji", "tipo", "metrica", "meta", "activa")
      VALUES
        ('ESPECIAL_MADRUGADOR', 'Madrugador', 'Completa el desafío de actividad temprana.', '🌅', 'hito', 'especial', NULL, false),
        ('ESPECIAL_NOCTURNO', 'Explorador nocturno', 'Completa el desafío de actividad nocturna.', '🌙', 'hito', 'especial', NULL, false),
        ('ESPECIAL_FIN_SEMANA', 'Aventurero de fin de semana', 'Completa el desafío de fin de semana.', '🏕️', 'hito', 'especial', NULL, false),
        ('ESPECIAL_COMUNITARIO', 'Espíritu comunitario', 'Completa el desafío de participación comunitaria.', '🤝', 'hito', 'especial', NULL, false),
        ('ESPECIAL_VARIADO', 'Explorador versátil', 'Completa el desafío de actividades variadas.', '🎯', 'hito', 'especial', NULL, false),
        ('ESPECIAL_LEYENDA', 'Leyenda FitQuest', 'Completa el desafío legendario de FitQuest.', '💎', 'hito', 'especial', NULL, false)
      ON CONFLICT ("codigo") DO NOTHING
    `);

    // 8. Reconocimiento retroactivo de metas ya alcanzadas.
    //
    // Las métricas se calculan con los mismos criterios que
    // InsigniasService:
    // - Rutas y kilómetros: excluir rutas rechazadas.
    // - Alertas: contar las creadas por el usuario.
    // - Nodos: contar los creados por el usuario.
    //
    // Solo se insertan insignias activas con meta válida.
    // La restricción UNIQUE impide otorgarlas dos veces.
    await queryRunner.query(`
      WITH metricas_usuario AS (
        SELECT
          u."id" AS id_usuario,
          COALESCE(r.total_km, 0) AS total_km,
          COALESCE(r.total_rutas, 0) AS total_rutas,
          COALESCE(a.total_alertas, 0) AS total_alertas,
          COALESCE(n.total_nodos, 0) AS total_nodos
        FROM "usuarios" u
        LEFT JOIN (
          SELECT
            "creado_por" AS id_usuario,
            COALESCE(SUM("distancia_km"), 0) AS total_km,
            COUNT(*) AS total_rutas
          FROM "rutas"
          WHERE "estado" <> 'Rechazada'
          GROUP BY "creado_por"
        ) r ON r.id_usuario = u."id"
        LEFT JOIN (
          SELECT
            "creado_por" AS id_usuario,
            COUNT(*) AS total_alertas
          FROM "alertas"
          GROUP BY "creado_por"
        ) a ON a.id_usuario = u."id"
        LEFT JOIN (
          SELECT
            "creado_por" AS id_usuario,
            COUNT(*) AS total_nodos
          FROM "nodos"
          GROUP BY "creado_por"
        ) n ON n.id_usuario = u."id"
      )
      INSERT INTO "usuario_insignia"
        ("id_usuario", "id_insignia")
      SELECT
        m.id_usuario,
        i."id"
      FROM metricas_usuario m
      CROSS JOIN "insignia" i
      WHERE i."activa" = true
        AND i."metrica" IN ('km', 'rutas', 'alertas', 'nodos')
        AND i."meta" IS NOT NULL
        AND i."meta" > 0
        AND CASE i."metrica"
          WHEN 'km' THEN m.total_km
          WHEN 'rutas' THEN m.total_rutas
          WHEN 'alertas' THEN m.total_alertas
          WHEN 'nodos' THEN m.total_nodos
          ELSE 0
        END >= i."meta"
      ON CONFLICT ("id_usuario", "id_insignia") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Impedir la reversión si existen insignias nuevas obtenidas.
    const registros: Array<{ total: string }> =
      await queryRunner.query(
        `
        SELECT COUNT(*)::text AS total
        FROM "usuario_insignia" ui
        INNER JOIN "insignia" i
          ON i."id" = ui."id_insignia"
        WHERE i."codigo" = ANY($1::text[])
        `,
        [this.codigosNuevos],
      );

    const totalObtenidas = Number(registros[0]?.total ?? 0);

    if (totalObtenidas > 0) {
      throw new Error(
        'No se puede revertir InsigniasAmpliadas: existen insignias nuevas obtenidas por usuarios. Se requiere una migración de reversión que preserve el historial.',
      );
    }

    // Eliminar únicamente las 30 insignias incorporadas.
    await queryRunner.query(
      `
      DELETE FROM "insignia"
      WHERE "codigo" = ANY($1::text[])
      `,
      [this.codigosNuevos],
    );

    await queryRunner.query(`
      ALTER TABLE "insignia"
      DROP COLUMN IF EXISTS "metrica"
    `);
  }
}
