/** Runtime notification emitted when one host-owned editable session changes. */
export interface SFCVueEditableResourceUpdate {
  kind: 'editable'
  action: 'begin' | 'commit' | 'cancel'
  key: string
}

/** Narrows generic runtime resource notifications to editable-session updates. */
export function isSFCVueEditableResourceUpdate(value: unknown): value is SFCVueEditableResourceUpdate {
  if (!value || typeof value !== 'object') {
    return false
  }
  const update = value as Partial<SFCVueEditableResourceUpdate>
  return update.kind === 'editable'
    && (update.action === 'begin' || update.action === 'commit' || update.action === 'cancel')
    && typeof update.key === 'string'
    && update.key.length > 0
}
