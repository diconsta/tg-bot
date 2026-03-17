import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCoordinators1710000000001 implements MigrationInterface {
  name = 'AddCoordinators1710000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create coordinator_role enum
    await queryRunner.query(`
      CREATE TYPE "coordinator_role_enum" AS ENUM('ADMIN', 'COORDINATOR', 'VIEWER')
    `);

    // Create coordinators table
    await queryRunner.query(`
      CREATE TABLE "coordinators" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "telegramUserId" varchar(255) UNIQUE NOT NULL,
        "username" varchar(255),
        "firstName" varchar(255),
        "lastName" varchar(255),
        "role" "coordinator_role_enum" NOT NULL DEFAULT 'COORDINATOR',
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);

    // Create indexes on coordinators table
    await queryRunner.query(`
      CREATE INDEX "IDX_coordinators_telegramUserId" ON "coordinators" ("telegramUserId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_coordinators_role" ON "coordinators" ("role")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_coordinators_isActive" ON "coordinators" ("isActive")
    `);

    // Create junction table for many-to-many relationship
    await queryRunner.query(`
      CREATE TABLE "object_coordinators" (
        "object_id" uuid NOT NULL,
        "coordinator_id" uuid NOT NULL,
        PRIMARY KEY ("object_id", "coordinator_id"),
        CONSTRAINT "FK_object_coordinators_object"
          FOREIGN KEY ("object_id") REFERENCES "objects"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_object_coordinators_coordinator"
          FOREIGN KEY ("coordinator_id") REFERENCES "coordinators"("id")
          ON DELETE CASCADE
      )
    `);

    // Create indexes on junction table
    await queryRunner.query(`
      CREATE INDEX "IDX_object_coordinators_object" ON "object_coordinators" ("object_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_object_coordinators_coordinator" ON "object_coordinators" ("coordinator_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop junction table
    await queryRunner.query(`DROP TABLE "object_coordinators"`);

    // Drop coordinators table
    await queryRunner.query(`DROP TABLE "coordinators"`);

    // Drop enum
    await queryRunner.query(`DROP TYPE "coordinator_role_enum"`);
  }
}
