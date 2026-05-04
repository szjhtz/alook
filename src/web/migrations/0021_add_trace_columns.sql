ALTER TABLE agent_task_queue ADD COLUMN trace_id TEXT;
ALTER TABLE agent_task_queue ADD COLUMN parent_task_id TEXT;
CREATE INDEX IF NOT EXISTS idx_task_queue_trace ON agent_task_queue(trace_id);
CREATE INDEX IF NOT EXISTS idx_task_queue_parent ON agent_task_queue(parent_task_id);
