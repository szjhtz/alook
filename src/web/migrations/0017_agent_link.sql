CREATE TABLE IF NOT EXISTS agent_link (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  source_agent_id TEXT NOT NULL,
  target_agent_id TEXT NOT NULL,
  instruction TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (source_agent_id, workspace_id) REFERENCES agent(id, workspace_id) ON DELETE CASCADE,
  FOREIGN KEY (target_agent_id, workspace_id) REFERENCES agent(id, workspace_id) ON DELETE CASCADE,
  CONSTRAINT agent_link_ws_source_target UNIQUE (workspace_id, source_agent_id, target_agent_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_link_workspace ON agent_link(workspace_id);
