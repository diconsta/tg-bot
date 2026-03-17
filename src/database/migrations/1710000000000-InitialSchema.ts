import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1710000000000 implements MigrationInterface {
  name = 'InitialSchema1710000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "object_status_enum" AS ENUM('ACTIVE', 'DONE', 'ARCHIVED')
    `);

    await queryRunner.query(`
      CREATE TYPE "history_action_enum" AS ENUM('PHOTO_ADDED', 'STAGE_COMPLETED', 'PAUSED', 'RESUMED')
    `);

    await queryRunner.query(`
      CREATE TABLE "objects" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "telegramChatId" varchar(255) NOT NULL,
        "telegramThreadId" varchar(255) NOT NULL,
        "name" varchar(500) NOT NULL,
        "currentStage" int NOT NULL DEFAULT 1,
        "paused" boolean NOT NULL DEFAULT false,
        "status" "object_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "lastPromptAt" timestamp,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_objects_chat_thread" UNIQUE ("telegramChatId", "telegramThreadId")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_objects_telegramChatId" ON "objects" ("telegramChatId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_objects_telegramThreadId" ON "objects" ("telegramThreadId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_objects_paused" ON "objects" ("paused")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_objects_status" ON "objects" ("status")
    `);

    await queryRunner.query(`
      CREATE TABLE "stages" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "objectId" uuid NOT NULL,
        "stageNumber" int NOT NULL,
        "stageName" varchar(255) NOT NULL,
        "isCompleted" boolean NOT NULL DEFAULT false,
        "completedAt" timestamp,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_stages_object_number" UNIQUE ("objectId", "stageNumber"),
        CONSTRAINT "FK_stages_object" FOREIGN KEY ("objectId") REFERENCES "objects"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_stages_objectId" ON "stages" ("objectId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_stages_isCompleted" ON "stages" ("isCompleted")
    `);

    await queryRunner.query(`
      CREATE TABLE "stage_photos" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "objectId" uuid NOT NULL,
        "stageNumber" int NOT NULL,
        "driveFileId" varchar(500) NOT NULL,
        "driveUrl" text NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_stage_photos_object" FOREIGN KEY ("objectId") REFERENCES "objects"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_stage_photos_objectId" ON "stage_photos" ("objectId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_stage_photos_object_stage" ON "stage_photos" ("objectId", "stageNumber")
    `);

    await queryRunner.query(`
      CREATE TABLE "stage_history" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "objectId" uuid NOT NULL,
        "stageNumber" int NOT NULL,
        "action" "history_action_enum" NOT NULL,
        "telegramUserId" varchar(255),
        "username" varchar(255),
        "createdAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_stage_history_object" FOREIGN KEY ("objectId") REFERENCES "objects"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_stage_history_objectId" ON "stage_history" ("objectId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_stage_history_action" ON "stage_history" ("action")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_stage_history_object_created" ON "stage_history" ("objectId", "createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "stage_history"`);
    await queryRunner.query(`DROP TABLE "stage_photos"`);
    await queryRunner.query(`DROP TABLE "stages"`);
    await queryRunner.query(`DROP TABLE "objects"`);
    await queryRunner.query(`DROP TYPE "history_action_enum"`);
    await queryRunner.query(`DROP TYPE "object_status_enum"`);
  }
}
