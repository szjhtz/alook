"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAgentContext } from "@/contexts/agent-context";
import { useWorkspace } from "@/contexts/workspace-context";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";
import { getWorkspaceOverview, type WorkspaceOverview } from "@/lib/api";
import { QuickStatsRow } from "./_components/quick-stats";
import { AgentOverview } from "./_components/agent-overview";
import { TaskHealth } from "./_components/task-health";
import { EmailSummary } from "./_components/email-summary";
import { RecentActivity } from "./_components/recent-activity";
import { CalendarOverview } from "./_components/calendar-overview";
import { RuntimeHealth } from "./_components/runtime-health";
import { TeamAccess } from "./_components/team-access";

export default function HomePage() {
  const router = useRouter();
  const { agents, runtimes, loading, activeTaskCounts } = useAgentContext();
  const { slug, workspaceId } = useWorkspace();
  const [overview, setOverview] = useState<WorkspaceOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

  useEffect(() => {
    if (loading || agents.length === 0) return;
    let cancelled = false;
    setOverviewLoading(true);
    getWorkspaceOverview(workspaceId)
      .then((data) => {
        if (!cancelled) setOverview(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setOverviewLoading(false);
      });
    return () => { cancelled = true; };
  }, [loading, agents.length, workspaceId]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (agents.length === 0) {
    const hasOnline = runtimes.some((r) => r.status === "online");
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center animate-[fade-up_400ms_ease-out_both]">
          {runtimes.length === 0 ? (
            <>
              <p className="text-muted-foreground text-sm">Connect a machine to run your agents.</p>
              <Button
                size="sm"
                className="mt-4 glow-border"
                onClick={() => router.push(`/w/${slug}/runtimes?connect`)}
              >
                Connect Machine
              </Button>
            </>
          ) : !hasOnline ? (
            <>
              <p className="text-muted-foreground text-sm">Start the daemon on your machine to bring it online.</p>
              <Button
                size="sm"
                className="mt-4 glow-border"
                onClick={() => router.push(`/w/${slug}/runtimes`)}
              >
                Bring Machine Online
              </Button>
            </>
          ) : (
            <>
              <p className="text-muted-foreground text-sm">Your machine is ready. Create your first agent to get started.</p>
              <Button
                size="sm"
                className="mt-4 glow-border"
                onClick={() => router.push(`/w/${slug}/agents/new`)}
              >
                Create Agent
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (overviewLoading || !overview) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 lg:p-6 space-y-4">
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-48 rounded-xl" />
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-44 rounded-xl" />
            <Skeleton className="h-44 rounded-xl" />
          </div>
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-4 lg:p-6 space-y-4">
        <QuickStatsRow
          agents={agents}
          runtimes={runtimes}
          activeTaskCounts={activeTaskCounts}
          overview={overview}
        />
        <AgentOverview
          agents={agents}
          runtimes={runtimes}
          activeTaskCounts={activeTaskCounts}
          overview={overview}
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <TaskHealth overview={overview} />
          <EmailSummary overview={overview} agents={agents} />
        </div>
        <RecentActivity overview={overview} agents={agents} />
        <div className="grid gap-4 lg:grid-cols-2">
          <CalendarOverview overview={overview} agents={agents} />
          <RuntimeHealth runtimes={runtimes} agents={agents} />
        </div>
        <TeamAccess overview={overview} />
      </div>
    </div>
  );
}
