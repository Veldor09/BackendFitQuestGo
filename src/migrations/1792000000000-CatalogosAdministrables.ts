
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CatalogosAdministrables1792000000000
  implements MigrationInterface
{
  name = 'CatalogosAdministrables1792000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "catalogo_items" (
        "id" SERIAL NOT NULL,
        "catalogo" character varying(30) NOT NULL,
        "clave" character varying(50) NOT NULL,
        "nombre" character varying(100) NOT NULL,
        "activo" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_catalogo_items" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_catalogo_items_catalogo_clave"
          UNIQUE ("catalogo", "clave")
      )
    `);

    await queryRunner.query(`
      INSERT INTO "catalogo_items" ("catalogo", "clave", "nombre")
      VALUES
        ('alertas', 'arbol_caido', 'Árbol caído'),
        ('alertas', 'bache', 'Bache'),
        ('alertas', 'derrumbe', 'Derrumbe'),
        ('alertas', 'inundacion', 'Inundación'),
        ('alertas', 'perro', 'Perro'),
        ('alertas', 'via_cerrada', 'Vía cerrada'),
        ('alertas', 'accidente', 'Accidente'),
        ('alertas', 'zona_insegura', 'Zona insegura'),
        ('alertas', 'cable_caido', 'Cable caído'),
        ('alertas', 'otro', 'Otro'),

        ('nodos', 'agua', 'Agua'),
        ('nodos', 'mirador', 'Mirador'),
        ('nodos', 'taller', 'Taller'),
        ('nodos', 'restaurante', 'Restaurante'),
        ('nodos', 'comercio', 'Comercio'),
        ('nodos', 'banos', 'Baños'),
        ('nodos', 'parqueo', 'Parqueo'),
        ('nodos', 'primeros_auxilios', 'Primeros auxilios'),
        ('nodos', 'otro', 'Otro'),

        ('actividades', 'running', 'Running'),
        ('actividades', 'ciclismo', 'Ciclismo'),
        ('actividades', 'mtb', 'MTB'),
        ('actividades', 'hiking', 'Hiking'),
        ('actividades', 'caminata', 'Caminata'),
        ('actividades', 'otro', 'Otro')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "catalogo_items"');
  }
}
