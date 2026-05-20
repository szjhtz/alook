import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { getAllPosts } from "../src/lib/blog/posts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");

const errors: string[] = [];

for (const post of getAllPosts()) {
  const imgRegex = /<img[^>]+src="([^"]*)"[^>]*>/g;
  let match: RegExpExecArray | null;

  while ((match = imgRegex.exec(post.content)) !== null) {
    const src = match[1];

    if (!src.startsWith("/blog/")) {
      errors.push(
        `[post: ${post.slug}] Image src "${src}" must start with /blog/ — move the file to public/blog/`
      );
      continue;
    }

    const filePath = join(publicDir, src);
    if (!existsSync(filePath)) {
      errors.push(
        `[post: ${post.slug}] Image file not found: public${src}`
      );
    }
  }
}

if (errors.length > 0) {
  console.error("Blog asset validation failed:\n");
  for (const err of errors) {
    console.error(`  ✗ ${err}`);
  }
  console.error(`\n${errors.length} error(s) found.`);
  process.exit(1);
}

console.log("✓ Blog asset validation passed.");
