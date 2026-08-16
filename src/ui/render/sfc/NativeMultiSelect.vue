<script setup lang="ts">
import type { SourceFieldOption } from '@endge/core'

import {
  computed,
  getCurrentInstance,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue'

defineOptions({
  name: 'EndgeNativeMultiSelect',
  inheritAttrs: false,
})

const props = defineProps<{
  options: SourceFieldOption[]
  selectedValues: string[]
  placeholder?: string
  multiple?: boolean
  searchable?: boolean
  virtualized?: boolean
  readonly?: boolean
  disabled?: boolean
}>()

const ROW_HEIGHT = 36
const VIEWPORT_HEIGHT = 240
const OVERSCAN = 4

const root = ref<HTMLElement | null>(null)
const hiddenSelect = ref<HTMLSelectElement | null>(null)
const searchInput = ref<HTMLInputElement | null>(null)
const viewport = ref<HTMLElement | null>(null)
const open = ref(false)
const search = ref('')
const scrollTop = ref(0)
const localValues = ref<string[]>([])
const listboxId = `endge-native-multiselect-${getCurrentInstance()?.uid ?? 'select'}`
const selectedValues = computed(() => new Set(localValues.value))
const effectiveSearchable = computed(() => props.searchable ?? props.options.length > 10)
const effectiveVirtualized = computed(() => props.virtualized ?? props.options.length > 10)
const filteredOptions = computed(() => {
  const query = search.value.trim().toLocaleLowerCase()
  if (!query)
    return props.options

  return props.options.filter((option) => {
    const value = String(option.value).toLocaleLowerCase()
    const label = String(option.label ?? option.value).toLocaleLowerCase()
    return label.includes(query) || value.includes(query)
  })
})
const virtualStart = computed(() => Math.max(0, Math.floor(scrollTop.value / ROW_HEIGHT) - OVERSCAN))
const virtualEnd = computed(() => Math.min(
  filteredOptions.value.length,
  virtualStart.value + Math.ceil(VIEWPORT_HEIGHT / ROW_HEIGHT) + OVERSCAN * 2,
))
const renderedOptions = computed(() => {
  const options = effectiveVirtualized.value
    ? filteredOptions.value.slice(virtualStart.value, virtualEnd.value)
    : filteredOptions.value

  return options.map((option, offset) => ({
    option,
    index: effectiveVirtualized.value ? virtualStart.value + offset : offset,
  }))
})
const virtualHeight = computed(() => effectiveVirtualized.value
  ? filteredOptions.value.length * ROW_HEIGHT
  : undefined)
const selectedOptions = computed<SourceFieldOption[]>(() => localValues.value.map(value => (
  props.options.find(option => String(option.value) === value) ?? { value, label: value }
)))
const selectedLabels = computed(() => selectedOptions.value.map(option => option.label ?? String(option.value)))
const selectionLabel = computed(() => {
  if (!selectedLabels.value.length)
    return props.placeholder || 'Выберите…'
  if (!props.multiple || selectedLabels.value.length <= 2)
    return selectedLabels.value.join(', ')
  return `${selectedLabels.value.slice(0, 2).join(', ')} +${selectedLabels.value.length - 2}`
})

watch(() => props.selectedValues, (values) => {
  localValues.value = [...values]
}, { immediate: true })

watch(search, () => {
  scrollTop.value = 0
  if (viewport.value)
    viewport.value.scrollTop = 0
})

onMounted(() => document.addEventListener('pointerdown', closeFromOutside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', closeFromOutside))

async function toggleOpen(): Promise<void> {
  if (props.disabled || props.readonly)
    return
  open.value = !open.value
  if (open.value && effectiveSearchable.value) {
    await nextTick()
    searchInput.value?.focus()
  }
}

async function toggleOption(value: string): Promise<void> {
  if (props.disabled || props.readonly)
    return

  if (props.multiple) {
    const next = new Set(localValues.value)
    if (next.has(value))
      next.delete(value)
    else
      next.add(value)
    localValues.value = props.options
      .map(option => String(option.value))
      .filter(optionValue => next.has(optionValue))
  }
  else {
    localValues.value = [value]
    close()
  }

  await nextTick()
  hiddenSelect.value?.dispatchEvent(new Event('input', { bubbles: true }))
  hiddenSelect.value?.dispatchEvent(new Event('change', { bubbles: true }))
}

function close(): void {
  open.value = false
  search.value = ''
}

function closeFromOutside(event: PointerEvent): void {
  if (root.value && !root.value.contains(event.target as Node))
    close()
}

function handleTriggerKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    close()
    return
  }

  if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    void toggleOpen()
  }
}

