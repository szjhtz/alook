"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  listAgents,
  listRuntimes,
  createAgent,
  createConversation,
  createMachineToken,
} from "@/lib/api";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Agent, Runtime } from "@/lib/types";

function statusVariant(status: string) {
  switch (status) {
    case "working":
      return "default" as const;
    case "idle":
      return "secondary" as const;
    default:
      return "outline" as const;
  }
}

export default function AgentsPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [runtimes, setRuntimes] = useState<Runtime[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [generatedToken, setGeneratedToken] = useState("");
  const [generatingToken, setGeneratingToken] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [runtimeId, setRuntimeId] = useState("");

  const loadData = useCallback(async () => {
    try {
      const [a, r] = await Promise.all([listAgents(), listRuntimes()]);
      setAgents(a);
      setRuntimes(r);
      if (r.length > 0 && !runtimeId) {
        setRuntimeId(r[0].id);
      }
    } catch {
      // handled by api client (401 redirect)
    } finally {
      setLoading(false);
    }
  }, [runtimeId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await createAgent({
        name,
        description: description || undefined,
        instructions: instructions || undefined,
        runtime_id: runtimeId,
      });
      setDialogOpen(false);
      setName("");
      setDescription("");
      setInstructions("");
      await loadData();
    } catch {
      // TODO: show error
    } finally {
      setCreating(false);
    }
  };

  const handleChat = async (agent: Agent) => {
    try {
      const conversation = await createConversation(agent.id);
      router.push(`/chat/${conversation.id}`);
    } catch {
      // TODO: show error
    }
  };

  const handleGenerateToken = async () => {
    setGeneratingToken(true);
    setTokenCopied(false);
    try {
      const res = await createMachineToken("cli");
      setGeneratedToken(res.token);
    } catch {
      // TODO: show error
    } finally {
      setGeneratingToken(false);
    }
  };

  const handleCopyToken = async () => {
    await navigator.clipboard.writeText(generatedToken);
    setTokenCopied(true);
  };

  const runtimeMap = new Map(runtimes.map((r) => [r.id, r]));

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <h1 className="text-xl font-semibold tracking-tight">Agents</h1>
          <div className="flex items-center gap-3">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger render={<Button />}>
                Create Agent
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleCreate}>
                  <DialogHeader>
                    <DialogTitle>Create Agent</DialogTitle>
                    <DialogDescription>
                      Set up a new AI agent to work with.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="agent-name">Name</Label>
                      <Input
                        id="agent-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="My Agent"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="agent-description">Description</Label>
                      <Input
                        id="agent-description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="What does this agent do?"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="agent-instructions">Instructions</Label>
                      <Textarea
                        id="agent-instructions"
                        value={instructions}
                        onChange={(e) => setInstructions(e.target.value)}
                        placeholder="System prompt or instructions for the agent..."
                        rows={4}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="agent-runtime">Runtime</Label>
                      <select
                        id="agent-runtime"
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={runtimeId}
                        onChange={(e) => setRuntimeId(e.target.value)}
                        required
                      >
                        {runtimes.length === 0 && (
                          <option value="" disabled>
                            No runtimes available — start a daemon
                          </option>
                        )}
                        {runtimes.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.provider} ({r.status})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={creating || !runtimeId}>
                      {creating ? "Creating..." : "Create"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog
              open={tokenDialogOpen}
              onOpenChange={(open) => {
                setTokenDialogOpen(open);
                if (!open) {
                  setGeneratedToken("");
                  setTokenCopied(false);
                }
              }}
            >
              <DialogTrigger render={<Button variant="outline" />}>
                CLI Token
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>CLI Token</DialogTitle>
                  <DialogDescription>
                    Generate a token to register the CLI and daemon.
                  </DialogDescription>
                </DialogHeader>
                {generatedToken ? (
                  <div className="space-y-3 py-2">
                    <div className="rounded-md bg-muted p-3 font-mono text-sm break-all select-all">
                      {generatedToken}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Copy this token now — it won&apos;t be shown again.
                    </p>
                    <div className="flex gap-2">
                      <Button onClick={handleCopyToken} className="flex-1">
                        {tokenCopied ? "Copied!" : "Copy Token"}
                      </Button>
                    </div>
                    <div className="rounded-md border p-3 text-xs font-mono text-muted-foreground">
                      alook register --token {generatedToken}
                    </div>
                  </div>
                ) : (
                  <DialogFooter>
                    <Button onClick={handleGenerateToken} disabled={generatingToken}>
                      {generatingToken ? "Generating..." : "Generate Token"}
                    </Button>
                  </DialogFooter>
                )}
              </DialogContent>
            </Dialog>
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                localStorage.removeItem("alook_token");
                localStorage.removeItem("alook_workspace_id");
                document.cookie = "alook_session=; path=/; max-age=0";
                router.push("/login");
              }}
            >
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        {agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-muted-foreground mb-4">No agents yet.</p>
            <p className="text-sm text-muted-foreground">
              Make sure a daemon is running, then create an agent.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {agents.map((agent) => {
              const runtime = runtimeMap.get(agent.runtime_id);
              return (
                <Card
                  key={agent.id}
                  className="cursor-pointer transition-colors hover:bg-accent/50"
                  onClick={() => handleChat(agent)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{agent.name}</CardTitle>
                      <Badge variant={statusVariant(agent.status)}>
                        {agent.status}
                      </Badge>
                    </div>
                    {agent.description && (
                      <CardDescription className="line-clamp-2">
                        {agent.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      Runtime: {runtime?.provider ?? "unknown"} (
                      {runtime?.status ?? "offline"})
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
