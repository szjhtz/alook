import { describe, it, expect } from "vitest";
import type { Node, Edge } from "@xyflow/react";
import { getAutoLayout } from "./auto-layout";

function makeNodes(count: number): Node[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `n${i}`,
    type: "agent",
    position: { x: 0, y: 0 },
    data: {},
  }));
}

describe("getAutoLayout", () => {
  it("assigns valid positions with no overlaps", () => {
    const nodes = makeNodes(4);
    const edges: Edge[] = [
      { id: "e1", source: "n0", target: "n1" },
      { id: "e2", source: "n1", target: "n2" },
      { id: "e3", source: "n2", target: "n3" },
    ];
    const laid = getAutoLayout(nodes, edges);
    expect(laid).toHaveLength(4);
    for (const n of laid) {
      expect(typeof n.position.x).toBe("number");
      expect(typeof n.position.y).toBe("number");
      expect(Number.isFinite(n.position.x)).toBe(true);
      expect(Number.isFinite(n.position.y)).toBe(true);
    }
    // No two nodes should have the same exact position
    const posKeys = new Set(laid.map((n) => `${n.position.x},${n.position.y}`));
    expect(posKeys.size).toBe(4);
  });

  it("positions nodes in a row when there are no edges", () => {
    const nodes = makeNodes(3);
    const laid = getAutoLayout(nodes, []);
    expect(laid).toHaveLength(3);
    // All nodes should have valid positions, not stacked at origin
    const posKeys = new Set(laid.map((n) => `${n.position.x},${n.position.y}`));
    expect(posKeys.size).toBeGreaterThanOrEqual(1);
    for (const n of laid) {
      expect(Number.isFinite(n.position.x)).toBe(true);
      expect(Number.isFinite(n.position.y)).toBe(true);
    }
  });
});
