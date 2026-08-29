import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUsuarios1787519021297 implements MigrationInterface {
    name = 'CreateUsuarios1787519021297'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "usuarios" ("id" SERIAL NOT NULL, "nombre" character varying(100) NOT NULL, "edad" integer NOT NULL, CONSTRAINT "PK_d7281c63c176e152e4c531594a8" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "usuarios"`);
    }

}
