import { vi, describe, it, expect, afterEach } from "vitest";
import { flagOrEnv } from "./flags.js";

function makeCmd(opts: Record<string, string>) {
  return { opts: () => opts } as any;
}

afterEach(() => {
  delete process.env.TEST_FLAG_ENV;
});

describe("flagOrEnv", () => {
  it("returns flag value when set", () => {
    const cmd = makeCmd({ myFlag: "from-flag" });
    expect(flagOrEnv(cmd, "myFlag", "TEST_FLAG_ENV", "default")).toBe(
      "from-flag",
    );
  });

  it("returns env var when flag not set", () => {
    process.env.TEST_FLAG_ENV = "from-env";
    const cmd = makeCmd({});
    expect(flagOrEnv(cmd, "myFlag", "TEST_FLAG_ENV", "default")).toBe(
      "from-env",
    );
  });

  it("returns fallback when neither set", () => {
    const cmd = makeCmd({});
    expect(flagOrEnv(cmd, "myFlag", "TEST_FLAG_ENV", "default")).toBe(
      "default",
    );
  });

  it("flag takes priority over env var", () => {
    process.env.TEST_FLAG_ENV = "from-env";
    const cmd = makeCmd({ myFlag: "from-flag" });
    expect(flagOrEnv(cmd, "myFlag", "TEST_FLAG_ENV", "default")).toBe(
      "from-flag",
    );
  });
});
