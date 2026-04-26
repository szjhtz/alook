"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { WorkspaceOverview } from "@/lib/api";

interface TaskHealthProps {
  overview: WorkspaceOverview;
}

export function TaskHealth({ overview }: TaskHealthProps) {
  const { completed, failed, cancelled, queued, stale } = overview.task_stats;
  const total = completed + failed;
  const failRate = total > 0 ? ((failed / total) * 100).toFixed(1) : "0";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Task Health (Today)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Completed" value={completed} />
          <Stat label="Failed" value={failed} className={failed > 0 ? "text-destructive" : undefined} />
          <Stat label="Cancelled" value={cancelled} />
          <Stat label="Failure Rate" value={`${failRate}%`} className={Number(failRate) > 10 ? "text-destructive" : undefined} />
          <Stat label="Queue Backlog" value={queued} className={queued > 10 ? "text-amber-500" : undefined} />
          <Stat label="Stale Tasks" value={stale} className={stale > 0 ? "text-destructive" : undefined} />
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, className }: { label: string; value: string | number; className?: string }) {
  return (
    <div>
      <p className={`text-xl font-semibold ${className ?? ""}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
