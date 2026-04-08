import { Command } from "commander";
import { loadCLIConfig, configPath } from "../lib/config.js";
import { printJSON } from "../lib/output.js";

export function configCommand(): Command {
  const cmd = new Command("config").description("Manage CLI configuration");

  cmd
    .command("show")
    .description("Show current configuration")
    .action(() => {
      const cfg = loadCLIConfig();
      printJSON(cfg);
    });

  cmd
    .command("path")
    .description("Show config file path")
    .action(() => {
      console.log(configPath());
    });

  return cmd;
}
