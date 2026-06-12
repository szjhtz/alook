-- Add owner_id column
ALTER TABLE machine ADD COLUMN owner_id TEXT REFERENCES "user"(id) ON DELETE SET NULL;

-- Backfill from machine_token using hostname ↔ daemon_id correlation
UPDATE machine
SET owner_id = (
  SELECT mt.user_id
  FROM machine_token mt
  WHERE mt.workspace_id = machine.workspace_id
    AND mt.hostname = machine.daemon_id
    AND mt.status = 'active'
  ORDER BY mt.last_used_at DESC
  LIMIT 1
)
WHERE machine.owner_id IS NULL;

-- Fallback: assign to workspace owner for any remaining unmatched machines
UPDATE machine
SET owner_id = (
  SELECT m.user_id
  FROM member m
  WHERE m.workspace_id = machine.workspace_id
    AND m.role = 'owner'
  LIMIT 1
)
WHERE machine.owner_id IS NULL;
