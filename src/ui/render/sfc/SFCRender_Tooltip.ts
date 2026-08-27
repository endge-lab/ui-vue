import type {
  EndgeTooltipMarkdownBlock,
  EndgeTooltipMarkdownInline,
  RComponentSFC_IR_Node,
} from '@endge/core'
import type { SFCVueRenderContext, SFCVueRenderFunction } from '@/model/render/sfc/sfc-vue-render.type'
import {
  createEndgeTooltipDomId,
  parseEndgeTooltipMarkdown,
} from '@endge/core'

import { cloneVNode, isVNode } from 'vue'
import { attachEndgeTooltipTriggerAttrs } from '@/ui/overlay/tooltip/endge-tooltip-manager'
import { evaluateSFCValue } from '@/ui/render/sfc/SFCRender_Evaluator'

/** Lazy compound renderer. Trigger renders now; tooltip content factory runs only after openDelay. */
export const SFCRender_Tooltip: SFCVueRenderFunction = (input) => {
  const triggerWrapper = input.node.children.find(isTooltipTrigger)
  const contentWrapper = input.node.children.find(isTooltipContent)
  const kind = input.node.props.text ? 'text' : input.node.props.markdown ? 'markdown' : 'rich'
  const triggerNodes = triggerWrapper?.children ?? input.node.children
  const contentNodes = contentWrapper?.children ?? []
  const trigger = input.renderNodes(triggerNodes, input.context)
  if (trigger.length === 0) {
    return null
  }

  const boundaryId = (input.context.host?.id ?? input.context.componentStack.join('>')) || 'sfc'
  const ownerId = `${boundaryId}:${input.context.consumerScope}:${input.node.id}`
  const attrs: Record<string, unknown> = {}
  attachEndgeTooltipTriggerAttrs(attrs, input.context.tooltipManager ?? null, anchor => ({
    ownerId,
    domId: createEndgeTooltipDomId(ownerId),
    anchor,
    kind,
    policy: {
      side: evaluateProp(input, 'side') as any,
      align: evaluateProp(input, 'align') as any,
      openDelay: evaluateProp(input, 'openDelay', 'open-delay') as any,
      closeDelay: evaluateProp(input, 'closeDelay', 'close-delay') as any,
    },
    authoredId: optionalText(evaluateProp(input, 'id')),
    className: evaluateProp(input, 'class'),
    part: optionalText(evaluateProp(input, 'part')),
    renderContent: () => {
      if (kind === 'text') {
        return String(evaluateProp(input, 'text') ?? '')
      }
      if (kind === 'markdown') {
        return renderMarkdown(input, evaluateProp(input, 'markdown'))
      }
      const contentContext = createLazyContentContext(input.context)
      return input.renderNodes(contentNodes, contentContext)
    },
  }))

  const only = trigger.length === 1 ? trigger[0] : null
  if (only && isVNode(only)) {
    return cloneVNode(only, attrs, true)
  }
  return input.h('span', {
    ...attrs,
    class: 'endge-tooltip-trigger',
    style: { display: 'inline-flex', minWidth: 0 },
  }, trigger)
}

function renderMarkdown(input: Parameters<SFCVueRenderFunction>[0], source: unknown) {
  return parseEndgeTooltipMarkdown(source).map((block, index) => renderBlock(input, block, index))
}

function renderBlock(
  input: Parameters<SFCVueRenderFunction>[0],
  block: EndgeTooltipMarkdownBlock,
  key: number,
) {
  if (block.kind === 'heading') {
    return input.h(`h${block.level}`, { key, class: 'endge-tooltip__heading' }, renderInline(input, block.children))
  }
  if (block.kind === 'paragraph') {
    return input.h('p', { key, class: 'endge-tooltip__paragraph' }, renderInline(input, block.children))
  }
  if (block.kind === 'code-block') {
    return input.h('pre', { key, class: 'endge-tooltip__code-block' }, [input.h('code', null, block.value)])
  }
  return input.h(block.ordered ? 'ol' : 'ul', { key, class: 'endge-tooltip__list' }, block.items.map((item, index) => (
    input.h('li', { key: index }, renderInline(input, item))
  )))
}

function renderInline(
  input: Parameters<SFCVueRenderFunction>[0],
  nodes: EndgeTooltipMarkdownInline[],
): any[] {
  return nodes.map((node, index) => {
    if (node.kind === 'text') {
      return node.value
    }
    if (node.kind === 'code') {
      return input.h('code', { key: index }, node.value)
    }
    if (node.kind === 'strong') {
      return input.h('strong', { key: index }, renderInline(input, node.children))
    }
    if (node.kind === 'emphasis') {
      return input.h('em', { key: index }, renderInline(input, node.children))
    }
    return input.h('a', {
      key: index,
      href: node.href,
      tabindex: -1,
      rel: 'noreferrer noopener',
    }, renderInline(input, node.children))
  })
}

function evaluateProp(
  input: Parameters<SFCVueRenderFunction>[0],
  ...names: string[]
): unknown {
  for (const name of names) {
    const value = input.node.props[name]
    if (value) {
      return evaluateSFCValue(value, input.context)
    }
  }
  return undefined
}

function createLazyContentContext(context: SFCVueRenderContext): SFCVueRenderContext {
  return { ...context, inspectionParentId: context.inspectionParentId }
}

function isTooltipTrigger(node: RComponentSFC_IR_Node): node is Extract<RComponentSFC_IR_Node, { kind: 'element' }> {
  return node.kind === 'element' && node.tag === 'TooltipTrigger'
}

function isTooltipContent(node: RComponentSFC_IR_Node): node is Extract<RComponentSFC_IR_Node, { kind: 'element' }> {
  return node.kind === 'element' && node.tag === 'TooltipContent'
}

function optionalText(value: unknown): string | undefined {
  const normalized = String(value ?? '').trim()
  return normalized || undefined
}
