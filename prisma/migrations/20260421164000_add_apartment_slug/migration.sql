ALTER TABLE "apartments" ADD COLUMN "slug" TEXT;

WITH prepared AS (
  SELECT
    "id",
    "createdAt",
    COALESCE(
      NULLIF(
        trim(BOTH '-' FROM regexp_replace(lower(COALESCE("buildingName", '') || '-' || COALESCE("apartmentNumber", '')), '[^a-z0-9]+', '-', 'g')),
        ''
      ),
      NULLIF(
        trim(BOTH '-' FROM regexp_replace(lower(COALESCE("apartmentNumber", '')), '[^a-z0-9]+', '-', 'g')),
        ''
      ),
      'apartment'
    ) AS "baseSlug"
  FROM "apartments"
),
ranked AS (
  SELECT
    "id",
    CASE
      WHEN ROW_NUMBER() OVER (PARTITION BY "baseSlug" ORDER BY "createdAt", "id") = 1
        THEN "baseSlug"
      ELSE "baseSlug" || '-' || ROW_NUMBER() OVER (PARTITION BY "baseSlug" ORDER BY "createdAt", "id")
    END AS "resolvedSlug"
  FROM prepared
)
UPDATE "apartments" AS apartment
SET "slug" = ranked."resolvedSlug"
FROM ranked
WHERE apartment."id" = ranked."id";

ALTER TABLE "apartments" ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "apartments_slug_key" ON "apartments"("slug");
