<script lang="ts" setup>
import type { EndgeEventBinding, RComponentTable, RComponentTableColumn, RuntimeHost } from '@endge/core'

import { Endge } from '@endge/core'
import { Raph } from '@endge/raph'
import RevoGrid from '@revolist/vue3-datagrid'
import { computed, onMounted, ref } from 'vue'

import ComponentType_TableCell from '@/ui/render/ts/ComponentType_TableCell'

const props = defineProps<{
  model: RComponentTable
  basePath: string
}>()

const thisRef = ref()
const source = ref([])
let runtime: RuntimeHost<'table'> | null = null

const rowSize = computed(() => {
  const rowSize = props.model.rowSizeCalc
  if (rowSize === 'zoom') {
    return 40
  }
  return rowSize
})

onMounted(() => {
  console.log('ТАБЛИЦА', props.model)

  const sourceFieldName
    = props.model.inputFields[props.model.sourceIndex]?.name || ''

  runtime = Endge.runtime.execute(props.model as any, {
    basePath: props.basePath,
  })
  runtime?.on('update:boundaries', (data) => {
    // cellIndex -> rowsIndexes
    const shouldUpdate = new Map<number, Set<number>>()

    const tableModel = props.model

    // имя исходного массива (а НЕ индекс!)
    const sourceVar
      = tableModel.inputFields[tableModel.sourceIndex]?.name || 'legs'
    const pk = tableModel.bindings.keys[sourceVar]?.pk || 'id'

    const getStoreArray = (name: string) =>
      (Raph.get(`${props.basePath}.${name}`, {
        vars: { store: props.basePath },
      }) as any[]) ?? []

    const findRowIndexByPk = (pkValue: unknown): number => {
      const rows = getStoreArray(sourceVar)
      if (!rows || !Array.isArray(rows))
        return -1
      return rows.findIndex(r => r && r[pk] === pkValue)
    }

    const tryRead = (pathOrValue: unknown): unknown => {
      if (typeof pathOrValue === 'string' && pathOrValue.startsWith('$')) {
        try {
          return Raph.get(pathOrValue as string, {
            vars: { store: props.basePath },
          })
        }
        catch {
          return undefined
        }
      }
      return pathOrValue
    }

    const extractPrimaryIndexFromKeyValue = (keyValue: unknown): number => {
      // быстрый путь: $store.<sourceVar>[N]...
      if (typeof keyValue === 'string') {
        const re = new RegExp(
          `^\\$store\\.${sourceVar}\$begin:math:display$(\\\\d+)\\$end:math:display$`,
        )
        const m = keyValue.match(re)
        if (m)
          return Number(m[1])
      }
      // иначе вычисляем pk и ищем индекс
      const pkVal = tryRead(keyValue)
      if (pkVal === undefined)
        return -1
      return findRowIndexByPk(pkVal)
    }

    // Собираем данные для обновления
    data.children.forEach((boundary: any) => {
      const colIndex = (boundary.node.meta?.columnIndex as number) ?? -1
      if (colIndex === -1)
        return

      if (!shouldUpdate.has(colIndex)) {
        shouldUpdate.set(colIndex, new Set<number>())
      }
      const bucket = shouldUpdate.get(colIndex)! // <-- фикс

      ;(boundary.events ?? []).forEach((e: any) => {
        const resolved: Array<{
          segment: string
          keyField?: string
          keyValue?: unknown
          index?: number
        }> = e.resolved ?? []

        let rowIndex = -1

        // A) сразу через keyValue
        for (const r of resolved) {
          if (r.keyValue != null) {
            rowIndex = extractPrimaryIndexFromKeyValue(r.keyValue)
            if (rowIndex !== -1)
              break
          }
        }

        // B) через промежуточный индекс (attrs - legId - legs[pk])
        if (rowIndex === -1) {
          const byIndex = resolved.find(r => typeof r.index === 'number')
          if (byIndex) {
            const fkField = byIndex.keyField || 'legId'
            const fkPath = `$store.${byIndex.segment}[${byIndex.index}].${fkField}`
            const fkValue = tryRead(fkPath)
            if (fkValue !== undefined) {
              rowIndex = extractPrimaryIndexFromKeyValue(fkValue)
            }
          }
        }

        // C) fallback: если вдруг пришёл индекс самой primary
        if (rowIndex === -1) {
          const prim = resolved.find(
            r => r.segment === sourceVar && typeof r.index === 'number',
          )
          if (prim)
            rowIndex = prim.index!
        }

        if (rowIndex >= 0)
          bucket.add(rowIndex)
      })
    })

    // console.log('Should update', shouldUpdate)

    // ленивый первичный источник
    if (!source.value?.length) {
      source.value = Raph.get(`${props.basePath}.${sourceFieldName}`, {
        vars: { store: props.basePath },
      })
    }

    // применяем обновления
    for (const [colIdxRaw, rowIndexes] of shouldUpdate.entries()) {
      const colIndex = Number(colIdxRaw)
      for (const ri of rowIndexes) {
        const rowIndex = Number(ri)
        if (
          !Number.isInteger(colIndex)
          || colIndex < 0
          || !Number.isInteger(rowIndex)
          || rowIndex < 0
        ) {
          continue
        }

        thisRef.value.$el.setDataAt({
          row: rowIndex,
          col: colIndex,
          rowType: 'rgRow',
          colType: 'rgCol',
          val: null,
        })
      }
    }
  })

  // console.log('MODEL')
  // console.log(props.model)

  Endge.testing.setupTestingOptions(
    {
      updatesOptions: {
        paths: props.model.dataPaths,
        vars: {
          store: props.basePath,
        },
      },
    },
    { mode: 'append' },
  )

  // let it = 0
  // setInterval(() => {
  //   const legId = Raph.get('FLT_ARR.legs[0].id', {
  //     vars: {
  //       store: props.basePath,
  //     },
  //   })
  //   Raph.set(
  //     // `$store.attrs[legId='${legId}'].items[name='ArrivalModelType'].text`,
  //     "FLT_ARR.attrs[legId=$store.legs[$i].id].items[name='ACTail'].text",
  //     `${it++}`,
  //     {
  //       vars: {
  //         store: props.basePath,
  //         i: 0,
  //       },
  //     },
  //   )
  // }, 1000)
})

