<script setup lang="ts">
import type { ContextMenuItemDescriptor } from '@endge/core'
import { Endge } from '@endge/core'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import {
  closeEndgeContextMenu,
  endgeContextMenuState,
  executeEndgeContextMenuItem,
  getContextMenuItems,
  resolveEndgeContextMenuItemLabel,
} from '@/ui/overlay/context-menu-manager'

const menuRef = ref<HTMLElement | null>(null)
const i18nVersion = ref(0)
const executing = ref(false)
let unsubscribeI18n: (() => void) | null = null

const menuItems = computed(() => {
  void i18nVersion.value
  return getContextMenuItems()
})
const position = computed(() => ({
  left: `${endgeContextMenuState.x}px`,
  top: `${endgeContextMenuState.y}px`,
}))

watch(
  () => endgeContextMenuState.open,
  async (open) => {
    if (!open) {
      removeGlobalListeners()
      return
    }

    addGlobalListeners()
    await nextTick()
    clampMenuToViewport()
    focusItem('first')
  },
  { flush: 'post' },
)

onBeforeUnmount(() => {
  removeGlobalListeners()
  unsubscribeI18n?.()
  unsubscribeI18n = null
})

onMounted(() => {
  unsubscribeI18n = Endge.i18n.subscribe(() => {
    i18nVersion.value += 1
  })
})

function addGlobalListeners(): void {
  document.addEventListener('mousedown', onDocumentMouseDown, true)
  document.addEventListener('keydown', onDocumentKeydown)
  window.addEventListener('resize', closeOnWindowChange, { passive: true })
  window.addEventListener('scroll', closeOnWindowChange, { passive: true, capture: true })
}

function removeGlobalListeners(): void {
  document.removeEventListener('mousedown', onDocumentMouseDown, true)
  document.removeEventListener('keydown', onDocumentKeydown)
  window.removeEventListener('resize', closeOnWindowChange)
  window.removeEventListener('scroll', closeOnWindowChange, true)
}

function onDocumentMouseDown(event: MouseEvent): void {
  if (menuRef.value?.contains(event.target as Node)) {
    return
  }

  closeEndgeContextMenu()
}

function onDocumentKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    closeEndgeContextMenu()
    return
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
    event.preventDefault()
    focusItem(event.key === 'ArrowDown' ? 'next' : event.key === 'ArrowUp' ? 'previous' : event.key === 'Home' ? 'first' : 'last')
  }
}

function closeOnWindowChange(): void {
  closeEndgeContextMenu()
}

function clampMenuToViewport(): void {
  const menu = menuRef.value
  if (!menu) {
    return
  }

  const rect = menu.getBoundingClientRect()
  const margin = 8
  const nextX = Math.min(endgeContextMenuState.x, window.innerWidth - rect.width - margin)
  const nextY = Math.min(endgeContextMenuState.y, window.innerHeight - rect.height - margin)

  endgeContextMenuState.x = Math.max(margin, nextX)
  endgeContextMenuState.y = Math.max(margin, nextY)
}

async function runItem(item: ContextMenuItemDescriptor): Promise<void> {
  if (executing.value || item.disabled) {
    return
  }
  executing.value = true
  try {
    await executeEndgeContextMenuItem(item)
  }
  catch (error) {
    console.error(`[EndgeContextMenu] Action "${item.action}" failed: ${error instanceof Error ? error.message : String(error)}`)
  }
  finally {
    executing.value = false
  }
}

function resolveItemLabel(item: ContextMenuItemDescriptor): string {
  void i18nVersion.value
  return resolveEndgeContextMenuItemLabel(item)
}

function focusItem(direction: 'first' | 'last' | 'next' | 'previous'): void {
  const items = [...(menuRef.value?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])]
  if (!items.length) {
    return
  }
  const activeIndex = items.indexOf(document.activeElement as HTMLButtonElement)
  const index = direction === 'first'
    ? 0
    : direction === 'last'
      ? items.length - 1
      : direction === 'next'
        ? (activeIndex + 1 + items.length) % items.length
        : (activeIndex - 1 + items.length) % items.length
  items[index]?.focus()
}

