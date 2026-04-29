import { eq, and } from "drizzle-orm";
import { channel, conversation } from "../schema";
import type { Database } from "../index";

export async function createChannel(
  db: Database,
  data: { workspaceId: string; name: string }
) {
  const rows = await db
    .insert(channel)
    .values({
      workspaceId: data.workspaceId,
      name: data.name,
    })
    .returning();
  return rows[0]!;
}

export async function listChannels(db: Database, workspaceId: string) {
  return db
    .select()
    .from(channel)
    .where(eq(channel.workspaceId, workspaceId));
}

export async function getChannelByName(
  db: Database,
  workspaceId: string,
  name: string
) {
  const rows = await db
    .select()
    .from(channel)
    .where(
      and(eq(channel.workspaceId, workspaceId), eq(channel.name, name))
    );
  return rows[0] ?? null;
}

export async function getChannelById(
  db: Database,
  id: string,
  workspaceId: string
) {
  const rows = await db
    .select()
    .from(channel)
    .where(and(eq(channel.id, id), eq(channel.workspaceId, workspaceId)));
  return rows[0] ?? null;
}

export async function deleteChannel(
  db: Database,
  id: string,
  workspaceId: string
) {
  const row = await getChannelById(db, id, workspaceId);
  if (!row) return null;

  await db.batch([
    db
      .delete(conversation)
      .where(
        and(
          eq(conversation.workspaceId, workspaceId),
          eq(conversation.channel, row.name)
        )
      ),
    db
      .delete(channel)
      .where(and(eq(channel.id, id), eq(channel.workspaceId, workspaceId))),
  ]);

  return row;
}

export async function renameChannel(
  db: Database,
  id: string,
  workspaceId: string,
  newName: string
) {
  const row = await getChannelById(db, id, workspaceId);
  if (!row) return null;

  await db.batch([
    db
      .update(conversation)
      .set({ channel: newName })
      .where(
        and(
          eq(conversation.workspaceId, workspaceId),
          eq(conversation.channel, row.name)
        )
      ),
    db
      .update(channel)
      .set({ name: newName })
      .where(and(eq(channel.id, id), eq(channel.workspaceId, workspaceId))),
  ]);

  return { ...row, name: newName };
}
