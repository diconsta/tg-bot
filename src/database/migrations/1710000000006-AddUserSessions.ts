import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserSessions1710000000006 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "user_sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" character varying NOT NULL,
        "chatId" character varying NOT NULL,
        "threadId" character varying NOT NULL,
        "state" character varying NOT NULL DEFAULT 'AWAITING_PHOTOS',
        "objectId" character varying,
        "stageId" character varying,
        "stageIndex" integer,
        "stageName" character varying,
        "finishButtonMessageId" integer,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_sessions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_user_sessions_userId" ON "user_sessions" ("userId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_user_sessions_userId"`);
    await queryRunner.query(`DROP TABLE "user_sessions"`);
  }
}
