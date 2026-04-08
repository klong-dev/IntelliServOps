CREATE TABLE "iot_boards" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "apartmentId" TEXT,
  "status" "IoTStatus" NOT NULL DEFAULT 'active',
  "lastOnlineAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "iot_boards_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "iot_boards_apartmentId_idx" ON "iot_boards"("apartmentId");
CREATE INDEX "iot_boards_status_idx" ON "iot_boards"("status");

ALTER TABLE "iot_boards"
ADD CONSTRAINT "iot_boards_apartmentId_fkey"
FOREIGN KEY ("apartmentId") REFERENCES "apartments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
