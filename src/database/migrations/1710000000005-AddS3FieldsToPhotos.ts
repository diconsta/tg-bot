import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGoogleDriveFieldsToPhotos1710000000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add Google Drive fields to stage_photos table
    await queryRunner.query(
      `ALTER TABLE "stage_photos" ADD COLUMN "driveFileId" VARCHAR(1000)`,
    );
    await queryRunner.query(
      `ALTER TABLE "stage_photos" ADD COLUMN "driveUrl" VARCHAR(1000)`,
    );
    await queryRunner.query(
      `ALTER TABLE "stage_photos" ADD COLUMN "driveFolderPath" VARCHAR(500)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove Google Drive fields
    await queryRunner.query(
      `ALTER TABLE "stage_photos" DROP COLUMN IF EXISTS "driveFolderPath"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stage_photos" DROP COLUMN IF EXISTS "driveUrl"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stage_photos" DROP COLUMN IF EXISTS "driveFileId"`,
    );
  }
}