const columns = computed(() => {
  return props.model.columns
    .filter(x => x.isActive)
    .map((column: RComponentTableColumn, index: number) => {
      //
      // Обработка события
      const handleEvent = (eventName: string, event: Event) => {
        eventName = `table-column:${eventName}`

        runtime?.emit(eventName, {
          event,
          column,
          columnIndex: index,
        })

        // Поиск заданных обработчиков
        const bindings
          = column.eventBindings?.filter((h: any) => h?.event === eventName) ?? []
        if (!bindings.length) {
          return
        }

        //
        // Вызов в порядке добавления
        bindings.forEach((h: EndgeEventBinding) => {
          Endge.flow.runAll(h?.actionId ?? '', {})
        })
      }

      //
      // База
      return {
        prop: column.id,
        name: column.title,

        sortable: false,
        order: undefined,
        autoSize: true,
        size: Number.isFinite(Number(column.width))
          ? Number(column.width)
          : 150,
        pin:
          column.pin === 'left'
            ? 'colPinStart'
            : column.pin === 'right'
              ? 'colPinEnd'
              : undefined,
        cellCompare: undefined,

        //
        // Рендеринг
        cellTemplate: (h, cellProps) => {
          return ComponentType_TableCell(h, {
            basePath: props.basePath,
            table: props.model,
            column,
            rowIndex: cellProps.rowIndex,
          })
        },

        //
        // Обработка событий
        cellProperties: () => ({
          onClick: (e: MouseEvent) => handleEvent('click', e),
          onDblClick: (e: MouseEvent) => handleEvent('dblclick', e),
          onContextMenu: (e: MouseEvent) => handleEvent('contextmenu', e),
          onMouseDown: (e: MouseEvent) => handleEvent('mousedown', e),
          onMouseUp: (e: MouseEvent) => handleEvent('mouseup', e),
        }),
      }
    })
})
</script>

<template>
  <div class="d-flex flex-column flex-1">
    <!--
      DataGrid с виртуализацией для отображения таблицы.
      source должен оставаться пустым, а управление данными выходит
      на уровень ячейки (cellTemplate).
    -->
    <RevoGrid
      ref="thisRef"
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
