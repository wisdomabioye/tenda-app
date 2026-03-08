import type { LocalMessage } from '@/stores/chat.store'

export type GigDividerItem = {
  _type: 'divider'
  _key: string
  gig_id: string | null
  gig_title: string | null
}

export type FeedItem = LocalMessage | GigDividerItem

export function isDivider(item: FeedItem): item is GigDividerItem {
  return '_type' in item && item._type === 'divider'
}

/**
 * Takes messages in oldest-first order, inserts a GigDividerItem whenever
 * gig_id changes between adjacent messages, then reverses for an inverted FlatList.
 *
 * Rules:
 * - Insert divider when entering a new gig context (null → id, or id_A → id_B)
 * - Insert divider when leaving a gig context back to direct (id → null), but
 *   only if there was a previous message (not at the very start of conversation)
 * - No divider for direct messages at the start of a conversation
 */
export function buildMessageFeed(msgs: LocalMessage[]): FeedItem[] {
  const feed: FeedItem[] = []

  for (let i = 0; i < msgs.length; i++) {
    const curr = msgs[i]
    const prev = i > 0 ? msgs[i - 1] : null

    const contextChanged = curr.gig_id !== (prev?.gig_id ?? null)
    const shouldDivide   = contextChanged && (curr.gig_id !== null || prev !== null)

    if (shouldDivide) {
      feed.push({
        _type:     'divider',
        _key:      `divider_${curr.id}`,
        gig_id:    curr.gig_id,
        gig_title: curr.gig_title ?? null,
      })
    }

    feed.push(curr)
  }

  // Reverse so newest messages are at index 0, as required by inverted FlatList
  return feed.reverse()
}
