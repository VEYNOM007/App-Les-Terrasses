-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ACHETEUR', 'COMMERCIAL', 'ADMIN', 'ARTISAN');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('NON_SOUMIS', 'EN_ATTENTE', 'VALIDE', 'REJETE');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('BROUILLON', 'PUBLIE', 'COMPLET');

-- CreateEnum
CREATE TYPE "UnitType" AS ENUM ('STUDIO', 'T2', 'T3', 'T4', 'T5', 'COMMERCE');

-- CreateEnum
CREATE TYPE "Frontage" AS ENUM ('FACADE_PRINCIPALE', 'FACADE_SECONDAIRE', 'INTERIEUR_ILOT', 'MITOYEN');

-- CreateEnum
CREATE TYPE "UnitStatus" AS ENUM ('DISPONIBLE', 'RESERVE', 'VENDU', 'LIVRE');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('EN_ATTENTE', 'CONFIRMEE', 'ANNULEE', 'LIVREE');

-- CreateEnum
CREATE TYPE "InstallmentStatus" AS ENUM ('EN_ATTENTE', 'PAYE', 'EN_RETARD', 'ECHEC');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('CINETPAY', 'STRIPE', 'MOBILE_MONEY');

-- CreateEnum
CREATE TYPE "ConstructionPhase" AS ENUM ('FONDATIONS', 'GROS_OEUVRE', 'SECOND_OEUVRE', 'FINITIONS', 'LIVRE');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('CONTRAT', 'ATTESTATION', 'QUITTANCE', 'PIECE_IDENTITE', 'DEVIS');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('PUSH', 'EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "ArtisanTrade" AS ENUM ('MACONNERIE', 'ELECTRICITE', 'PLOMBERIE', 'MENUISERIE', 'PEINTURE', 'CARRELAGE', 'TOITURE', 'AUTRE');

-- CreateEnum
CREATE TYPE "ArtisanStatus" AS ENUM ('ACTIF', 'SUSPENDU', 'ARCHIVE');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('PROPOSEE', 'ACCEPTEE', 'EN_COURS', 'TERMINEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('BROUILLON', 'ENVOYE', 'ACCEPTE', 'REFUSE');

-- CreateEnum
CREATE TYPE "LaunchStatus" AS ENUM ('EN_COMMERCIALISATION', 'SEUIL_ATTEINT', 'FINANCEMENT_EN_COURS', 'EN_CONSTRUCTION', 'LIVRE');

-- CreateEnum
CREATE TYPE "ParkingType" AS ENUM ('SOUS_PILOTIS', 'AUVENT_SOLAIRE', 'AUVENT_CLASSIQUE');

-- CreateEnum
CREATE TYPE "ParkingSpotStatus" AS ENUM ('LIBRE', 'ATTRIBUE', 'MAINTENANCE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'TG',
    "role" "UserRole" NOT NULL DEFAULT 'ACHETEUR',
    "kycStatus" "KycStatus" NOT NULL DEFAULT 'NON_SOUMIS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT NOT NULL,
    "amenities" TEXT[],
    "coverImage" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'BROUILLON',
    "siteMapImageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocks" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "floors" INTEGER NOT NULL,
    "frontage" "Frontage" NOT NULL DEFAULT 'INTERIEUR_ILOT',
    "distanceFromEntranceM" INTEGER,
    "sitePlanPolygon" JSONB,
    "constructionPhase" "ConstructionPhase" NOT NULL DEFAULT 'FONDATIONS',
    "progressPercent" INTEGER NOT NULL DEFAULT 0,
    "launchStatus" "LaunchStatus" NOT NULL DEFAULT 'EN_COMMERCIALISATION',
    "fundingThresholdPercent" INTEGER NOT NULL DEFAULT 60,
    "thresholdReachedAt" TIMESTAMP(3),
    "financingSecuredAt" TIMESTAMP(3),
    "constructionStartedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units" (
    "id" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "type" "UnitType" NOT NULL,
    "surface" DOUBLE PRECISION NOT NULL,
    "floor" INTEGER NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "planImage" TEXT,
    "photos" TEXT[],
    "status" "UnitStatus" NOT NULL DEFAULT 'DISPONIBLE',
    "hasStorefront" BOOLEAN NOT NULL DEFAULT false,
    "streetFacing" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'EN_ATTENTE',
    "lockExpiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_schedules" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_installments" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "InstallmentStatus" NOT NULL DEFAULT 'EN_ATTENTE',
    "provider" "PaymentProvider",
    "providerRef" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "construction_updates" (
    "id" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "phase" "ConstructionPhase" NOT NULL,
    "progressPercent" INTEGER NOT NULL,
    "description" TEXT,
    "photos" TEXT[],
    "publishedById" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "construction_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "name" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "reservationId" TEXT,
    "kycOwnerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "push" BOOLEAN NOT NULL DEFAULT true,
    "email" BOOLEAN NOT NULL DEFAULT true,
    "sms" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artisans" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "trade" "ArtisanTrade" NOT NULL,
    "status" "ArtisanStatus" NOT NULL DEFAULT 'ACTIF',
    "tradeLicenseUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "artisans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artisan_assignments" (
    "id" TEXT NOT NULL,
    "artisanId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'PROPOSEE',
    "scope" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "artisan_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" TEXT NOT NULL,
    "artisanId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "description" TEXT NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'BROUILLON',
    "documentUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parking_spots" (
    "id" TEXT NOT NULL,
    "blockId" TEXT,
    "numero" TEXT NOT NULL,
    "type" "ParkingType" NOT NULL,
    "status" "ParkingSpotStatus" NOT NULL DEFAULT 'LIBRE',
    "reservationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parking_spots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "projects_status_idx" ON "projects"("status");

-- CreateIndex
CREATE INDEX "blocks_projectId_idx" ON "blocks"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "blocks_projectId_name_key" ON "blocks"("projectId", "name");

-- CreateIndex
CREATE INDEX "units_blockId_status_idx" ON "units"("blockId", "status");

-- CreateIndex
CREATE INDEX "units_type_status_idx" ON "units"("type", "status");

-- CreateIndex
CREATE INDEX "reservations_userId_idx" ON "reservations"("userId");

-- CreateIndex
CREATE INDEX "reservations_status_lockExpiresAt_idx" ON "reservations"("status", "lockExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "payment_schedules_reservationId_key" ON "payment_schedules"("reservationId");

-- CreateIndex
CREATE INDEX "payment_installments_scheduleId_idx" ON "payment_installments"("scheduleId");

-- CreateIndex
CREATE INDEX "payment_installments_status_dueDate_idx" ON "payment_installments"("status", "dueDate");

-- CreateIndex
CREATE INDEX "construction_updates_blockId_publishedAt_idx" ON "construction_updates"("blockId", "publishedAt");

-- CreateIndex
CREATE INDEX "documents_reservationId_idx" ON "documents"("reservationId");

-- CreateIndex
CREATE INDEX "notifications_userId_read_idx" ON "notifications"("userId", "read");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_userId_key" ON "notification_preferences"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "artisans_userId_key" ON "artisans"("userId");

-- CreateIndex
CREATE INDEX "artisans_trade_status_idx" ON "artisans"("trade", "status");

-- CreateIndex
CREATE INDEX "artisan_assignments_blockId_status_idx" ON "artisan_assignments"("blockId", "status");

-- CreateIndex
CREATE INDEX "artisan_assignments_artisanId_status_idx" ON "artisan_assignments"("artisanId", "status");

-- CreateIndex
CREATE INDEX "quotes_blockId_status_idx" ON "quotes"("blockId", "status");

-- CreateIndex
CREATE INDEX "quotes_artisanId_idx" ON "quotes"("artisanId");

-- CreateIndex
CREATE UNIQUE INDEX "parking_spots_numero_key" ON "parking_spots"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "parking_spots_reservationId_key" ON "parking_spots"("reservationId");

-- CreateIndex
CREATE INDEX "parking_spots_status_type_idx" ON "parking_spots"("status", "type");

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_schedules" ADD CONSTRAINT "payment_schedules_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_installments" ADD CONSTRAINT "payment_installments_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "payment_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "construction_updates" ADD CONSTRAINT "construction_updates_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "blocks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "construction_updates" ADD CONSTRAINT "construction_updates_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_kycOwnerId_fkey" FOREIGN KEY ("kycOwnerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artisans" ADD CONSTRAINT "artisans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artisan_assignments" ADD CONSTRAINT "artisan_assignments_artisanId_fkey" FOREIGN KEY ("artisanId") REFERENCES "artisans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artisan_assignments" ADD CONSTRAINT "artisan_assignments_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "blocks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_artisanId_fkey" FOREIGN KEY ("artisanId") REFERENCES "artisans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "blocks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parking_spots" ADD CONSTRAINT "parking_spots_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "blocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parking_spots" ADD CONSTRAINT "parking_spots_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
