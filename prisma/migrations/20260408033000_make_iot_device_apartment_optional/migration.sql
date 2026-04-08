-- Allow IoT boards/devices to exist before being attached to an apartment.
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'iot_devices'
			AND column_name = 'apartmentId'
	) THEN
		EXECUTE 'ALTER TABLE "iot_devices" ALTER COLUMN "apartmentId" DROP NOT NULL';
	END IF;
END $$;
