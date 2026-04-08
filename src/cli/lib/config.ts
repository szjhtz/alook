import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

interface WatchedWorkspace {
  id: string;
  name: string;
}

interface ProfileConfig {
  token: string;
  server_url: string;
  watched_workspaces: WatchedWorkspace[];
}

interface CLIConfig {
  token?: string;
  server_url?: string;
  watched_workspaces?: WatchedWorkspace[];
  default_profile?: string;
  profiles?: Record<string, ProfileConfig>;
}

export type { CLIConfig, ProfileConfig, WatchedWorkspace };

export function configPath(): string {
  return join(homedir(), ".alook", "config.json");
}

export function loadCLIConfig(): CLIConfig {
  try {
    return JSON.parse(readFileSync(configPath(), "utf-8"));
  } catch {
    return {};
  }
}

export function loadCLIConfigForProfile(profile?: string): ProfileConfig {
  const cfg = loadCLIConfig();
  const profileName = profile || cfg.default_profile;
  if (profileName && cfg.profiles?.[profileName]) {
    return cfg.profiles[profileName];
  }
  return {
    token: cfg.token || "",
    server_url: cfg.server_url || "",
    watched_workspaces: cfg.watched_workspaces || [],
  };
}

export function saveCLIConfig(cfg: CLIConfig): void {
  const dir = join(homedir(), ".alook");
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  writeFileSync(configPath(), JSON.stringify(cfg, null, 2), { mode: 0o600 });
}

export function saveCLIConfigForProfile(
  profile: string | undefined,
  profileConfig: ProfileConfig,
): void {
  const cfg = loadCLIConfig();
  if (profile) {
    if (!cfg.profiles) cfg.profiles = {};
    cfg.profiles[profile] = profileConfig;
  } else {
    cfg.token = profileConfig.token;
    cfg.server_url = profileConfig.server_url;
    cfg.watched_workspaces = profileConfig.watched_workspaces;
  }
  saveCLIConfig(cfg);
}
