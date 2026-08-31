import {MigrationInterface,QueryRunner,} from "typeorm";

export class SCHEMA1787847558197 implements MigrationInterface {
    name = 'SCHEMA1787847558197'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "auth" ("id_auth" SERIAL NOT NULL, "usuario_id" integer NOT NULL, "token_hash" character varying(255) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_9552f30faf90cda27f22ac30048" UNIQUE ("token_hash"), CONSTRAINT "PK_5654a22ae06f14f6b24a58de81d" PRIMARY KEY ("id_auth"))`);
        await queryRunner.query(`CREATE INDEX "IDX_8cddcc57699c6398b7be7ca52e" ON "auth" ("usuario_id") `);
        await queryRunner.query(`CREATE TABLE "roles" ("idrol" SERIAL NOT NULL, "nombre_rol" character varying(100) NOT NULL, CONSTRAINT "UQ_a722dfef88f835ff0933fda8c8d" UNIQUE ("nombre_rol"), CONSTRAINT "PK_a6d20216de10514c37ae8d2dfef" PRIMARY KEY ("idrol"))`);
        await queryRunner.query(`CREATE TABLE "usuarios" ("id" SERIAL NOT NULL, "nombre_user" character varying(100) NOT NULL, "email_user" character varying(100) NOT NULL, "password_user_hash" character varying(255) NOT NULL, "idrol" integer NOT NULL, CONSTRAINT "UQ_f80a5d657f293009a31f2835f2e" UNIQUE ("email_user"), CONSTRAINT "PK_d7281c63c176e152e4c531594a8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "auth" ADD CONSTRAINT "FK_8cddcc57699c6398b7be7ca52eb" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "usuarios" ADD CONSTRAINT "FK_0d94abdffa184bdfad7c75c2fd6" FOREIGN KEY ("idrol") REFERENCES "roles"("idrol") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "usuarios" DROP CONSTRAINT "FK_0d94abdffa184bdfad7c75c2fd6"`);
        await queryRunner.query(`ALTER TABLE "auth" DROP CONSTRAINT "FK_8cddcc57699c6398b7be7ca52eb"`);
        await queryRunner.query(`DROP TABLE "usuarios"`);
        await queryRunner.query(`DROP TABLE "roles"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8cddcc57699c6398b7be7ca52e"`);
        await queryRunner.query(`DROP TABLE "auth"`);
    }

}