function handleScroll(event: Event): void {
  scrollTop.value = (event.currentTarget as HTMLElement).scrollTop
}

function optionStyle(index: number): Record<string, string> | undefined {
  if (!effectiveVirtualized.value)
    return undefined
  return {
    height: `${ROW_HEIGHT}px`,
    position: 'absolute',
    transform: `translateY(${index * ROW_HEIGHT}px)`,
  }
}
</script>

<template>
  <span
    ref="root"
    v-bind="$attrs"
    class="endge-native-multiselect"
    :data-open="open ? '' : undefined"
    :data-multiple="multiple ? '' : undefined"
  >
    <button
      type="button"
      class="endge-native-multiselect__trigger"
      role="combobox"
      aria-haspopup="listbox"
      :aria-controls="listboxId"
      :aria-expanded="open"
      :aria-readonly="readonly ? 'true' : undefined"
      :disabled="disabled"
      @click="toggleOpen"
      @keydown="handleTriggerKeydown"
    >
      <span
        class="endge-native-multiselect__value"
        :data-placeholder="selectedLabels.length ? undefined : ''"
      >
        {{ selectionLabel }}
      </span>
      <span
        v-if="multiple && selectedLabels.length"
        class="endge-native-multiselect__count"
        aria-hidden="true"
      >
        {{ selectedLabels.length }}
      </span>
      <span class="endge-native-multiselect__chevron" aria-hidden="true" />
    </button>

    <div
      v-if="open"
      class="endge-native-multiselect__content"
      @keydown.esc.stop.prevent="close"
    >
      <input
        v-if="effectiveSearchable"
        ref="searchInput"
        v-model="search"
        class="endge-native-multiselect__search"
        type="search"
        placeholder="Поиск…"
        aria-label="Поиск по вариантам"
        @keydown.stop
        @keydown.esc.stop.prevent="close"
      >
      <div
        :id="listboxId"
        ref="viewport"
        class="endge-native-multiselect__viewport"
        role="listbox"
        :aria-multiselectable="multiple ? 'true' : undefined"
        @scroll="handleScroll"
      >
        <div v-if="!filteredOptions.length" class="endge-native-multiselect__empty">
          {{ options.length ? 'Ничего не найдено' : 'Нет доступных вариантов' }}
        </div>
        <div
          v-else
          class="endge-native-multiselect__options"
          :style="virtualHeight == null ? undefined : { height: `${virtualHeight}px` }"
        >
          <button
            v-for="entry in renderedOptions"
            :key="`${entry.index}:${String(entry.option.value)}`"
            type="button"
            class="endge-native-multiselect__option"
            role="option"
            :style="optionStyle(entry.index)"
            :aria-selected="selectedValues.has(String(entry.option.value))"
            :aria-disabled="readonly ? 'true' : undefined"
            @click="toggleOption(String(entry.option.value))"
          >
            <span class="endge-native-multiselect__check" aria-hidden="true" />
            <span class="endge-native-multiselect__option-label">
              {{ entry.option.label ?? String(entry.option.value) }}
            </span>
          </button>
        </div>
      </div>
    </div>

    <select
      ref="hiddenSelect"
      class="endge-native-multiselect__native"
      :multiple="multiple"
      tabindex="-1"
      aria-hidden="true"
      :disabled="disabled"
    >
      <option
        v-for="(option, index) in selectedOptions"
        :key="`${index}:${String(option.value)}`"
        :value="String(option.value)"
        selected
      >
        {{ option.label ?? String(option.value) }}
      </option>
    </select>
  </span>
</template>

