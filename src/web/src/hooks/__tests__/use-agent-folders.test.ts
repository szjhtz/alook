import { describe, it, expect } from "vitest";

interface AgentFolder {
  id: string;
  agentIds: string[];
}

interface FolderState {
  folders: AgentFolder[];
}

type TopLevelItem =
  | { type: "agent"; id: string }
  | { type: "folder"; folder: AgentFolder };

// Pure logic extracted from the hook for testing

function createFolder(prev: FolderState, agentIds: string[], folderId: string): FolderState {
  if (agentIds.length < 2) return prev;
  const existingAgentIds = new Set(prev.folders.flatMap((f) => f.agentIds));
  const clean = agentIds.filter((a) => !existingAgentIds.has(a));
  if (clean.length < 2) return prev;
  return { folders: [...prev.folders, { id: folderId, agentIds: clean }] };
}

function addToFolder(prev: FolderState, folderId: string, agentId: string): FolderState {
  const alreadyInFolder = prev.folders.some((f) => f.agentIds.includes(agentId));
  if (alreadyInFolder) return prev;
  return {
    folders: prev.folders.map((f) =>
      f.id === folderId ? { ...f, agentIds: [...f.agentIds, agentId] } : f
    ),
  };
}

function removeFromFolder(prev: FolderState, folderId: string, agentId: string): FolderState {
  const updated = prev.folders.map((f) =>
    f.id === folderId ? { ...f, agentIds: f.agentIds.filter((id) => id !== agentId) } : f
  );
  return { folders: updated.filter((f) => f.agentIds.length > 1) };
}

function dissolveFolder(prev: FolderState, folderId: string): FolderState {
  return { folders: prev.folders.filter((f) => f.id !== folderId) };
}

function reorderInFolder(prev: FolderState, folderId: string, orderedAgentIds: string[]): FolderState {
  return {
    folders: prev.folders.map((f) =>
      f.id === folderId ? { ...f, agentIds: orderedAgentIds } : f
    ),
  };
}

function mergeFolders(prev: FolderState, sourceFolderId: string, targetFolderId: string): FolderState {
  const source = prev.folders.find((f) => f.id === sourceFolderId);
  if (!source) return prev;
  return {
    folders: prev.folders
      .map((f) =>
        f.id === targetFolderId
          ? { ...f, agentIds: [...f.agentIds, ...source.agentIds] }
          : f
      )
      .filter((f) => f.id !== sourceFolderId),
  };
}

function cleanupStaleAgents(prev: FolderState, validAgentIds: string[]): FolderState {
  const valid = new Set(validAgentIds);
  const cleaned = prev.folders.map((f) => ({
    ...f,
    agentIds: f.agentIds.filter((id) => valid.has(id)),
  }));
  return { folders: cleaned.filter((f) => f.agentIds.length > 1) };
}

function getFolderForAgent(folders: AgentFolder[], agentId: string): AgentFolder | null {
  return folders.find((f) => f.agentIds.includes(agentId)) ?? null;
}

function getTopLevelItems(folders: AgentFolder[], agentIds: string[]): TopLevelItem[] {
  const agentToFolder = new Map<string, AgentFolder>();
  for (const f of folders) {
    for (const aid of f.agentIds) {
      agentToFolder.set(aid, f);
    }
  }

  const seen = new Set<string>();
  const items: TopLevelItem[] = [];

  for (const agentId of agentIds) {
    const folder = agentToFolder.get(agentId);
    if (folder) {
      if (!seen.has(folder.id)) {
        seen.add(folder.id);
        items.push({ type: "folder", folder });
      }
    } else {
      items.push({ type: "agent", id: agentId });
    }
  }

  return items;
}

