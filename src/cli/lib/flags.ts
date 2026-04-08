import { Command } from "commander";

export function flagOrEnv(
  cmd: Command,
  flagName: string,
  envKey: string,
  fallback: string,
): string {
  const opts = cmd.opts();
  if (opts[flagName]) return opts[flagName];
  if (process.env[envKey]) return process.env[envKey]!;
  return fallback;
}
