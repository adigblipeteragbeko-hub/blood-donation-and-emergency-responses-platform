-- CreateEnum
CREATE TYPE "WebsiteAnnouncementType" AS ENUM ('ALERT', 'AWARENESS', 'SYSTEM');

-- CreateTable
CREATE TABLE "WebsiteAnnouncement" (
    "id" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "sourceType" "WebsiteAnnouncementType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "priority" "PriorityLevel" NOT NULL DEFAULT 'MEDIUM',
    "badge" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteAnnouncementRead" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebsiteAnnouncementRead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteAnnouncement_sourceKey_key" ON "WebsiteAnnouncement"("sourceKey");

-- CreateIndex
CREATE INDEX "WebsiteAnnouncement_sourceType_isPublished_idx" ON "WebsiteAnnouncement"("sourceType", "isPublished");

-- CreateIndex
CREATE INDEX "WebsiteAnnouncement_expiresAt_idx" ON "WebsiteAnnouncement"("expiresAt");

-- CreateIndex
CREATE INDEX "WebsiteAnnouncement_createdAt_idx" ON "WebsiteAnnouncement"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteAnnouncementRead_announcementId_userId_key" ON "WebsiteAnnouncementRead"("announcementId", "userId");

-- CreateIndex
CREATE INDEX "WebsiteAnnouncementRead_userId_readAt_idx" ON "WebsiteAnnouncementRead"("userId", "readAt");

-- AddForeignKey
ALTER TABLE "WebsiteAnnouncementRead" ADD CONSTRAINT "WebsiteAnnouncementRead_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "WebsiteAnnouncement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteAnnouncementRead" ADD CONSTRAINT "WebsiteAnnouncementRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
