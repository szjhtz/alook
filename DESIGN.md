## Design Context

### Users
Power users and tasteful hackers who want always-on AI agents with a minimalist, collaborative approach. They value control over their infrastructure, appreciate good tooling, and have strong aesthetic sensibilities. They use Alook in focused work sessions — managing agents, reviewing task output, and iterating on instructions.

### Brand Personality
**Warm, precise, and utilitarian.** Alook feels like a well-crafted tool made by someone who cares — not cold and corporate, not flashy and consumer. It earns trust through restraint and clarity. Every element has a reason.

3-word personality: **Warm. Sharp. Purposeful.**

Emotional goals: confidence, calm focus, quiet delight in small details.

### Aesthetic Direction
**Visual tone**: Notion-inspired warmth meets developer-tool precision. Soft neutral palette (warm grays, cream tints) with crisp typography and intentional micro-interactions. Light and airy in light mode, cozy and focused in dark mode.

**References**: Notion (polished, warm, delightful micro-interactions)

**Anti-references**:
- Generic SaaS dashboards (blue buttons, card grids, cookie-cutter layouts)
- AI chatbot UIs (ChatGPT-style centered chat with big rounded bubbles and gradients)
- Playful/consumer apps (bright colors, illustrations, emoji-heavy, gamification)

**Theme**: Both light and dark as first-class citizens. Warm-tinted neutrals in both modes — never pure gray.

### Design Principles

1. **Every pixel earns its place** — No decorative filler. If an element doesn't help the user accomplish their goal, remove it. Whitespace is a feature, not wasted space.

2. **Warm precision** — Technical doesn't mean cold. Use warm color tints, generous spacing, and thoughtful transitions to make the tool feel human without being cute.

3. **Progressive disclosure** — Start simple, reveal depth through interaction. The interface should feel approachable on first use and powerful on the hundredth.

4. **Motion with meaning** — Animate state changes to orient the user, not to impress. A well-timed 200ms transition beats a flashy 2-second animation.

5. **Respect the craft** — This is a tool for people who appreciate good tools. Match the quality they expect from their best CLI utilities — fast, predictable, and delightful in the details.

### Progressive disclosure

Never show all options at once. Complexity exists but stays one interaction away.

- **Hover to preview** — hovering a linked page shows a preview without navigating. Tooltips appear contextually, not eagerly.
- **Click to expand** — sidebar tree nodes, dropdown menus, and kanban column options are collapsed by default. Expanded state is driven by user action, not by default.
- **Scrolling reveals depth** — additional features and settings appear as the user scrolls or explores. The first screen is always clean.

## Visual Harmony

Every pixel should reduce mental load, not add it. Whitespace, typography, and hierarchy aren't cosmetic — they're how brains process information.

- The UI should fade into the background. If a user notices the tool instead of their content, something is wrong.
- Aim for visual calm: Japanese minimalism, Bauhaus clarity. No decoration that doesn't serve comprehension.
- If a feature makes the interface more complicated without making it more powerful, cut it.