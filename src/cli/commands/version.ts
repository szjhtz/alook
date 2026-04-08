import { Command } from "commander";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

export function versionCommand(): Command {
  const cmd = new Command("version")
    .description("Show CLI version")
    .action(() => {
      const __dirname = dirname(fileURLToPath(import.meta.url));
      let version = "unknown";
      try {
        const pkgPath = join(__dirname, "..", "package.json");
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
        version = pkg.version;
      } catch {
        try {
          const pkgPath = join(__dirname, "..", "..", "package.json");
          const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
          version = pkg.version;
        } catch {
          // fallback
        }
      }
      console.log(`alook version ${version}`);
    });

  return cmd;
}
