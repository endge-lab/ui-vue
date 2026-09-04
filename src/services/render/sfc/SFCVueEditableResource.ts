/** Runtime-уведомление при изменении одной editable-сессии, принадлежащей host. */
export interface SFCVueEditableResourceUpdate {
  kind: 'editable'
  action: 'begin' | 'commit' | 'cancel'
  key: string
}

/** Сужает общие уведомления runtime-ресурса до обновлений editable-сессии. */
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
