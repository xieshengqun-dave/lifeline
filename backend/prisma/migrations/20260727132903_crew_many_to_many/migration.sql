-- Crew assignment: single Booking.crewId -> many-to-many (operator picks any team).
-- Reordered from the generated diff so existing assignments survive: create the
-- join table first, copy the old crewId values in, then drop the column.

-- CreateTable
CREATE TABLE "_BookingToCrew" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_BookingToCrew_AB_unique" ON "_BookingToCrew"("A", "B");

-- CreateIndex
CREATE INDEX "_BookingToCrew_B_index" ON "_BookingToCrew"("B");

-- AddForeignKey
ALTER TABLE "_BookingToCrew" ADD CONSTRAINT "_BookingToCrew_A_fkey" FOREIGN KEY ("A") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BookingToCrew" ADD CONSTRAINT "_BookingToCrew_B_fkey" FOREIGN KEY ("B") REFERENCES "Crew"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve existing single-crew assignments
INSERT INTO "_BookingToCrew" ("A", "B")
SELECT "id", "crewId" FROM "Booking" WHERE "crewId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_crewId_fkey";

-- AlterTable
ALTER TABLE "Booking" DROP COLUMN "crewId";
