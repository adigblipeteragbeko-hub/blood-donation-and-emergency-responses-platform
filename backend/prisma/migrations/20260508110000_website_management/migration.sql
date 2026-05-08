-- CreateEnum
CREATE TYPE "WebsiteStatisticKey" AS ENUM ('REGISTERED_DONORS', 'EMERGENCY_MATCHES', 'PARTNER_HOSPITALS', 'REQUESTS_COMPLETED');

-- CreateTable
CREATE TABLE "WebsiteAlert" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "bloodType" "BloodGroup",
    "hospitalName" TEXT NOT NULL,
    "urgencyLevel" "PriorityLevel" NOT NULL DEFAULT 'HIGH',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "isSticky" BOOLEAN NOT NULL DEFAULT true,
    "isScrolling" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteStatistic" (
    "id" TEXT NOT NULL,
    "key" "WebsiteStatisticKey" NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "overrideValue" INTEGER,
    "isOverrideEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteStatistic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Faq" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Faq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Testimonial" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Testimonial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AwarenessPost" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "image" TEXT,
    "category" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AwarenessPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerHospital" (
    "id" TEXT NOT NULL,
    "hospitalName" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerHospital_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteFooterSettings" (
    "id" TEXT NOT NULL,
    "singletonKey" TEXT NOT NULL DEFAULT 'default',
    "emergencyPhonePrimary" TEXT NOT NULL,
    "emergencyPhoneSecondary" TEXT,
    "supportEmail" TEXT NOT NULL,
    "facebookUrl" TEXT,
    "instagramUrl" TEXT,
    "linkedinUrl" TEXT,
    "footerText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteFooterSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebsiteAlert_isActive_expiresAt_idx" ON "WebsiteAlert"("isActive", "expiresAt");

-- CreateIndex
CREATE INDEX "WebsiteAlert_createdAt_idx" ON "WebsiteAlert"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteStatistic_key_key" ON "WebsiteStatistic"("key");

-- CreateIndex
CREATE INDEX "Faq_isPublished_idx" ON "Faq"("isPublished");

-- CreateIndex
CREATE INDEX "Faq_createdAt_idx" ON "Faq"("createdAt");

-- CreateIndex
CREATE INDEX "Testimonial_isApproved_isPublished_idx" ON "Testimonial"("isApproved", "isPublished");

-- CreateIndex
CREATE INDEX "Testimonial_createdAt_idx" ON "Testimonial"("createdAt");

-- CreateIndex
CREATE INDEX "AwarenessPost_isPublished_idx" ON "AwarenessPost"("isPublished");

-- CreateIndex
CREATE INDEX "AwarenessPost_category_idx" ON "AwarenessPost"("category");

-- CreateIndex
CREATE INDEX "AwarenessPost_createdAt_idx" ON "AwarenessPost"("createdAt");

-- CreateIndex
CREATE INDEX "PartnerHospital_hospitalName_idx" ON "PartnerHospital"("hospitalName");

-- CreateIndex
CREATE INDEX "PartnerHospital_location_idx" ON "PartnerHospital"("location");

-- CreateIndex
CREATE INDEX "PartnerHospital_createdAt_idx" ON "PartnerHospital"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteFooterSettings_singletonKey_key" ON "WebsiteFooterSettings"("singletonKey");

