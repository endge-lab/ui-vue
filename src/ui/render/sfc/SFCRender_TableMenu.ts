import type {
  ComponentSFCTableMenuDescriptor,
  ContextMenuDescriptor,
  ContextMenuNodeDescriptor,
} from '@endge/core'

import type { SFCVueRenderContext } from '@/domain/types/sfc-render.type'
import { evaluateSFCValue } from '@/ui/render/sfc/SFCRender_Evaluator'

/** Materializes a compiled SFC menu only when its concrete row/column context exists. */
export function resolveSFCTableMenu(
  descriptor: ComponentSFCTableMenuDescriptor | null,
  context: SFCVueRenderContext,
): ContextMenuDescriptor | null {
  if (!descriptor) return null
  const items: ContextMenuNodeDescriptor[] = []
  for (const node of descriptor.items) {
    if (node.kind === 'separator') {
      items.push({ ...node })
      continue
    }
    const labelValue = evaluateSFCValue(node.label, context)
    const label = labelValue == null ? '' : String(labelValue).trim()
    if (!label) continue
    items.push({
      kind: 'item' as const,
      id: node.id,
      label,
      action: node.requiredPort
        ? context.portBindings?.find(binding => binding.kind === 'action' && binding.port === node.requiredPort)?.identity ?? node.action
        : node.action,
      ...(node.input ? { input: evaluateSFCValue(node.input, context) } : {}),
      ...(node.icon ? { icon: node.icon } : {}),
    })
  }
  return { kind: 'context-menu', items }
}
