-- Add optional description column to calendar_event.
-- Matches src/shared/src/db/schema.ts

ALTER TABLE calendar_event ADD COLUMN description TEXT;
