-- CreateEnum
CREATE TYPE "Category" AS ENUM ('playa', 'montana', 'ciudad', 'aventura');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('pending', 'confirmed', 'cancelled');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('unpaid', 'deposit_paid', 'paid', 'refunded');

-- CreateEnum
CREATE TYPE "SubscriberStatus" AS ENUM ('active', 'unsubscribed');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "destinations" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "Category" NOT NULL,
    "tags" "Category"[] DEFAULT ARRAY[]::"Category"[],
    "price_per_night" DECIMAL(10,2) NOT NULL,
    "flight_estimate" DECIMAL(10,2) NOT NULL,
    "location" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "rating" DECIMAL(2,1) NOT NULL DEFAULT 0,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "emoji" TEXT,
    "gradient" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "destinations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packages" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "days" INTEGER NOT NULL,
    "price_per_person" DECIMAL(10,2) NOT NULL,
    "itinerary" JSONB NOT NULL,
    "includes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "max_group_size" INTEGER NOT NULL DEFAULT 12,
    "emoji" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "destination_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "user_name" TEXT NOT NULL,
    "user_email" TEXT NOT NULL,
    "user_phone" TEXT,
    "destination_id" UUID NOT NULL,
    "package_id" UUID NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "travelers_count" INTEGER NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "taxes" DECIMAL(10,2) NOT NULL,
    "total_price" DECIMAL(10,2) NOT NULL,
    "deposit_amount" DECIMAL(10,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "status" "BookingStatus" NOT NULL DEFAULT 'pending',
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'unpaid',
    "stripe_session_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newsletter_subscribers" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "status" "SubscriberStatus" NOT NULL DEFAULT 'active',
    "source" TEXT,
    "unsubscribe_token" TEXT NOT NULL,
    "subscribed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unsubscribed_at" TIMESTAMP(3),

    CONSTRAINT "newsletter_subscribers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "author_name" TEXT NOT NULL,
    "author_location" TEXT,
    "avatar_url" TEXT,
    "rating" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'pending',
    "destination_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "destinations_slug_key" ON "destinations"("slug");

-- CreateIndex
CREATE INDEX "destinations_category_idx" ON "destinations"("category");

-- CreateIndex
CREATE INDEX "destinations_featured_idx" ON "destinations"("featured");

-- CreateIndex
CREATE UNIQUE INDEX "packages_slug_key" ON "packages"("slug");

-- CreateIndex
CREATE INDEX "packages_destination_id_idx" ON "packages"("destination_id");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_reference_key" ON "bookings"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_stripe_session_id_key" ON "bookings"("stripe_session_id");

-- CreateIndex
CREATE INDEX "bookings_package_id_start_date_idx" ON "bookings"("package_id", "start_date");

-- CreateIndex
CREATE INDEX "bookings_user_email_idx" ON "bookings"("user_email");

-- CreateIndex
CREATE INDEX "bookings_status_idx" ON "bookings"("status");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscribers_email_key" ON "newsletter_subscribers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscribers_unsubscribe_token_key" ON "newsletter_subscribers"("unsubscribe_token");

-- CreateIndex
CREATE INDEX "reviews_status_created_at_idx" ON "reviews"("status", "created_at");

-- CreateIndex
CREATE INDEX "reviews_destination_id_idx" ON "reviews"("destination_id");

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "destinations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "destinations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "destinations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------
-- Restricciones de integridad adicionales (defensa en profundidad:
-- aunque la API valida con Zod, la base de datos tampoco acepta
-- datos imposibles). Prisma no las modela, pero las respeta.
-- ---------------------------------------------------------
ALTER TABLE "destinations" ADD CONSTRAINT "destinations_rating_check" CHECK ("rating" BETWEEN 0 AND 5);
ALTER TABLE "destinations" ADD CONSTRAINT "destinations_prices_check" CHECK ("price_per_night" > 0 AND "flight_estimate" >= 0);
ALTER TABLE "packages" ADD CONSTRAINT "packages_values_check" CHECK ("days" > 1 AND "price_per_person" > 0 AND "max_group_size" > 0);
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_travelers_check" CHECK ("travelers_count" BETWEEN 1 AND 20);
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_dates_check" CHECK ("end_date" > "start_date");
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_amounts_check" CHECK ("total_price" >= 0 AND "deposit_amount" >= 0 AND "deposit_amount" <= "total_price");
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rating_check" CHECK ("rating" BETWEEN 1 AND 5);
