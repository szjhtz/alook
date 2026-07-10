import type { ServerDetail } from "@/hooks/community/use-servers"

/**
 * Flip a single channel's `unread` flag inside a cached `ServerDetail`,
 * leaving every other channel/category untouched (same object references for
 * unrelated categories). Shared by both write directions so the cache is
 * always the single source of truth `useChannelTree`'s metadata merge can
 * trust:
 *
 * - WS `message.create` for a channel in the currently-open server → `true`.
 * - Clicking a channel in the sidebar (`channels/layout.tsx`) → `false`.
 *
 * Pure — exported for direct unit testing. No-ops (returns the input
 * unchanged, same reference) when `cache` is undefined or `channelId` isn't
 * found in any category.
 */
export function patchChannelUnread(
  cache: ServerDetail | undefined,
  channelId: string,
  unread: boolean,
): ServerDetail | undefined {
  if (!cache) return cache
  let touched = false
  const categories = cache.categories.map((cat) => {
    if (!cat.channels.some((c) => c.id === channelId)) return cat
    touched = true
    return {
      ...cat,
      channels: cat.channels.map((c) => (c.id === channelId ? { ...c, unread } : c)),
    }
  })
  return touched ? { ...cache, categories } : cache
}
