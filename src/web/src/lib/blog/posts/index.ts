// HOW TO ADD A NEW POST:
// 1. Create a new .ts file in this directory (use the slug as filename, e.g. my-new-post.ts)
// 2. Import it below and add it to the `posts` array
// 3. Images go in public/blog/<slug>/, reference as <img src="/blog/<slug>/filename.png" />
//
// SUPPORTED HTML TAGS (styled by the blog template):
//   <h2>         — Section headings (don't use h1, the post title is h1)
//   <p>          — Paragraphs (wrap ALL text in <p> tags)
//   <strong>     — Bold text
//   <em>         — Italic text
//   <a href="">  — Links
//   <ul><li>     — Unordered lists
//   <blockquote> — Pull quotes
//   <code>       — Inline code
//   <pre><code>  — Code blocks (syntax highlighted via Shiki)
//                  Optional: class="language-xxx" for explicit language
//   <img>        — Images (full width, rounded)
//
// RULES: wrap all text in <p>, don't use <h1>, keep slugs unique

import type { BlogPost } from "../types";

import buildingYourFirstAgentTeam from "./building-your-first-agent-team";
import whyWeBuiltAlook from "./why-we-built-alook";

const posts: BlogPost[] = [buildingYourFirstAgentTeam, whyWeBuiltAlook];

export type { BlogPost } from "../types";

export function getAllPosts(): BlogPost[] {
  return [...posts].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

export function getPostBySlug(slug: string): BlogPost | undefined {
  return posts.find((p) => p.slug === slug);
}
