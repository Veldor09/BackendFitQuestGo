import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Pasa de texto libre a listas cerradas: `alertas.tipo`, `rutas.actividad`
 * (ahora un arreglo) y `nodos.categoria`. Los valores viejos que coinciden con
 * una clave se convierten; el resto queda como "otro" (con su texto original en
 * `tipo_otro` / `categoria_otro` donde existe).
 */
export class CatalogosCerrados1791300000000 implements MigrationInterface {
  name = 'CatalogosCerrados1791300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- alertas.tipo ---
    await queryRunner.query(
      `ALTER TABLE "alertas" ADD "tipo_otro" character varying(50)`,
    );
    await queryRunner.query(
      `UPDATE "alertas" SET
         "tipo_otro" = CASE WHEN m."clave" IS NULL THEN "alertas"."tipo" END,
         "tipo" = COALESCE(m."clave", 'otro')
       FROM (
         SELECT "id", CASE translate(lower("tipo"), 'áéíóúñ', 'aeioun')
           WHEN 'arbol caido' THEN 'arbol_caido'
           WHEN 'arbol_caido' THEN 'arbol_caido'
           WHEN 'arbol' THEN 'arbol_caido'
           WHEN 'bache' THEN 'bache'
           WHEN 'derrumbe' THEN 'derrumbe'
           WHEN 'inundacion' THEN 'inundacion'
           WHEN 'perro' THEN 'perro'
           WHEN 'perro bravo' THEN 'perro'
           WHEN 'via_cerrada' THEN 'via_cerrada'
           WHEN 'accidente' THEN 'accidente'
           WHEN 'zona_insegura' THEN 'zona_insegura'
           WHEN 'cable_caido' THEN 'cable_caido'
         END AS "clave"
         FROM "alertas"
       ) m
       WHERE "alertas"."id" = m."id"`,
    );

    // --- rutas.actividad -> rutas.actividades (text[]) ---
    await queryRunner.query(
      `ALTER TABLE "rutas" ADD "actividades" text array NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(
      `UPDATE "rutas" SET "actividades" = ARRAY[
         CASE translate(lower("actividad"), 'áéíóúñ', 'aeioun')
           WHEN 'running' THEN 'running'
           WHEN 'ciclismo' THEN 'ciclismo'
           WHEN 'mtb' THEN 'mtb'
           WHEN 'hiking' THEN 'hiking'
           WHEN 'caminata' THEN 'caminata'
           ELSE 'otro'
         END
       ]`,
    );
    await queryRunner.query(
      `ALTER TABLE "rutas" ALTER COLUMN "actividades" DROP DEFAULT`,
    );
    await queryRunner.query(`ALTER TABLE "rutas" DROP COLUMN "actividad"`);

    // --- nodos.categoria (+ texto "otro" y bandera de foto) ---
    await queryRunner.query(
      `ALTER TABLE "nodos" ADD "categoria_otro" character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "nodos" ADD "con_foto" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `UPDATE "nodos" SET
         "categoria_otro" = CASE WHEN m."clave" IS NULL THEN "nodos"."categoria" END,
         "categoria" = COALESCE(m."clave", 'otro')
       FROM (
         SELECT "id", CASE translate(lower("categoria"), 'áéíóúñ', 'aeioun')
           WHEN 'agua' THEN 'agua'
           WHEN 'mirador' THEN 'mirador'
           WHEN 'taller' THEN 'taller'
           WHEN 'restaurante' THEN 'restaurante'
           WHEN 'comercio' THEN 'comercio'
           WHEN 'banos' THEN 'banos'
           WHEN 'parqueo' THEN 'parqueo'
           WHEN 'primeros_auxilios' THEN 'primeros_auxilios'
         END AS "clave"
         FROM "nodos"
       ) m
       WHERE "nodos"."id" = m."id"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "nodos" DROP COLUMN "con_foto"`);
    await queryRunner.query(
      `UPDATE "nodos" SET "categoria" = COALESCE("categoria_otro", "categoria")`,
    );
    await queryRunner.query(`ALTER TABLE "nodos" DROP COLUMN "categoria_otro"`);

    await queryRunner.query(
      `ALTER TABLE "rutas" ADD "actividad" character varying(30) NOT NULL DEFAULT 'otro'`,
    );
    await queryRunner.query(
      `UPDATE "rutas" SET "actividad" = COALESCE("actividades"[1], 'otro')`,
    );
    await queryRunner.query(
      `ALTER TABLE "rutas" ALTER COLUMN "actividad" DROP DEFAULT`,
    );
    await queryRunner.query(`ALTER TABLE "rutas" DROP COLUMN "actividades"`);

    await queryRunner.query(
      `UPDATE "alertas" SET "tipo" = COALESCE("tipo_otro", "tipo")`,
    );
    await queryRunner.query(`ALTER TABLE "alertas" DROP COLUMN "tipo_otro"`);
  }
}
