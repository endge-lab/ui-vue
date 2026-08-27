<script setup lang="ts">
import type { EndgeTooltipAlign, EndgeTooltipSide } from '@endge/core'
import type { EndgeVueTooltipManager } from './endge-tooltip-manager'

import { computed, defineComponent, nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps<{ manager: EndgeVueTooltipManager }>()
const tooltipRef = ref<HTMLElement | null>(null)
const position = ref({ left: '-10000px', top: '-10000px' })
const actualSide = ref<EndgeTooltipSide>('right')
let resizeObserver: ResizeObserver | null = null

const state = props.manager.state
const classes = computed(() => [
  'endge-tooltip',
  `endge-tooltip--${props.manager.adapterId}`,
  `endge-tooltip--${state.kind}`,
  state.className,
])

const ContentRenderer = defineComponent({
  name: 'EndgeTooltipLazyContent',
  setup: () => () => state.content as any,
})

watch(
  () => state.phase,
  async (phase) => {
    cleanupPlacement()
    if (phase !== 'visible') {
      return
    }
    await nextTick()
    if (!state.anchor?.isConnected) {
      props.manager.close(state.ownerId ?? undefined)
      return
    }
    updatePosition()
    window.addEventListener('resize', updatePosition, { passive: true })
    window.addEventListener('scroll', updatePosition, { passive: true, capture: true })
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updatePosition)
      if (state.anchor) {
        resizeObserver.observe(state.anchor)
      }
      if (tooltipRef.value) {
        resizeObserver.observe(tooltipRef.value)
      }
    }
  },
  { flush: 'post' },
)

onBeforeUnmount(cleanupPlacement)

function cleanupPlacement(): void {
  window.removeEventListener('resize', updatePosition)
  window.removeEventListener('scroll', updatePosition, true)
  resizeObserver?.disconnect()
  resizeObserver = null
}

function updatePosition(): void {
  const anchor = state.anchor
  const tooltip = tooltipRef.value
  if (!anchor?.isConnected || !tooltip) {
    if (state.phase === 'visible') {
      props.manager.close(state.ownerId ?? undefined)
    }
    return
  }
  const placement = placeTooltip(
    anchor.getBoundingClientRect(),
    tooltip.getBoundingClientRect(),
    state.policy.side,
    state.policy.align,
  )
  actualSide.value = placement.side
  position.value = { left: `${placement.left}px`, top: `${placement.top}px` }
}

function placeTooltip(
  anchor: DOMRect,
  tooltip: DOMRect,
  preferredSide: EndgeTooltipSide,
  align: EndgeTooltipAlign,
): { left: number, top: number, side: EndgeTooltipSide } {
  const gap = 8
  const margin = 6
  const candidates: EndgeTooltipSide[] = [preferredSide, opposite(preferredSide)]
  let best = coordinates(candidates[0]!, anchor, tooltip, align, gap)
  let bestOverflow = overflow(best.left, best.top, tooltip, margin)
  for (const side of candidates.slice(1)) {
    const candidate = coordinates(side, anchor, tooltip, align, gap)
    const candidateOverflow = overflow(candidate.left, candidate.top, tooltip, margin)
    if (candidateOverflow < bestOverflow) {
      best = candidate
      bestOverflow = candidateOverflow
    }
  }
  return {
    side: best.side,
    left: Math.max(margin, Math.min(best.left, window.innerWidth - tooltip.width - margin)),
    top: Math.max(margin, Math.min(best.top, window.innerHeight - tooltip.height - margin)),
  }
}

function coordinates(
  side: EndgeTooltipSide,
  anchor: DOMRect,
  tooltip: DOMRect,
  align: EndgeTooltipAlign,
  gap: number,
): { left: number, top: number, side: EndgeTooltipSide } {
  const horizontal = side === 'top' || side === 'bottom'
  const crossStart = horizontal ? anchor.left : anchor.top
  const crossSize = horizontal ? anchor.width : anchor.height
  const tooltipCrossSize = horizontal ? tooltip.width : tooltip.height
  const cross = align === 'start'
    ? crossStart
    : align === 'end'
      ? crossStart + crossSize - tooltipCrossSize
      : crossStart + (crossSize - tooltipCrossSize) / 2
  if (side === 'top') {
    return { side, left: cross, top: anchor.top - tooltip.height - gap }
  }
  if (side === 'bottom') {
    return { side, left: cross, top: anchor.bottom + gap }
  }
  if (side === 'left') {
    return { side, left: anchor.left - tooltip.width - gap, top: cross }
  }
  return { side, left: anchor.right + gap, top: cross }
}

function overflow(left: number, top: number, tooltip: DOMRect, margin: number): number {
  return Math.max(0, margin - left)
    + Math.max(0, margin - top)
    + Math.max(0, left + tooltip.width + margin - window.innerWidth)
    + Math.max(0, top + tooltip.height + margin - window.innerHeight)
}

function opposite(side: EndgeTooltipSide): EndgeTooltipSide {
  return ({ top: 'bottom', right: 'left', bottom: 'top', left: 'right' } as const)[side]
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="state.phase === 'visible'"
      :id="state.domId ?? undefined"
      ref="tooltipRef"
      role="tooltip"
      :class="classes"
      :style="position"
      :part="state.part ?? undefined"
      data-endge-tooltip=""
      :data-endge-tooltip-adapter="manager.adapterId"
      :data-endge-tooltip-id="state.authoredId ?? undefined"
      :data-side="actualSide"
      :data-align="state.policy.align"
    >
      <ContentRenderer />
    </div>
  </Teleport>
</template>

<style>
.endge-tooltip {
  position: fixed;
  z-index: var(--endge-tooltip-z-index, 10060);
  width: max-content;
  max-width: min(var(--endge-tooltip-max-width, 320px), calc(100vw - 12px));
  padding: var(--endge-tooltip-padding, 6px 9px);
  border: var(--endge-tooltip-border, 1px solid rgb(255 255 255 / 0.12));
  border-radius: var(--endge-tooltip-radius, 6px);
  background: var(--endge-tooltip-background, rgb(24 24 27));
  color: var(--endge-tooltip-color, rgb(250 250 250));
  box-shadow: var(--endge-tooltip-shadow, 0 8px 24px rgb(0 0 0 / 0.22));
  font-size: var(--endge-tooltip-font-size, 12px);
  line-height: var(--endge-tooltip-line-height, 1.4);
  overflow-wrap: anywhere;
  pointer-events: none;
}

.endge-tooltip--markdown > :first-child,
.endge-tooltip--rich > :first-child { margin-top: 0; }
.endge-tooltip--markdown > :last-child,
.endge-tooltip--rich > :last-child { margin-bottom: 0; }
.endge-tooltip p { margin: 0.35em 0; }
.endge-tooltip ul,
.endge-tooltip ol { margin: 0.35em 0; padding-left: 1.25em; }
.endge-tooltip pre { margin: 0.4em 0; white-space: pre-wrap; }
.endge-tooltip code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.endge-tooltip a { color: inherit; text-decoration: underline; }
</style>
