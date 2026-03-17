import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMediaGroupCache1710000000007 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "media_group_cache" (
        "mediaGroupId" character varying NOT NULL,
        "messageId" integer NOT NULL,
        "chatId" character varying NOT NULL,
        "threadId" character varying NOT NULL,
        "pendingPhotos" jsonb NOT NULL DEFAULT '[]',
        "finalized" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_media_group_cache" PRIMARY KEY ("mediaGroupId")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "media_group_cache"`);
  }
}