const iconPaths: Record<string, string[]> = {
  'table.column.pinLeft': ['M6 3h12v4l-2 2v4l2 2v4H6v-4l2-2V9L6 7V3Z', 'M12 7v14'],
  'table.column.pinRight': ['M6 3h12v4l-2 2v4l2 2v4H6v-4l2-2V9L6 7V3Z', 'M12 7v14'],
  'table.column.unpin': ['M5 5l14 14', 'M8 3h8v4l-2 2v3', 'M10 14l-4 4h12'],
  'table.column.hide': ['M3 3l18 18', 'M10.6 10.6a2 2 0 0 0 2.8 2.8', 'M9.9 4.2A10.5 10.5 0 0 1 21 12a11.8 11.8 0 0 1-2 2.8', 'M6.6 6.6A11.8 11.8 0 0 0 3 12a10.5 10.5 0 0 0 7.4 7.8'],
  'table.sort.setColumnAsc': ['M8 18V6', 'm4 10-4 4-4-4', 'M16 6h4', 'M16 10h3', 'M16 14h2'],
  'table.sort.setColumnDesc': ['M8 6v12', 'm4-4-4-4-4 4', 'M16 18h4', 'M16 14h3', 'M16 10h2'],
  'trash': ['M3 6h18', 'M8 6V4h8v2', 'M19 6l-1 15H6L5 6', 'M10 11v6', 'M14 11v6'],
  'copy': ['M8 8h12v12H8z', 'M4 16V4h12'],
  'external-link': ['M14 4h6v6', 'M20 4 10 14', 'M18 13v7H4V6h7'],
}

function resolveIconPaths(identity: string | undefined): string[] | null {
  return identity ? iconPaths[identity] ?? null : null
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="endgeContextMenuState.open && menuItems.length > 0"
      ref="menuRef"
      role="menu"
      class="endge-context-menu-root"
      :style="position"
      @click.stop
      @contextmenu.prevent.stop
    >
      <template
        v-for="item in menuItems"
        :key="item.id"
      >
        <div
          v-if="item.kind === 'separator'"
          role="separator"
          class="endge-context-menu-root__separator"
        />
        <button
          v-else
          type="button"
          role="menuitem"
          class="endge-context-menu-root__item"
          :disabled="executing || item.disabled"
          @click="runItem(item)"
        >
          <svg
            v-if="resolveIconPaths(item.icon ?? item.action)"
            class="endge-context-menu-root__icon"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              v-for="path in resolveIconPaths(item.icon ?? item.action)"
              :key="path"
              :d="path"
            />
          </svg>
          <span class="endge-context-menu-root__label">{{ resolveItemLabel(item) }}</span>
        </button>
      </template>
    </div>
  </Teleport>
</template>

<style scoped>
.endge-context-menu-root {
  position: fixed;
  z-index: 10050;
  min-width: 188px;
  max-width: min(320px, calc(100vw - 16px));
  max-height: calc(100vh - 16px);
  overflow-y: auto;
  padding: 5px;
  border: 1px solid hsl(var(--border, 214 32% 91%));
  border-radius: 8px;
  background: hsl(var(--popover, 0 0% 100%));
  color: hsl(var(--popover-foreground, var(--foreground, 222 47% 11%)));
  box-shadow:
    0 18px 48px rgb(0 0 0 / 0.16),
    0 3px 10px rgb(0 0 0 / 0.08);
  font-size: 13px;
  line-height: 1.35;
  animation: endge-menu-in 120ms cubic-bezier(.16, 1, .3, 1);
}

.endge-context-menu-root__item {
  display: flex;
  width: 100%;
  min-height: 32px;
  align-items: center;
  gap: 8px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  padding: 6px 9px;
  text-align: left;
}

.endge-context-menu-root__item:hover,
.endge-context-menu-root__item:focus-visible {
  background: hsl(var(--accent, 210 40% 96%));
  color: hsl(var(--accent-foreground, var(--foreground, 222 47% 11%)));
  outline: 2px solid hsl(var(--ring, 215 20% 65%) / 0.65);
  outline-offset: -2px;
}

.endge-context-menu-root__item:disabled {
  cursor: wait;
  opacity: 0.58;
}

.endge-context-menu-root__icon {
  width: 16px;
  flex: 0 0 16px;
  opacity: 0.72;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.endge-context-menu-root__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.endge-context-menu-root__separator {
  height: 1px;
  margin: 4px 2px;
  background: hsl(var(--border, 214 32% 91%));
}

@keyframes endge-menu-in {
  from { opacity: 0; transform: translateY(-2px) scale(.985); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@media (prefers-reduced-motion: reduce) {
  .endge-context-menu-root { animation: none; }
}
</style>
