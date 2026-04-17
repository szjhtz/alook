-- Calendar event table + conversation.type column
-- Matches src/shared/src/db/schema.ts

ALTER TABLE conversation ADD COLUMN type TEXT NOT NULL DEFAULT 'user_dm_message';

CREATE TABLE IF NOT EXISTS calendar_event (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  title TEXT NOT NULL,
  scheduled_at TEXT NOT NULL,
  repeat_interval TEXT,
  repeat_stop_at TEXT,
  last_triggered_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (agent_id, workspace_id) REFERENCES agent(id, workspace_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_calendar_event_agent_ws ON calendar_event (agent_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_calendar_event_ws_scheduled ON calendar_event (workspace_id, scheduled_at);
