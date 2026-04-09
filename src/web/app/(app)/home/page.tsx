"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
  SheetFooter,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  listAgents,
  listRuntimes,
  createAgent,
  updateAgent,
  createConversation,
  createMachineToken,
  deleteMachine,
  deleteAgent,
} from "@/lib/api";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
  SelectGroup,
  SelectGroupLabel,
} from "@/components/ui/select";
import { Logo } from "@/components/logo";
import { toast } from "sonner";
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

function OnboardingSteps({
  generatedToken,
  generatingToken,
  tokenCopied,
  onGenerateToken,
  onCopyToken,
}: {
  generatedToken: string;
  generatingToken: boolean;
  tokenCopied: boolean;
  onGenerateToken: () => void;
  onCopyToken: () => void;
}) {
  // Auto-generate token on mount
  const hasTriggered = useRef(false);
  useEffect(() => {
    if (!generatedToken && !generatingToken && !hasTriggered.current) {
      hasTriggered.current = true;
      onGenerateToken();
    }
  }, [generatedToken, generatingToken, onGenerateToken]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast("Copied to clipboard");
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium tracking-tight">
          Connect a machine
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Your machine runs AI agents locally using Claude Code, Codex, or
          OpenCode.
        </p>
      </div>

      {/* Step 1 — Register CLI */}
      <div className="space-y-2">
        <p className="text-xs font-medium flex items-center gap-2">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-foreground text-background text-[10px] font-semibold">
            1
          </span>
          Register your CLI
        </p>
        <p className="text-[11px] text-muted-foreground pl-7">
          Run this in your terminal to link your machine.
        </p>
        {generatingToken ? (
          <div className="pl-7">
            <div className="rounded-md bg-muted p-2.5 font-mono text-xs text-muted-foreground animate-pulse">
              Generating token...
            </div>
          </div>
        ) : generatedToken ? (
          <div className="pl-7 space-y-2">
            <div
              className="rounded-md bg-muted p-2.5 font-mono text-xs text-muted-foreground cursor-pointer hover:bg-muted/80 transition-colors"
              onClick={() =>
                copyToClipboard(
                  `npx @alook/cli register --token ${generatedToken}`
                )
              }
              title="Click to copy"
            >
              npx @alook/cli register --token{" "}
              <span className="text-foreground/70">
                {generatedToken.slice(0, 12)}...
              </span>
            </div>
            <Button
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(
                  `npx @alook/cli register --token ${generatedToken}`
                );
                toast("Copied to clipboard");
              }}
              className="w-full"
            >
              Copy Command
            </Button>
          </div>
        ) : null}
      </div>

      {/* Step 2 — Start daemon */}
      <div
        className={`space-y-2 ${!generatedToken ? "opacity-40 pointer-events-none" : ""}`}
      >
        <p className="text-xs font-medium flex items-center gap-2">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-foreground text-background text-[10px] font-semibold">
            2
          </span>
          Start the daemon
        </p>
        <p className="text-[11px] text-muted-foreground pl-7">
          The daemon connects your local agents to Alook.
        </p>
        <div
          className="ml-7 rounded-md bg-muted p-2.5 font-mono text-xs text-muted-foreground cursor-pointer hover:bg-muted/80 transition-colors"
          onClick={() =>
            copyToClipboard("npx @alook/cli daemon start --foreground")
          }
          title="Click to copy"
        >
          npx @alook/cli daemon start --foreground
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [runtimes, setRuntimes] = useState<Runtime[]>([]);
  const [loading, setLoading] = useState(true);
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [runtimeSheetOpen, setRuntimeSheetOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatedToken, setGeneratedToken] = useState("");
  const [generatingToken, setGeneratingToken] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);

  const hasAnimated = useRef(false);

  // Confirm dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmDescription, setConfirmDescription] = useState("");
  const [confirmLoading, setConfirmLoading] = useState(false);
  const confirmAction = useRef<(() => Promise<void>) | null>(null);

  const openConfirm = (
    title: string,
    description: string,
    action: () => Promise<void>
  ) => {
    setConfirmTitle(title);
    setConfirmDescription(description);
    confirmAction.current = action;
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    if (!confirmAction.current) return;
    setConfirmLoading(true);
    try {
      await confirmAction.current();
    } finally {
      setConfirmLoading(false);
      setConfirmOpen(false);
      confirmAction.current = null;
    }
  };

  // Create form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [runtimeId, setRuntimeId] = useState("");

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editInstructions, setEditInstructions] = useState("");
  const [editRuntimeId, setEditRuntimeId] = useState("");

  const loadData = useCallback(async () => {
    try {
      const [a, r] = await Promise.all([listAgents(), listRuntimes()]);
      setAgents(a);
      setRuntimes(r);
      const firstOnline = r.find((rt: Runtime) => rt.status === "online");
      if (firstOnline) {
        if (!runtimeId) setRuntimeId(firstOnline.id);
      } else {
        setRuntimeId("");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
      // Mark entrance animations as done after first load so they
      // don't replay on subsequent re-renders (e.g. sheet dismiss).
      requestAnimationFrame(() => {
        hasAnimated.current = true;
      });
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
      setCreateSheetOpen(false);
      setName("");
      setDescription("");
      setInstructions("");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create agent");
    } finally {
      setCreating(false);
    }
  };

  const openEditSheet = (agent: Agent) => {
    setEditingAgent(agent);
    setEditName(agent.name);
    setEditDescription(agent.description);
    setEditInstructions(agent.instructions);
    setEditRuntimeId(agent.runtime_id);
    setEditSheetOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAgent) return;
    setSaving(true);
    try {
      await updateAgent(editingAgent.id, {
        name: editName,
        description: editDescription,
        instructions: editInstructions,
        runtime_id: editRuntimeId,
      });
      setEditSheetOpen(false);
      setEditingAgent(null);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update agent");
    } finally {
      setSaving(false);
    }
  };

  const handleChat = async (agent: Agent) => {
    try {
      const conversation = await createConversation(agent.id);
      router.push(`/chat/${conversation.id}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to start conversation"
      );
    }
  };

  const handleGenerateToken = async () => {
    setGeneratingToken(true);
    setTokenCopied(false);
    try {
      const res = await createMachineToken("cli");
      setGeneratedToken(res.token);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to generate token"
      );
    } finally {
      setGeneratingToken(false);
    }
  };

  const handleCopyToken = async () => {
    await navigator.clipboard.writeText(generatedToken);
    setTokenCopied(true);
    toast("Copied to clipboard");
  };

  const runtimeMap = new Map(runtimes.map((r) => [r.id, r]));

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-md bg-muted animate-pulse" />
              <div className="h-5 w-16 rounded bg-muted animate-pulse" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-7 w-24 rounded-md bg-muted animate-pulse" />
              <div className="h-7 w-20 rounded-md bg-muted animate-pulse" />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-8">
          <div className="mb-8">
            <div className="h-6 w-32 rounded bg-muted animate-pulse mb-2" />
            <div className="h-4 w-56 rounded bg-muted animate-pulse" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="rounded-xl ring-1 ring-foreground/10 bg-card p-4 space-y-3"
              >
                <div className="flex justify-between">
                  <div className="h-4 w-24 rounded bg-muted animate-pulse" />
                  <div className="h-5 w-12 rounded-full bg-muted animate-pulse" />
                </div>
                <div className="h-3 w-full rounded bg-muted animate-pulse" />
                <div className="h-3 w-2/3 rounded bg-muted animate-pulse" />
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ── */}
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <Logo />

          {/* Right: Actions */}
          <div className="flex items-center gap-1.5">
            <Sheet open={createSheetOpen} onOpenChange={setCreateSheetOpen}>
              <SheetContent>
                <form onSubmit={handleCreate} className="flex flex-col h-full">
                  <SheetHeader>
                    <SheetTitle>Create Agent</SheetTitle>
                    <SheetDescription>
                      Set up a new AI agent to work with.
                    </SheetDescription>
                  </SheetHeader>
                  <SheetBody>
                    <div className="space-y-5">
                      <div className="space-y-1.5">
                        <Label htmlFor="agent-name">Name</Label>
                        <Input
                          id="agent-name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="My Agent"
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="agent-description">Description</Label>
                        <Input
                          id="agent-description"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="What does this agent do?"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="agent-instructions">Instructions</Label>
                        <Textarea
                          id="agent-instructions"
                          value={instructions}
                          onChange={(e) => setInstructions(e.target.value)}
                          placeholder="System prompt or instructions..."
                          rows={6}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="agent-runtime">Runtime</Label>
                        <Select
                          value={runtimeId}
                          onValueChange={(val: string | null) => {
                            if (val) setRuntimeId(val);
                          }}
                          disabled={runtimes.length === 0 || runtimes.every((r) => r.status !== "online")}
                          items={runtimes.map((rt) => {
                            const machine =
                              (typeof rt.device_info === "string"
                                ? rt.device_info
                                : "") ||
                              rt.name ||
                              "";
                            const label = machine
                              ? `${rt.provider} (${machine})`
                              : rt.provider;
                            return { value: rt.id, label };
                          })}
                        >
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                runtimes.length === 0
                                  ? "No runtimes — start a daemon first"
                                  : runtimes.every((r) => r.status !== "online")
                                    ? "All runtimes offline"
                                    : "Select a runtime"
                              }
                            />
                          </SelectTrigger>
                          <SelectPopup portal={false}>
                            {(() => {
                              // Group runtimes by daemon_id (machine)
                              const groups = new Map<
                                string,
                                {
                                  label: string;
                                  runtimes: Runtime[];
                                }
                              >();
                              for (const rt of runtimes) {
                                const key = rt.daemon_id || rt.id;
                                if (!groups.has(key)) {
                                  groups.set(key, {
                                    label:
                                      (typeof rt.device_info === "string"
                                        ? rt.device_info
                                        : "") ||
                                      rt.name ||
                                      key,
                                    runtimes: [],
                                  });
                                }
                                groups.get(key)!.runtimes.push(rt);
                              }
                              return Array.from(groups.entries()).map(
                                ([key, group]) => (
                                  <SelectGroup key={key}>
                                    <SelectGroupLabel className="truncate">
                                      {group.label}
                                    </SelectGroupLabel>
                                    {group.runtimes.map((rt) => (
                                      <SelectItem key={rt.id} value={rt.id} disabled={rt.status !== "online"}>
                                        <span className="flex items-center gap-2">
                                          <span>{rt.provider}</span>
                                          <span className="text-muted-foreground text-[11px]">
                                            ({rt.status})
                                          </span>
                                        </span>
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                )
                              );
                            })()}
                          </SelectPopup>
                        </Select>
                      </div>
                    </div>
                  </SheetBody>
                  <SheetFooter>
                    <Button type="submit" disabled={creating || !runtimeId}>
                      {creating ? "Creating..." : "Create"}
                    </Button>
                  </SheetFooter>
                </form>
              </SheetContent>
            </Sheet>

            <Sheet
              open={runtimeSheetOpen}
              onOpenChange={(open) => {
                setRuntimeSheetOpen(open);
                if (!open) {
                  setGeneratedToken("");
                  setTokenCopied(false);
                }
              }}
            >
              <SheetTrigger render={<Button variant="outline" size="sm" />}>
                Runtimes
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Runtimes</SheetTitle>
                  <SheetDescription>
                    Your machines and their agent runtimes.
                  </SheetDescription>
                </SheetHeader>
                <SheetBody>
                  {runtimes.length === 0 ? (
                    /* ── Onboarding: Connect a machine ── */
                    <OnboardingSteps
                      generatedToken={generatedToken}
                      generatingToken={generatingToken}
                      tokenCopied={tokenCopied}
                      onGenerateToken={handleGenerateToken}
                      onCopyToken={handleCopyToken}
                    />
                  ) : (
                    /* ── Machines list ── */
                    <div className="space-y-3">
                      {(() => {
                        // Group runtimes by daemon_id (machine)
                        const machines = new Map<
                          string,
                          { deviceInfo: string; name: string; runtimes: Runtime[] }
                        >();
                        for (const rt of runtimes) {
                          const key = rt.daemon_id || rt.id;
                          if (!machines.has(key)) {
                            machines.set(key, {
                              deviceInfo:
                                typeof rt.device_info === "string"
                                  ? rt.device_info
                                  : "",
                              name: rt.name || "",
                              runtimes: [],
                            });
                          }
                          machines.get(key)!.runtimes.push(rt);
                        }

                        return Array.from(machines.entries()).map(
                          ([daemonId, machine]) => {
                            const displayName =
                              machine.deviceInfo || machine.name || daemonId;

                            return (
                              <div
                                key={daemonId}
                                className="rounded-lg border p-3.5 space-y-3"
                              >
                                {/* Machine header */}
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium tracking-tight">
                                    {displayName}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-[11px] text-muted-foreground h-6 px-2 hover:text-destructive"
                                    onClick={() => {
                                      openConfirm(
                                        "Remove machine",
                                        `This will remove "${displayName}" and all its runtimes. Agents using these runtimes will be unlinked.`,
                                        async () => {
                                          try {
                                            await deleteMachine(daemonId);
                                            const r = await listRuntimes();
                                            setRuntimes(r);
                                          } catch (err) {
                                            toast.error(
                                              err instanceof Error
                                                ? err.message
                                                : "Failed to remove machine"
                                            );
                                          }
                                        }
                                      );
                                    }}
                                  >
                                    Remove
                                  </Button>
                                </div>

                                {/* Nested runtimes */}
                                <div className="space-y-2 pl-0.5">
                                  {machine.runtimes.map((runtime) => (
                                    <div
                                      key={runtime.id}
                                      className="rounded-md border border-dashed p-2.5 space-y-1"
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-medium">
                                          {runtime.provider}
                                          {runtime.metadata?.version ? (
                                            <span className="ml-1.5 font-normal text-muted-foreground">
                                              {String(runtime.metadata.version)}
                                            </span>
                                          ) : null}
                                        </span>
                                        <Badge
                                          variant={
                                            runtime.status === "online"
                                              ? "default"
                                              : "outline"
                                          }
                                          className="text-[10px] px-1.5 py-0"
                                        >
                                          {runtime.status}
                                        </Badge>
                                      </div>
                                      <p className="text-[11px] text-muted-foreground tabular-nums">
                                        Last seen{" "}
                                        {new Date(
                                          runtime.last_seen_at
                                        ).toLocaleString()}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          }
                        );
                      })()}

                      {/* Connect another machine */}
                      <div className="pt-3 border-t">
                        {generatedToken ? (
                          <div className="space-y-2">
                            <div className="rounded-md bg-muted p-2.5 font-mono text-xs break-all select-all">
                              {generatedToken}
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              Copy this token now — it won&apos;t be shown again.
                            </p>
                            <Button
                              size="sm"
                              onClick={handleCopyToken}
                              className="w-full"
                            >
                              {tokenCopied ? "Copied!" : "Copy Token"}
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleGenerateToken}
                            disabled={generatingToken}
                            className="w-full text-xs text-muted-foreground"
                          >
                            {generatingToken
                              ? "Generating..."
                              : "Connect new machine"}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </SheetBody>
              </SheetContent>
            </Sheet>

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

      {/* ── Main ── */}
      <main className="mx-auto max-w-5xl px-6 py-8">
        {agents.length === 0 ? (
          <div className="py-20 text-center animate-[fade-up_400ms_ease-out_both]">
            <p className="text-muted-foreground text-sm">
              No agents yet.
            </p>
            <p className="text-xs text-muted-foreground mt-2 max-w-xs mx-auto">
              Start a daemon with{" "}
              <code className="font-mono text-foreground/70 bg-muted px-1 py-0.5 rounded text-[11px]">
                npx @alook/cli daemon start
              </code>
              , then create your first agent.
            </p>
            <Button
              size="sm"
              className="mt-5"
              onClick={() => setCreateSheetOpen(true)}
            >
              Create Agent
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent, i) => {
              const runtime = runtimeMap.get(agent.runtime_id);
              return (
                <Card
                  key={agent.id}
                  size="sm"
                  className="group cursor-pointer transition-all duration-200 ease-out hover:-translate-y-px hover:shadow-md hover:ring-foreground/15 active:translate-y-0 active:shadow-sm"
                  style={
                    !hasAnimated.current
                      ? {
                          animation: `fade-up 300ms cubic-bezier(0.16, 1, 0.3, 1) both`,
                          animationDelay: `${i * 60}ms`,
                        }
                      : undefined
                  }
                  onClick={() => handleChat(agent)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-sm font-medium tracking-tight">
                        {agent.name}
                      </CardTitle>
                      <Badge variant={statusVariant(agent.status)}>
                        {agent.status}
                      </Badge>
                    </div>
                    {agent.description && (
                      <CardDescription className="line-clamp-2 text-xs">
                        {agent.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="mt-auto">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        {runtime?.provider ?? "unknown"}{" "}
                        <span className="text-muted-foreground/60">
                          ({runtime?.status ?? "offline"})
                        </span>
                      </p>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-[11px] text-muted-foreground h-6 px-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditSheet(agent);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-[11px] text-muted-foreground h-6 px-2 hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            openConfirm(
                            "Remove agent",
                            `This will permanently delete "${agent.name}" and all its conversations.`,
                            async () => {
                              try {
                                await deleteAgent(agent.id);
                                await loadData();
                              } catch (err) {
                                toast.error(
                                  err instanceof Error
                                    ? err.message
                                    : "Failed to remove agent"
                                );
                              }
                            }
                          );
                        }}
                      >
                          Remove
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {/* Create agent card — hidden content revealed on hover */}
            <button
              type="button"
              onClick={() => setCreateSheetOpen(true)}
              className="group/create rounded-xl ring-1 ring-dashed ring-foreground/10 bg-transparent cursor-pointer flex flex-col items-center justify-center min-h-[120px] transition-all duration-200 ease-out hover:ring-foreground/20 hover:bg-muted/50 hover:-translate-y-px active:translate-y-0"
              style={
                !hasAnimated.current
                  ? {
                      animation: `fade-up 300ms cubic-bezier(0.16, 1, 0.3, 1) both`,
                      animationDelay: `${agents.length * 60}ms`,
                    }
                  : undefined
              }
            >
              <span className="text-4xl font-extralight text-muted-foreground/0 group-hover/create:text-muted-foreground transition-colors leading-none">
                +
              </span>
              <span className="text-xs text-muted-foreground/0 group-hover/create:text-muted-foreground mt-1.5 transition-colors">
                New Agent
              </span>
            </button>
          </div>
        )}
      </main>

      {/* Edit agent sheet */}
      <Sheet open={editSheetOpen} onOpenChange={setEditSheetOpen}>
        <SheetContent>
          <form onSubmit={handleEdit} className="flex flex-col h-full">
            <SheetHeader>
              <SheetTitle>Edit Agent</SheetTitle>
              <SheetDescription>
                Update your agent&apos;s configuration.
              </SheetDescription>
            </SheetHeader>
            <SheetBody>
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-agent-name">Name</Label>
                  <Input
                    id="edit-agent-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="My Agent"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-agent-description">Description</Label>
                  <Input
                    id="edit-agent-description"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="What does this agent do?"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-agent-instructions">Instructions</Label>
                  <Textarea
                    id="edit-agent-instructions"
                    value={editInstructions}
                    onChange={(e) => setEditInstructions(e.target.value)}
                    placeholder="System prompt or instructions..."
                    rows={6}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-agent-runtime">Runtime</Label>
                  <Select
                    value={editRuntimeId}
                    onValueChange={(val: string | null) => {
                      if (val) setEditRuntimeId(val);
                    }}
                    disabled={runtimes.length === 0 || runtimes.every((r) => r.status !== "online")}
                    items={runtimes.map((rt) => {
                      const machine =
                        (typeof rt.device_info === "string"
                          ? rt.device_info
                          : "") ||
                        rt.name ||
                        "";
                      const label = machine
                        ? `${rt.provider} (${machine})`
                        : rt.provider;
                      return { value: rt.id, label };
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          runtimes.length === 0
                            ? "No runtimes — start a daemon first"
                            : runtimes.every((r) => r.status !== "online")
                              ? "All runtimes offline"
                              : "Select a runtime"
                        }
                      />
                    </SelectTrigger>
                    <SelectPopup portal={false}>
                      {(() => {
                        const groups = new Map<
                          string,
                          { label: string; runtimes: Runtime[] }
                        >();
                        for (const rt of runtimes) {
                          const key = rt.daemon_id || rt.id;
                          if (!groups.has(key)) {
                            groups.set(key, {
                              label:
                                (typeof rt.device_info === "string"
                                  ? rt.device_info
                                  : "") ||
                                rt.name ||
                                key,
                              runtimes: [],
                            });
                          }
                          groups.get(key)!.runtimes.push(rt);
                        }
                        return Array.from(groups.entries()).map(
                          ([key, group]) => (
                            <SelectGroup key={key}>
                              <SelectGroupLabel className="truncate">
                                {group.label}
                              </SelectGroupLabel>
                              {group.runtimes.map((rt) => (
                                <SelectItem key={rt.id} value={rt.id} disabled={rt.status !== "online"}>
                                  <span className="flex items-center gap-2">
                                    <span>{rt.provider}</span>
                                    <span className="text-muted-foreground text-[11px]">
                                      ({rt.status})
                                    </span>
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          )
                        );
                      })()}
                    </SelectPopup>
                  </Select>
                </div>
              </div>
            </SheetBody>
            <SheetFooter>
              <Button type="submit" disabled={saving || !editName}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={confirmTitle}
        description={confirmDescription}
        loading={confirmLoading}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
