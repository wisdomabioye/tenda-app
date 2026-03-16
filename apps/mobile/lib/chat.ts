import type { LocalMessage } from '@/stores/chat.store'

export type ContextDividerItem = {
  _type: 'divider'
  _key: string
  gig_id: string | null
  gig_title: string | null
  offer_id: string | null
  offer_title: string | null
}

export type FeedItem = LocalMessage | ContextDividerItem

export function isDivider(item: FeedItem): item is ContextDividerItem {
  return '_type' in item && item._type === 'divider'
}

/**
 * Takes messages in oldest-first order, inserts a ContextDividerItem whenever
 * context (gig_id or offer_id) changes between adjacent messages, then reverses
 * for an inverted FlatList.
 *
 * Rules:
 * - Insert divider when entering a new context (null → id, or id_A → id_B)
 * - Insert divider when leaving a context back to direct (id → null), but
 *   only if there was a previous message (not at the very start of conversation)
 * - No divider for direct messages at the start of a conversation
 */
export function buildMessageFeed(msgs: LocalMessage[]): FeedItem[] {
  const feed: FeedItem[] = []

  for (let i = 0; i < msgs.length; i++) {
    const curr = msgs[i]
    const prev = i > 0 ? msgs[i - 1] : null

    const currContext = curr.gig_id ?? curr.offer_id ?? null
    const prevContext = prev ? (prev.gig_id ?? prev.offer_id ?? null) : null

    const contextChanged = currContext !== prevContext
    const shouldDivide   = contextChanged && (currContext !== null || prev !== null)

    if (shouldDivide) {
      feed.push({
        _type:       'divider',
        _key:        `divider_${curr.id}`,
        gig_id:      curr.gig_id,
        gig_title:   curr.gig_title ?? null,
        offer_id:    curr.offer_id,
        offer_title: curr.offer_title ?? null,
      })
    }

    feed.push(curr)
  }

  // Reverse so newest messages are at index 0, as required by inverted FlatList
  return feed.reverse()
}
