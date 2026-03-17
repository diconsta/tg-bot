import { MigrationInterface, QueryRunner } from 'typeorm';

export class MigrateToTelegramStorage1710000000004
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop old Google Drive columns
    await queryRunner.query(
      `ALTER TABLE "stage_photos" DROP COLUMN IF EXISTS "driveFileId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stage_photos" DROP COLUMN IF EXISTS "driveUrl"`,
    );

    // Add new Telegram storage columns
    await queryRunner.query(
      `ALTER TABLE "stage_photos" ADD COLUMN "telegramFileId" VARCHAR(500) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "stage_photos" ADD COLUMN "telegramFileUniqueId" VARCHAR(500)`,
    );
    await queryRunner.query(
      `ALTER TABLE "stage_photos" ADD COLUMN "fileName" VARCHAR(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "stage_photos" ADD COLUMN "fileSize" INT`,
    );

    // Remove default constraint after adding column
    await queryRunner.query(
      `ALTER TABLE "stage_photos" ALTER COLUMN "telegramFileId" DROP DEFAULT`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore Google Drive columns
    await queryRunner.query(
      `ALTER TABLE "stage_photos" ADD COLUMN "driveFileId" VARCHAR(500)`,
    );
    await queryRunner.query(
      `ALTER TABLE "stage_photos" ADD COLUMN "driveUrl" TEXT`,
    );

    // Drop Telegram columns
    await queryRunner.query(
      `ALTER TABLE "stage_photos" DROP COLUMN IF EXISTS "telegramFileId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stage_photos" DROP COLUMN IF EXISTS "telegramFileUniqueId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stage_photos" DROP COLUMN IF EXISTS "fileName"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stage_photos" DROP COLUMN IF EXISTS "fileSize"`,
    );
  }
}
