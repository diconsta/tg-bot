import { MigrationInterface, QueryRunner } from 'typeorm';

export class RefactorToMasterStages1710000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create master_stages table
    await queryRunner.query(`
      CREATE TABLE "master_stages" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "stageIndex" int NOT NULL UNIQUE,
        "stageName" varchar(255) NOT NULL,
        "description" text,
        "orderNo" int NOT NULL,
        "active" boolean NOT NULL DEFAULT true,
        "createdAt" timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_master_stages_stageIndex" ON "master_stages" ("stageIndex")
    `);

    // 2. Seed master stages with Polish stages
    await queryRunner.query(`
      INSERT INTO "master_stages" ("stageIndex", "stageName", "description", "orderNo", "active")
      VALUES
        (1, 'Demontaż', 'Prace rozbiórkowe', 1, true),
        (2, 'Instalacje', 'Elektryka + hydraulika', 2, true),
        (3, 'Tynki / gładzie', 'Przygotowanie ścian', 3, true),
        (4, 'Płytki', 'Układanie płytek', 4, true),
        (5, 'Malowanie', 'Malowanie ścian i sufitów', 5, true),
        (6, 'Biały montaż', 'Armatura, gniazdka, lampy', 6, true)
    `);

    // 3. Create object_stages junction table
    await queryRunner.query(`
      CREATE TABLE "object_stages" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "objectId" uuid NOT NULL,
        "stageId" uuid NOT NULL,
        "isCompleted" boolean NOT NULL DEFAULT false,
        "completedAt" timestamp,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_object_stages_objectId" FOREIGN KEY ("objectId")
          REFERENCES "objects"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_object_stages_stageId" FOREIGN KEY ("stageId")
          REFERENCES "master_stages"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_object_stage" UNIQUE ("objectId", "stageId")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_object_stages_objectId" ON "object_stages" ("objectId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_object_stages_stageId" ON "object_stages" ("stageId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_object_stages_isCompleted" ON "object_stages" ("isCompleted")
    `);

    // 4. Migrate data from old stages table to object_stages
    // For each existing object, create object_stage records linking to master_stages
    await queryRunner.query(`
      INSERT INTO "object_stages" ("objectId", "stageId", "isCompleted", "completedAt", "createdAt")
      SELECT
        s."objectId",
        ms."id" as "stageId",
        s."isCompleted",
        s."completedAt",
        s."createdAt"
      FROM "stages" s
      INNER JOIN "master_stages" ms ON s."stageNumber" = ms."stageIndex"
    `);

    // 5. Add currentStageId column to objects table
    await queryRunner.query(`
      ALTER TABLE "objects"
      ADD COLUMN "currentStageId" uuid
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_objects_currentStageId" ON "objects" ("currentStageId")
    `);

    // 6. Update objects.currentStageId based on currentStage number
    await queryRunner.query(`
      UPDATE "objects" o
      SET "currentStageId" = ms."id"
      FROM "master_stages" ms
      WHERE ms."stageIndex" = o."currentStage"
    `);

    // 7. Add FK constraint for currentStageId
    await queryRunner.query(`
      ALTER TABLE "objects"
      ADD CONSTRAINT "FK_objects_currentStageId"
      FOREIGN KEY ("currentStageId") REFERENCES "master_stages"("id")
    `);

    // 8. Update stage_photos table to use stageId instead of stageNumber
    await queryRunner.query(`
      ALTER TABLE "stage_photos"
      ADD COLUMN "stageId" uuid
    `);

    await queryRunner.query(`
      UPDATE "stage_photos" sp
      SET "stageId" = ms."id"
      FROM "master_stages" ms
      WHERE ms."stageIndex" = sp."stageNumber"
    `);

    await queryRunner.query(`
      ALTER TABLE "stage_photos"
      ALTER COLUMN "stageId" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "stage_photos"
      ADD CONSTRAINT "FK_stage_photos_stageId"
      FOREIGN KEY ("stageId") REFERENCES "master_stages"("id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_stage_photos_stageId" ON "stage_photos" ("stageId")
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_stage_photos_objectId_stageNumber"
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_stage_photos_objectId_stageId" ON "stage_photos" ("objectId", "stageId")
    `);

    await queryRunner.query(`
      ALTER TABLE "stage_photos"
      DROP COLUMN "stageNumber"
    `);

    // 9. Update stage_history table to use stageId instead of stageNumber
    await queryRunner.query(`
      ALTER TABLE "stage_history"
      ADD COLUMN "stageId" uuid
    `);

    await queryRunner.query(`
      UPDATE "stage_history" sh
      SET "stageId" = ms."id"
      FROM "master_stages" ms
      WHERE ms."stageIndex" = sh."stageNumber"
    `);

    await queryRunner.query(`
      ALTER TABLE "stage_history"
      ALTER COLUMN "stageId" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "stage_history"
      ADD CONSTRAINT "FK_stage_history_stageId"
      FOREIGN KEY ("stageId") REFERENCES "master_stages"("id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_stage_history_stageId" ON "stage_history" ("stageId")
    `);

    await queryRunner.query(`
      ALTER TABLE "stage_history"
      DROP COLUMN "stageNumber"
    `);

    // 10. Drop old currentStage column from objects
    await queryRunner.query(`
      ALTER TABLE "objects"
      DROP COLUMN "currentStage"
    `);

    // 11. Drop old stages table
    await queryRunner.query(`
      DROP TABLE IF EXISTS "stages" CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // This is a significant schema change, down migration would be complex
    // Recreate old structures for rollback if needed
    throw new Error('Down migration not implemented for RefactorToMasterStages');
  }
}