<style scoped>
.endge-native-multiselect { display: inline-grid; min-width: 12rem; position: relative; width: 100%; }
.endge-native-multiselect__trigger { align-items: center; background: var(--background, #fff); border: 1px solid var(--border, #d4d4d8); border-radius: .5rem; color: var(--foreground, #18181b); cursor: pointer; display: flex; font: inherit; gap: .5rem; height: 2.5rem; justify-content: space-between; min-width: 0; outline: none; padding: 0 .75rem; text-align: left; width: 100%; }
.endge-native-multiselect__trigger:focus-visible, .endge-native-multiselect[data-open] .endge-native-multiselect__trigger { border-color: var(--ring, var(--primary, #18181b)); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ring, var(--primary, #18181b)) 18%, transparent); }
.endge-native-multiselect__trigger:disabled { cursor: not-allowed; opacity: .55; }
.endge-native-multiselect__value { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.endge-native-multiselect__value[data-placeholder] { color: var(--muted-foreground, #71717a); }
.endge-native-multiselect__count { align-items: center; background: var(--muted, #f4f4f5); border: 1px solid var(--border, #e4e4e7); border-radius: 999px; display: inline-flex; flex: none; font-size: .6875rem; font-weight: 600; height: 1.25rem; justify-content: center; min-width: 1.25rem; padding: 0 .3rem; }
.endge-native-multiselect__chevron { border-bottom: 1.5px solid var(--muted-foreground, #71717a); border-right: 1.5px solid var(--muted-foreground, #71717a); flex: none; height: .4rem; margin: -.2rem .1rem 0 .25rem; transform: rotate(45deg); transition: transform 140ms ease, margin 140ms ease; width: .4rem; }
.endge-native-multiselect[data-open] .endge-native-multiselect__chevron { margin-top: .2rem; transform: rotate(225deg); }
.endge-native-multiselect__content { animation: endge-native-multiselect-in 120ms ease-out; background: var(--popover, var(--background, #fff)); border: 1px solid var(--border, #e4e4e7); border-radius: .5rem; box-shadow: 0 12px 32px color-mix(in srgb, var(--foreground, #18181b) 14%, transparent); color: var(--popover-foreground, var(--foreground, #18181b)); display: grid; gap: .25rem; left: 0; margin-top: .375rem; min-width: 100%; padding: .25rem; position: absolute; top: 100%; z-index: 50; }
.endge-native-multiselect__search { background: var(--background, #fff); border: 1px solid var(--border, #d4d4d8); border-radius: .375rem; color: inherit; font: inherit; font-size: .875rem; height: 2.25rem; outline: none; padding: 0 .625rem; width: 100%; }
.endge-native-multiselect__search:focus { border-color: var(--ring, var(--primary, #18181b)); }
.endge-native-multiselect__viewport { max-height: 15rem; overflow-y: auto; }
.endge-native-multiselect__options { position: relative; }
.endge-native-multiselect__option { align-items: center; background: transparent; border: 0; border-radius: .375rem; color: inherit; cursor: pointer; display: flex; font: inherit; font-size: .875rem; gap: .625rem; left: 0; line-height: 1.25rem; min-height: 2.25rem; outline: none; padding: .45rem .55rem; text-align: left; top: 0; width: 100%; }
.endge-native-multiselect__option:hover, .endge-native-multiselect__option:focus-visible { background: var(--accent, var(--muted, #f4f4f5)); }
.endge-native-multiselect__check { align-items: center; border: 1px solid var(--input, var(--border, #d4d4d8)); border-radius: .25rem; display: inline-flex; flex: none; height: 1rem; justify-content: center; width: 1rem; }
.endge-native-multiselect__option[aria-selected="true"] .endge-native-multiselect__check { background: var(--primary, #18181b); border-color: var(--primary, #18181b); }
.endge-native-multiselect__option[aria-selected="true"] .endge-native-multiselect__check::after { border-color: var(--primary-foreground, #fff); border-style: solid; border-width: 0 1.5px 1.5px 0; content: ''; height: .48rem; margin-top: -.1rem; transform: rotate(45deg); width: .24rem; }
.endge-native-multiselect__option-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.endge-native-multiselect__empty { color: var(--muted-foreground, #71717a); font-size: .8125rem; padding: .75rem; text-align: center; }
.endge-native-multiselect__native { height: 1px; opacity: 0; overflow: hidden; pointer-events: none; position: absolute; width: 1px; }
</style>
