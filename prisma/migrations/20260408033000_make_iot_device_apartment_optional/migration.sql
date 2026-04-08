-- Allow IoT boards/devices to exist before being attached to an apartment.
ALTER TABLE "iot_devices"
ALTER COLUMN "apartmentId" DROP NOT NULL;