describe("useAgentFolders logic", () => {
  const empty: FolderState = { folders: [] };

  describe("createFolder", () => {
    it("creates a folder with given agent IDs", () => {
      const result = createFolder(empty, ["a1", "a2"], "f1");
      expect(result.folders).toHaveLength(1);
      expect(result.folders[0]).toEqual({ id: "f1", agentIds: ["a1", "a2"] });
    });

    it("rejects creation with fewer than 2 agents", () => {
      const result = createFolder(empty, ["a1"], "f1");
      expect(result).toBe(empty);
    });

    it("excludes agents already in other folders", () => {
      const state: FolderState = { folders: [{ id: "f1", agentIds: ["a1", "a2"] }] };
      const result = createFolder(state, ["a1", "a3"], "f2");
      expect(result).toBe(state); // a1 already in f1, only a3 left = < 2
    });

    it("creates folder from agents not yet in any folder", () => {
      const state: FolderState = { folders: [{ id: "f1", agentIds: ["a1", "a2"] }] };
      const result = createFolder(state, ["a3", "a4"], "f2");
      expect(result.folders).toHaveLength(2);
      expect(result.folders[1]).toEqual({ id: "f2", agentIds: ["a3", "a4"] });
    });
  });

  describe("addToFolder", () => {
    it("appends agent to existing folder", () => {
      const state: FolderState = { folders: [{ id: "f1", agentIds: ["a1", "a2"] }] };
      const result = addToFolder(state, "f1", "a3");
      expect(result.folders[0].agentIds).toEqual(["a1", "a2", "a3"]);
    });

    it("does not add agent already in a folder", () => {
      const state: FolderState = { folders: [{ id: "f1", agentIds: ["a1", "a2"] }] };
      const result = addToFolder(state, "f1", "a1");
      expect(result).toBe(state);
    });
  });

  describe("mergeFolders", () => {
    it("moves all agents from source to target and removes source", () => {
      const state: FolderState = {
        folders: [
          { id: "f1", agentIds: ["a1", "a2"] },
          { id: "f2", agentIds: ["a3", "a4"] },
        ],
      };
      const result = mergeFolders(state, "f1", "f2");
      expect(result.folders).toHaveLength(1);
      expect(result.folders[0].id).toBe("f2");
      expect(result.folders[0].agentIds).toEqual(["a3", "a4", "a1", "a2"]);
    });

    it("returns unchanged state if source folder not found", () => {
      const state: FolderState = { folders: [{ id: "f1", agentIds: ["a1", "a2"] }] };
      const result = mergeFolders(state, "nonexistent", "f1");
      expect(result).toBe(state);
    });
  });

  describe("removeFromFolder", () => {
    it("removes agent from folder", () => {
      const state: FolderState = { folders: [{ id: "f1", agentIds: ["a1", "a2", "a3"] }] };
      const result = removeFromFolder(state, "f1", "a3");
      expect(result.folders[0].agentIds).toEqual(["a1", "a2"]);
    });

    it("auto-dissolves folder when <= 1 agent remains", () => {
      const state: FolderState = { folders: [{ id: "f1", agentIds: ["a1", "a2"] }] };
      const result = removeFromFolder(state, "f1", "a2");
      expect(result.folders).toHaveLength(0);
    });
  });

  describe("dissolveFolder", () => {
    it("removes the folder entirely", () => {
      const state: FolderState = { folders: [{ id: "f1", agentIds: ["a1", "a2"] }] };
      const result = dissolveFolder(state, "f1");
      expect(result.folders).toHaveLength(0);
    });

    it("leaves other folders intact", () => {
      const state: FolderState = {
        folders: [
          { id: "f1", agentIds: ["a1", "a2"] },
          { id: "f2", agentIds: ["a3", "a4"] },
        ],
      };
      const result = dissolveFolder(state, "f1");
      expect(result.folders).toHaveLength(1);
      expect(result.folders[0].id).toBe("f2");
    });
  });

  describe("reorderInFolder", () => {
    it("updates agent order within a folder", () => {
      const state: FolderState = { folders: [{ id: "f1", agentIds: ["a1", "a2", "a3"] }] };
      const result = reorderInFolder(state, "f1", ["a3", "a1", "a2"]);
      expect(result.folders[0].agentIds).toEqual(["a3", "a1", "a2"]);
    });
  });

  describe("cleanupStaleAgents", () => {
    it("removes non-existent agent IDs", () => {
      const state: FolderState = { folders: [{ id: "f1", agentIds: ["a1", "a2", "a3"] }] };
      const result = cleanupStaleAgents(state, ["a1", "a3"]);
      expect(result.folders[0].agentIds).toEqual(["a1", "a3"]);
    });

    it("auto-dissolves folders reduced to <= 1 agent", () => {
      const state: FolderState = { folders: [{ id: "f1", agentIds: ["a1", "a2"] }] };
      const result = cleanupStaleAgents(state, ["a1"]);
      expect(result.folders).toHaveLength(0);
    });

    it("handles empty valid agents list", () => {
      const state: FolderState = { folders: [{ id: "f1", agentIds: ["a1", "a2"] }] };
      const result = cleanupStaleAgents(state, []);
      expect(result.folders).toHaveLength(0);
    });
  });

  describe("getFolderForAgent", () => {
    it("returns the folder containing the agent", () => {
      const folders: AgentFolder[] = [{ id: "f1", agentIds: ["a1", "a2"] }];
      const result = getFolderForAgent(folders, "a2");
      expect(result?.id).toBe("f1");
    });

    it("returns null if agent is not in any folder", () => {
      const folders: AgentFolder[] = [{ id: "f1", agentIds: ["a1", "a2"] }];
      const result = getFolderForAgent(folders, "a3");
      expect(result).toBeNull();
    });
  });

  describe("getTopLevelItems", () => {
    it("returns flat list when no folders exist", () => {
      const result = getTopLevelItems([], ["a1", "a2", "a3"]);
      expect(result).toEqual([
        { type: "agent", id: "a1" },
        { type: "agent", id: "a2" },
        { type: "agent", id: "a3" },
      ]);
    });

    it("reconciles server pin order with folder groupings", () => {
      const folders: AgentFolder[] = [{ id: "f1", agentIds: ["b", "c"] }];
      const result = getTopLevelItems(folders, ["a", "b", "c", "d", "e"]);
      expect(result).toEqual([
        { type: "agent", id: "a" },
        { type: "folder", folder: folders[0] },
        { type: "agent", id: "d" },
        { type: "agent", id: "e" },
      ]);
    });

    it("places folder at position of its first agent in server order", () => {
      const folders: AgentFolder[] = [{ id: "f1", agentIds: ["c", "a"] }];
      // Server order: a, b, c — "a" appears first, so folder placed at a's position
      const result = getTopLevelItems(folders, ["a", "b", "c"]);
      expect(result).toEqual([
        { type: "folder", folder: folders[0] },
        { type: "agent", id: "b" },
      ]);
    });

    it("handles multiple folders", () => {
      const folders: AgentFolder[] = [
        { id: "f1", agentIds: ["a", "b"] },
        { id: "f2", agentIds: ["d", "e"] },
      ];
      const result = getTopLevelItems(folders, ["a", "b", "c", "d", "e"]);
      expect(result).toEqual([
        { type: "folder", folder: folders[0] },
        { type: "agent", id: "c" },
        { type: "folder", folder: folders[1] },
      ]);
    });

    it("skips subsequent folder agents after the folder is placed", () => {
      const folders: AgentFolder[] = [{ id: "f1", agentIds: ["a", "c"] }];
      const result = getTopLevelItems(folders, ["a", "b", "c"]);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ type: "folder", folder: folders[0] });
      expect(result[1]).toEqual({ type: "agent", id: "b" });
    });
  });
});
