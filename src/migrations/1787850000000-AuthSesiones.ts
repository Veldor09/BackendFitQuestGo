import {MigrationInterface,QueryRunner,} from 'typeorm';

export class AuthSesiones1787850000000 implements MigrationInterface {
  name = 'AuthSesiones1787850000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "auth" RENAME COLUMN "token_hash" TO "hash_token"`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth" RENAME COLUMN "expires_at" TO "expira_en"`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth" RENAME COLUMN "revoked" TO "revocado"`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth" RENAME COLUMN "created_at" TO "creado_en"`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth" ADD "familia" uuid NOT NULL DEFAULT gen_random_uuid()`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth" ALTER COLUMN "familia" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth" ADD "agente_usuario" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth" ADD "ip" character varying(64)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_auth_familia" ON "auth" ("familia")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_auth_familia"`);
    await queryRunner.query(`ALTER TABLE "auth" DROP COLUMN "ip"`);
    await queryRunner.query(`ALTER TABLE "auth" DROP COLUMN "agente_usuario"`);
    await queryRunner.query(`ALTER TABLE "auth" DROP COLUMN "familia"`);
    await queryRunner.query(
      `ALTER TABLE "auth" RENAME COLUMN "creado_en" TO "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth" RENAME COLUMN "revocado" TO "revoked"`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth" RENAME COLUMN "expira_en" TO "expires_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth" RENAME COLUMN "hash_token" TO "token_hash"`,
    );
  }
}
