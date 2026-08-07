-- Add nullable account avatar and hospital logo fields without affecting existing records.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "profileImageUrl" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "profileImageUpdatedAt" TIMESTAMP(3);

ALTER TABLE "Hospital" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;
ALTER TABLE "Hospital" ADD COLUMN IF NOT EXISTS "logoUpdatedAt" TIMESTAMP(3);
