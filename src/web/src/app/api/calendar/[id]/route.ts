import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  createDb,
  queries,
  UpdateCalendarEventRequestSchema,
  isEmptyHtml,
  computeNextScheduledAt,
} from "@alook/shared";
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceMember } from "@/lib/middleware/workspace";
import { writeJSON, writeError, parseBody } from "@/lib/middleware/helpers";
import { calendarEventToResponse } from "@/lib/api/responses";
import { repeatStopDateToStopAt } from "@/lib/services/calendar";

export const GET = withAuth(async (req, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const { env } = getCloudflareContext();
  const db = createDb((env as Env).DB);

  const id = ctx.params?.id;
  if (!id) return writeError("calendar event id is required", 400);

  const event = await queries.calendarEvent.getCalendarEvent(
    db,
    id,
    ws.workspaceId
  );
  if (!event) return writeError("calendar event not found", 404);
  return writeJSON(calendarEventToResponse(event));
});

export const PATCH = withAuth(async (req, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const { env } = getCloudflareContext();
  const db = createDb((env as Env).DB);

  const id = ctx.params?.id;
  if (!id) return writeError("calendar event id is required", 400);

  const [body, err] = await parseBody(req, UpdateCalendarEventRequestSchema);
  if (err) return err;

  const source = await queries.calendarEvent.getCalendarEvent(
    db,
    id,
    ws.workspaceId
  );
  if (!source) return writeError("calendar event not found", 404);

  if (body.agent_id !== undefined) {
    const agent = await queries.agent.getAgent(
      db,
      body.agent_id,
      ws.workspaceId
    );
    if (!agent) return writeError("agent not found in workspace", 404);
  }

  const patch: {
    title?: string;
    description?: string | null;
    agentId?: string;
    scheduledAt?: string;
    repeatInterval?: string | null;
    repeatStopAt?: string | null;
  } = {};

  if (body.title !== undefined) patch.title = body.title;
  if (body.description !== undefined) {
    patch.description =
      body.description && !isEmptyHtml(body.description) ? body.description : null;
  }
  if (body.agent_id !== undefined) patch.agentId = body.agent_id;
  if (body.scheduled_at !== undefined) {
    patch.scheduledAt = new Date(body.scheduled_at).toISOString();
  }
  if (body.repeat_interval !== undefined) {
    patch.repeatInterval = body.repeat_interval;
  }
  if (body.repeat_stop_date !== undefined) {
    patch.repeatStopAt =
      body.repeat_stop_date === null
        ? null
        : repeatStopDateToStopAt(body.repeat_stop_date);
  }

  const wantSplit =
    body.scope === "this" &&
    source.repeatInterval !== null &&
    source.repeatInterval !== undefined;

  if (!wantSplit) {
    const updated = await queries.calendarEvent.updateCalendarEvent(
      db,
      id,
      ws.workspaceId,
      patch
    );
    if (!updated) return writeError("calendar event not found", 404);
    return writeJSON(calendarEventToResponse(updated));
  }

  // Split path: detach a specific occurrence. Anchor on occurrence_at
  // (default = source.scheduledAt — the next fire).
  const occurrenceAt = body.occurrence_at
    ? new Date(body.occurrence_at).toISOString()
    : source.scheduledAt;
  const existingExceptions = source.exceptions ?? [];

  if (occurrenceAt === source.scheduledAt) {
    // Editing the next fire — advance the parent past this occurrence.
    const next = computeNextScheduledAt(
      source.scheduledAt,
      source.repeatInterval!,
      source.repeatStopAt ?? null,
      source.scheduledAt,
      existingExceptions
    );
    if (next === null) {
      await queries.calendarEvent.deleteCalendarEvent(db, id, ws.workspaceId);
    } else {
      const advanced = await queries.calendarEvent.updateCalendarEvent(
        db,
        id,
        ws.workspaceId,
        { scheduledAt: next }
      );
      if (!advanced) return writeError("calendar event not found", 404);
    }
  } else {
    // Editing a future occurrence — record it as an exception on the parent.
    const nextExceptions = existingExceptions.includes(occurrenceAt)
      ? existingExceptions
      : [...existingExceptions, occurrenceAt];
    const updated = await queries.calendarEvent.updateCalendarEvent(
      db,
      id,
      ws.workspaceId,
      { exceptions: nextExceptions }
    );
    if (!updated) return writeError("calendar event not found", 404);
  }

  const detached = await queries.calendarEvent.createCalendarEvent(db, {
    agentId: patch.agentId ?? source.agentId,
    workspaceId: ws.workspaceId,
    title: patch.title ?? source.title,
    description:
      patch.description !== undefined ? patch.description : source.description ?? null,
    scheduledAt: patch.scheduledAt ?? occurrenceAt,
    repeatInterval: null,
    repeatStopAt: null,
    exceptions: [],
  });

  return writeJSON(calendarEventToResponse(detached));
});

export const DELETE = withAuth(async (req, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const { env } = getCloudflareContext();
  const db = createDb((env as Env).DB);

  const id = ctx.params?.id;
  if (!id) return writeError("calendar event id is required", 400);

  const deleted = await queries.calendarEvent.deleteCalendarEvent(
    db,
    id,
    ws.workspaceId
  );
  if (!deleted) return writeError("calendar event not found", 404);
  return writeJSON(calendarEventToResponse(deleted));
});
