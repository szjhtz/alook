-- Add per-occurrence exceptions list to calendar_event.
-- Matches src/shared/src/db/schema.ts

ALTER TABLE calendar_event ADD COLUMN exceptions TEXT NOT NULL DEFAULT '[]';
