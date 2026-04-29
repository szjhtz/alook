"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { Channel } from "@alook/shared";
import {
  listChannels,
  createChannelApi,
  renameChannelApi,
  deleteChannelApi,
} from "@/lib/api";

interface ChannelContextValue {
  channels: Channel[];
  activeChannel: string;
  loading: boolean;
  setActiveChannel: (name: string) => void;
  createChannel: (name: string) => Promise<Channel>;
  renameChannel: (id: string, name: string) => Promise<void>;
  deleteChannel: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const ChannelContext = createContext<ChannelContextValue | null>(null);

function storageKey(workspaceId: string) {
  return `alook:channel:${workspaceId}`;
}

export function ChannelProvider({
  workspaceId,
  children,
}: {
  workspaceId: string;
  children: ReactNode;
}) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannelState] = useState<string>("default");
  const [loading, setLoading] = useState(true);

  const fetchChannels = useCallback(async () => {
    try {
      const list = await listChannels(workspaceId);
      setChannels(list);
    } catch {
      // fallback — at minimum show default
      setChannels([]);
    }
  }, [workspaceId]);

  useEffect(() => {
    const stored =
      typeof window !== "undefined"
        ? localStorage.getItem(storageKey(workspaceId))
        : null;
    if (stored) {
      setActiveChannelState(stored);
    }
    fetchChannels().finally(() => setLoading(false));
  }, [workspaceId, fetchChannels]);

  const setActiveChannel = useCallback(
    (name: string) => {
      setActiveChannelState(name);
      if (typeof window !== "undefined") {
        localStorage.setItem(storageKey(workspaceId), name);
      }
    },
    [workspaceId]
  );

  const createChannel = useCallback(
    async (name: string) => {
      const created = await createChannelApi(workspaceId, name);
      await fetchChannels();
      return created;
    },
    [workspaceId, fetchChannels]
  );

  const renameChannel = useCallback(
    async (id: string, name: string) => {
      const ch = channels.find((c) => c.id === id);
      await renameChannelApi(id, workspaceId, name);
      if (ch && ch.name === activeChannel) {
        setActiveChannel(name);
      }
      await fetchChannels();
    },
    [workspaceId, channels, activeChannel, setActiveChannel, fetchChannels]
  );

  const deleteChannel = useCallback(
    async (id: string) => {
      const ch = channels.find((c) => c.id === id);
      await deleteChannelApi(id, workspaceId);
      if (ch && ch.name === activeChannel) {
        setActiveChannel("default");
      }
      await fetchChannels();
    },
    [workspaceId, channels, activeChannel, setActiveChannel, fetchChannels]
  );

  return (
    <ChannelContext.Provider
      value={{
        channels,
        activeChannel,
        loading,
        setActiveChannel,
        createChannel,
        renameChannel,
        deleteChannel,
        refresh: fetchChannels,
      }}
    >
      {children}
    </ChannelContext.Provider>
  );
}

export function useChannel() {
  const ctx = useContext(ChannelContext);
  if (!ctx) {
    throw new Error("useChannel must be used within a ChannelProvider");
  }
  return ctx;
}
