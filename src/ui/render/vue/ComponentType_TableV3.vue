<script lang="ts" setup>
import type {
  RComponentTable,
  RComponentTableColumn,
  RuntimeHost,
} from '@endge/core'

import { Endge, RComponentTableColumn_isHtml } from '@endge/core'
import { Raph } from '@endge/raph'
import RevoGrid from '@revolist/vue3-datagrid'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import ComponentType_TableCell from '@/ui/render/ts/ComponentType_TableCell'

const props = defineProps<{
  runtime: RuntimeHost<'table'>
}>()

const gridRef = ref<any>(null)
const source = ref<any[]>([])

/** runtime -> meta */
const tableId = computed(() =>
  String(props.runtime?.node?.meta?.entityId ?? ''),
)
const basePath = computed(() =>
  String(props.runtime?.node?.meta?.basePath ?? ''),
)

/** model */
const tableModel = computed<RComponentTable | null>(() => {
  if (!tableId.value) {
    return null
  }
  return (Endge.domain.getComponent(tableId.value) as RComponentTable) ?? null
})

const rowSize = computed(() => {
  const m = tableModel.value
  if (!m) {
    return 40
  }
  return m.rowSizeCalc === 'zoom' ? 40 : m.rowSizeCalc
})

/** bindings -> sourceVar */
const sourceVar = computed(() => {
  const m = tableModel.value
  if (!m) {
    return ''
  }
  const keys = (m as any).bindings?.keys ?? {}
  const firstKey = Object.keys(keys)[0] // обычно "items"
  return firstKey || m.inputFields?.[m.sourceIndex]?.name || ''
})

/** utils */
function safeGet(path: string): any {
  return Raph.get(path, { vars: { store: basePath.value } })
}

function refreshSource(reason = 'manual'): void {
  if (!basePath.value || !sourceVar.value) {
    return
  }

  const path = `${basePath.value}.${sourceVar.value}`
  const v = safeGet(path)

  console.groupCollapsed(`[TableRenderer] refreshSource (${reason})`)
  try {
    console.log('runtime.id', props.runtime?.id)
    console.log('tableId', tableId.value)
    console.log('basePath', basePath.value)
    console.log('sourceVar', sourceVar.value)
    console.log('path', path)
    console.log('isArray', Array.isArray(v))
    console.log('len', Array.isArray(v) ? v.length : '-')
    if (Array.isArray(v)) {
      console.log('preview[0..1]', v.slice(0, 2))
    }
  }
  finally {
    console.groupEnd()
  }

  source.value = Array.isArray(v) ? v : []
}

/** columns */
const columns = computed(() => {
  const m = tableModel.value
  if (!m) {
    return []
  }

  return m.columns
    .filter(x => x.isActive)
    .map((column: RComponentTableColumn, index: number) => {
      if (RComponentTableColumn_isHtml(column)) {
        return null
      }

      const emitColumnEvent = (eventName: string, event: Event, cellProps: any) => {
        console.log(eventName)
        props.runtime.emit(`table-column:${eventName}` as any, {
          event,

          // колонка
          column,
          columnIndex: index,

          // строка
          rowIndex: cellProps.rowIndex,
          row: source.value?.[cellProps.rowIndex],
        })
      }

      return {
        prop: (column as any).id,
        name: (column as any).title,
        sortable: false,
        autoSize: true,
        size: Number.isFinite(Number((column as any).width))
          ? Number((column as any).width)
          : 150,
        pin:
          (column as any).pin === 'left'
            ? 'colPinStart'
            : (column as any).pin === 'right'
                ? 'colPinEnd'
                : undefined,

        cellTemplate: (h: any, cellProps: any) => {
          return ComponentType_TableCell(h, {
            basePath: `${basePath.value}`,
            table: m,
            column,
            rowIndex: cellProps.rowIndex,
          })
        },

        cellProperties: (сellProps: any) => ({
          onClick: (e: MouseEvent) => emitColumnEvent('click', e, сellProps),
          onDblClick: (e: MouseEvent) => emitColumnEvent('dblclick', e, сellProps),
          onContextMenu: (e: MouseEvent) => emitColumnEvent('contextmenu', e, сellProps),
          onMouseDown: (e: MouseEvent) => emitColumnEvent('mousedown', e, сellProps),
          onMouseUp: (e: MouseEvent) => emitColumnEvent('mouseup', e, сellProps),
        }),
      }
    })
    .filter(Boolean)
})

/** runtime subs */
type Unsub = () => void
const unsubs = ref<Unsub[]>([])

function cleanupSubs(): void {
  for (const fn of unsubs.value) fn()
  unsubs.value = []
}

function sub(event: string, handler: (payload: any) => void): void {
  const cb = (payload: any) => handler(payload)
  props.runtime.on(event as any, cb as any)
  unsubs.value.push(() => props.runtime.off(event as any, cb as any))
}

function setupSubs(): void {
  cleanupSubs()

  sub('update:root', (p: any) => {
    // p может содержать events/meta - ты их прокинул в фазе
    console.log('[TableRenderer] event update:root', {
      eventsLen: p?.events?.length ?? 0,
      canonicals: (p?.events ?? []).map((e: any) => e?.canonical),
    })
    refreshSource('update:root')
    gridRef.value!.$el.refresh()
  })

  sub('update:boundaries', (p: any) => {
    console.log('[TableRenderer] event update:boundaries', p)
  })

  // опционально: лог кликов по ячейкам
  // sub('table-column:click', (p: any) =>
  //   console.log('[TableRenderer] table-column:click', p),
  // )
}

onMounted(() => {
  refreshSource('mounted')
  setupSubs()
})

watch(
  () => props.runtime?.id,
  () => {
    refreshSource('runtime changed')
    setupSubs()
  },
)

watch(
  () => `${basePath.value}::${sourceVar.value}`,
  () => {
    // если поменялся sourceVar (например keys обновились) - перезабрать source
    refreshSource('spec changed')
  },
)

onBeforeUnmount(() => {
  cleanupSubs()
})
</script>

<template>
  <div class="d-flex flex-column flex-1">
    <RevoGrid
      ref="gridRef"
      :columns="columns"
      :source="source"
      :row-size="rowSize"
      style="height: 700px"
      exporting
      theme="compact"
      resize
      row-class="rowId"
      :range="false"
      readonly
      :use-autofill="false"
    />
  </div>
</template>
