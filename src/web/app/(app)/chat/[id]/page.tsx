"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  getConversation,
  listMessages,
  sendMessage,
  getTask,
  getTaskMessages,
} from "@/lib/api";
import type { Conversation, Message, Task, TaskMessage } from "@/lib/types";
import { Logo } from "@/components/logo";
import { toast } from "sonner";

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params.id as string;

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [taskMessages, setTaskMessages] = useState<TaskMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const [connectionLost, setConnectionLost] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSeqRef = useRef(0);
  const pollFailures = useRef(0);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }, 50);
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const [conv, msgs] = await Promise.all([
          getConversation(conversationId),
          listMessages(conversationId),
        ]);
        setConversation(conv);
        setMessages(msgs);
      } catch {
        toast.error("Conversation not found");
        router.push("/agents");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [conversationId, router]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, taskMessages, scrollToBottom]);

  const startPolling = useCallback(
    (taskId: string) => {
      if (pollRef.current) clearInterval(pollRef.current);
      lastSeqRef.current = 0;
      pollFailures.current = 0;
      setConnectionLost(false);

      pollRef.current = setInterval(async () => {
        try {
          const [task, tmsgs] = await Promise.all([
            getTask(taskId),
            getTaskMessages(taskId, lastSeqRef.current || undefined),
          ]);

          pollFailures.current = 0;
          setConnectionLost(false);
          setActiveTask(task);

          if (tmsgs.length > 0) {
            setTaskMessages((prev) => [...prev, ...tmsgs]);
            lastSeqRef.current = Math.max(
              ...tmsgs.map((m) => m.seq),
              lastSeqRef.current
            );
          }

          if (task.status === "completed" || task.status === "failed") {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;

            try {
              const updatedMessages = await listMessages(conversationId);
              setMessages(updatedMessages);
            } catch {
              toast.error("Failed to refresh messages");
            }
            setActiveTask(null);
            setTaskMessages([]);
          }
        } catch {
          pollFailures.current += 1;
          if (pollFailures.current >= 3) {
            setConnectionLost(true);
          }
          if (pollFailures.current >= 10) {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            toast.error("Lost connection to agent");
          }
        }
      }, 1000);
    },
    [conversationId]
  );

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || sending) return;

    setInput("");
    setSending(true);

    const optimistic: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: conversationId,
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const { message, task } = await sendMessage(conversationId, content);
      setMessages((prev) =>
        prev.map((m) => (m.id === optimistic.id ? message : m))
      );
      setActiveTask(task);
      setTaskMessages([]);
      startPolling(task.id);
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setInput(content);
      toast.error(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/agents")}>
            &larr; Agents
          </Button>
          <Separator orientation="vertical" className="h-5" />
          <h1 className="text-sm font-medium">
            {conversation?.title || "Chat"}
          </h1>
        </div>
        <Logo />
      </header>

      <div className="flex-1 overflow-y-auto px-6" ref={scrollRef}>
        <div className="mx-auto max-w-2xl py-6 space-y-4">
          {messages.length === 0 && !activeTask && (
            <p className="text-center text-muted-foreground py-20">
              Send a message to start chatting with the agent.
            </p>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 text-sm whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {activeTask && (
            <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {activeTask.status === "running"
                    ? "Agent working..."
                    : activeTask.status}
                </Badge>
              </div>
              {taskMessages.length > 0 && (
                <div className="mt-2 max-h-60 overflow-y-auto rounded bg-background p-3 font-mono text-xs space-y-1">
                  {taskMessages.map((tm) => (
                    <div key={tm.id} className="text-muted-foreground">
                      {tm.type === "tool-use" && (
                        <span className="text-primary">
                          [tool] {tm.tool}
                        </span>
                      )}
                      {tm.type === "tool-result" && (
                        <span className="text-accent-foreground">
                          [result] {tm.output || tm.content}
                        </span>
                      )}
                      {tm.type === "text" && <span>{tm.content}</span>}
                      {tm.type === "thinking" && (
                        <span className="italic opacity-60">{tm.content}</span>
                      )}
                      {!["tool-use", "tool-result", "text", "thinking"].includes(
                        tm.type
                      ) && (
                        <span>
                          [{tm.type}] {tm.content}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {activeTask.status === "failed" && activeTask.error && (
                <p className="text-sm text-destructive">{activeTask.error}</p>
              )}
              {connectionLost && (
                <p className="text-xs text-muted-foreground animate-pulse">
                  Connection lost — retrying...
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="border-t px-6 py-4">
        <div className="mx-auto flex max-w-2xl gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="min-h-[40px] resize-none"
            disabled={sending || !!activeTask}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || sending || !!activeTask}
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
