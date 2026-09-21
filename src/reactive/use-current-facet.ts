import { Endge } from '@endge/core'
import { onScopeDispose, ref } from 'vue'

/** Reactive selection of one dynamic facet in the current execution context. */
export function useCurrentFacet(facetIdentity: string) {
  const facet = String(facetIdentity ?? '').trim()
  if (!facet) {
    throw new Error('[useCurrentFacet] facetIdentity is required')
  }

  const current = ref<string | null>(Endge.context.getFacetSelection(facet))
  const off = Endge.context.subscribe(() => {
    current.value = Endge.context.getFacetSelection(facet)
  })
  onScopeDispose(off)

  return {
    current,
    locked: () => Endge.context.isFacetLockedBySession(facet),
    setCurrent: (document: string) => Endge.commands.execute({
      type: 'context:set-facet',
      payload: { facet, document },
    }),
  }
}
