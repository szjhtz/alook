"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAgentContext } from "@/contexts/agent-context";
import { useWorkspace } from "@/contexts/workspace-context";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const { agents, runtimes, loading } = useAgentContext();
  const { slug } = useWorkspace();
  const redirectedRef = useRef(false);

  // Auto-redirect to first agent's detail page
  useEffect(() => {
    if (loading || redirectedRef.current) return;
    if (agents.length === 0) return;

    redirectedRef.current = true;
    const sorted = [...agents].sort((a, b) => a.name.localeCompare(b.name));
    const first = sorted[0];
    router.replace(`/w/${slug}/agents/${first.id}`);
  }, [agents, loading, router, slug]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Redirecting to first agent chat
  if (agents.length > 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Empty state — no agents
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
