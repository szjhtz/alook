import { createHighlighter, type Highlighter } from "shiki";

let highlighter: Highlighter | null = null;

async function getHighlighter(): Promise<Highlighter> {
  if (!highlighter) {
    highlighter = await createHighlighter({
      themes: ["vitesse-light", "vitesse-dark"],
      langs: ["typescript", "javascript", "bash", "json", "html", "css", "tsx", "jsx", "yaml", "markdown", "python"],
    });
  }
  return highlighter;
}

function detectLanguage(code: string): string {
  if (code.includes("import ") || code.includes("export ") || code.includes("const ") || code.includes("async ") || code.includes("=>")) return "typescript";
  if (code.includes("npx ") || code.includes("pnpm ") || code.includes("npm ") || code.startsWith("$") || code.startsWith("#!")) return "bash";
  if (code.trim().startsWith("{") || code.trim().startsWith("[")) return "json";
  if (code.includes("<html") || code.includes("<!DOCTYPE")) return "html";
  if (code.includes("def ") || code.includes("print(")) return "python";
  return "typescript";
}

export async function highlightCodeBlocks(html: string): Promise<string> {
  const hl = await getHighlighter();

  return html.replace(
    /<pre><code(?:\s+class="language-(\w+)")?>([\s\S]*?)<\/code><\/pre>/g,
    (_, lang: string | undefined, code: string) => {
      const decoded = code
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

      const language = lang || detectLanguage(decoded);

      const highlighted = hl.codeToHtml(decoded.trim(), {
        lang: language,
        themes: { light: "vitesse-light", dark: "vitesse-dark" },
      });

      return highlighted;
    }
  );
}
