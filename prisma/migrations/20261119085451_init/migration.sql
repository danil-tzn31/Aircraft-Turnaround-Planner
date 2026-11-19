-- CreateEnum
CREATE TYPE "Category" AS ENUM ('passenger', 'baggage', 'fuel', 'catering', 'cleaning', 'technical', 'departure');

-- CreateTable
CREATE TABLE "AircraftType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "seats" INTEGER NOT NULL,
    "twoDoorAvailable" BOOLEAN NOT NULL DEFAULT true,
    "defaultTwoDoor" BOOLEAN NOT NULL DEFAULT false,
    "defaultGroundMinutes" INTEGER NOT NULL,
    "templateVersion" INTEGER NOT NULL DEFAULT 1,
    "sourceNote" TEXT NOT NULL,

    CONSTRAINT "AircraftType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateTask" (
    "id" SERIAL NOT NULL,
    "aircraftTypeId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" "Category" NOT NULL,
    "durationOneDoor" INTEGER NOT NULL,
    "durationTwoDoor" INTEGER NOT NULL,
    "startOffset" INTEGER NOT NULL DEFAULT 0,
    "dependsOn" TEXT[],
    "dependsOnWithoutFwpob" TEXT[],
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "TemplateTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scenario" (
    "id" TEXT NOT NULL,
    "aircraftTypeId" TEXT NOT NULL,
    "title" TEXT,
    "input" JSONB NOT NULL,
    "inputHash" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Scenario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TemplateTask_aircraftTypeId_key_key" ON "TemplateTask"("aircraftTypeId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Scenario_inputHash_key" ON "Scenario"("inputHash");

-- AddForeignKey
ALTER TABLE "TemplateTask" ADD CONSTRAINT "TemplateTask_aircraftTypeId_fkey" FOREIGN KEY ("aircraftTypeId") REFERENCES "AircraftType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scenario" ADD CONSTRAINT "Scenario_aircraftTypeId_fkey" FOREIGN KEY ("aircraftTypeId") REFERENCES "AircraftType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
