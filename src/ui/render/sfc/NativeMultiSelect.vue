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
  readonly?: boolean
  disabled?: boolean
}>()

const root = ref<HTMLElement | null>(null)
const hiddenSelect = ref<HTMLSelectElement | null>(null)
const open = ref(false)
const localValues = ref<string[]>([])
const listboxId = `endge-native-multiselect-${getCurrentInstance()?.uid ?? 'select'}`
const selectedValues = computed(() => new Set(localValues.value))
const selectedLabels = computed(() => props.options
  .filter(option => selectedValues.value.has(String(option.value)))
  .map(option => option.label ?? String(option.value)))
const selectionLabel = computed(() => {
  if (!selectedLabels.value.length)
    return props.placeholder || 'Выберите…'
  if (selectedLabels.value.length <= 2)
    return selectedLabels.value.join(', ')
  return `${selectedLabels.value.slice(0, 2).join(', ')} +${selectedLabels.value.length - 2}`
})

watch(() => props.selectedValues, (values) => {
  localValues.value = [...values]
}, { immediate: true })

onMounted(() => document.addEventListener('pointerdown', closeFromOutside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', closeFromOutside))

function toggleOpen(): void {
  if (!props.disabled)
    open.value = !open.value
}

async function toggleOption(value: string): Promise<void> {
  if (props.disabled || props.readonly)
    return

  const next = new Set(localValues.value)
  if (next.has(value))
    next.delete(value)
  else
    next.add(value)

  localValues.value = props.options
    .map(option => String(option.value))
    .filter(optionValue => next.has(optionValue))

  await nextTick()
  hiddenSelect.value?.dispatchEvent(new Event('change', { bubbles: true }))
}

function close(): void {
  open.value = false
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
    if (!props.disabled)
      open.value = true
  }
}
</script>

<template>
  <span
    ref="root"
    v-bind="$attrs"
    class="endge-native-multiselect"
    :data-open="open ? '' : undefined"
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
        v-if="selectedLabels.length"
        class="endge-native-multiselect__count"
        aria-hidden="true"
      >
        {{ selectedLabels.length }}
      </span>
      <span class="endge-native-multiselect__chevron" aria-hidden="true" />
    </button>

    <div
      v-if="open"
      :id="listboxId"
      class="endge-native-multiselect__content"
      role="listbox"
      aria-multiselectable="true"
      @keydown.esc.stop.prevent="close"
    >
      <div v-if="!options.length" class="endge-native-multiselect__empty">
        Нет доступных вариантов
      </div>
      <button
        v-for="(option, index) in options"
        v-else
        :key="`${index}:${String(option.value)}`"
        type="button"
        class="endge-native-multiselect__option"
        role="option"
        :aria-selected="selectedValues.has(String(option.value))"
        :aria-disabled="readonly ? 'true' : undefined"
        @click="toggleOption(String(option.value))"
      >
        <span class="endge-native-multiselect__check" aria-hidden="true" />
        <span class="endge-native-multiselect__option-label">
          {{ option.label ?? String(option.value) }}
        </span>
      </button>
    </div>

    <select
      ref="hiddenSelect"
      class="endge-native-multiselect__native"
      multiple
      tabindex="-1"
      aria-hidden="true"
      :disabled="disabled"
    >
      <option
        v-for="(option, index) in options"
        :key="`${index}:${String(option.value)}`"
        :value="String(option.value)"
        :selected="selectedValues.has(String(option.value))"
      >
        {{ option.label ?? String(option.value) }}
      </option>
    </select>
  </span>
</template>

<style scoped>
.endge-native-multiselect {
  display: inline-grid;
  min-width: 12rem;
  position: relative;
  width: 100%;
}

.endge-native-multiselect__trigger {
  align-items: center;
  background: var(--background, #fff);
  border: 1px solid var(--border, #d4d4d8);
  border-radius: .5rem;
  color: var(--foreground, #18181b);
  cursor: pointer;
  display: flex;
  font: inherit;
  gap: .5rem;
  height: 2.5rem;
  justify-content: space-between;
  min-width: 0;
  outline: none;
  padding: 0 .75rem;
  text-align: left;
  width: 100%;
}

.endge-native-multiselect__trigger:focus-visible,
.endge-native-multiselect[data-open] .endge-native-multiselect__trigger {
  border-color: var(--ring, var(--primary, #18181b));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ring, var(--primary, #18181b)) 18%, transparent);
}

.endge-native-multiselect__trigger:disabled {
  cursor: not-allowed;
  opacity: .55;
}

.endge-native-multiselect__value {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.endge-native-multiselect__value[data-placeholder] {
  color: var(--muted-foreground, #71717a);
}

.endge-native-multiselect__count {
  align-items: center;
  background: var(--muted, #f4f4f5);
  border: 1px solid var(--border, #e4e4e7);
  border-radius: 999px;
  color: var(--foreground, #18181b);
  display: inline-flex;
  flex: none;
  font-size: .6875rem;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  height: 1.25rem;
  justify-content: center;
  min-width: 1.25rem;
  padding: 0 .3rem;
}

.endge-native-multiselect__chevron {
  border-bottom: 1.5px solid var(--muted-foreground, #71717a);
  border-right: 1.5px solid var(--muted-foreground, #71717a);
  flex: none;
  height: .4rem;
  margin: -.2rem .1rem 0 .25rem;
  transform: rotate(45deg);
  transition: transform 140ms ease, margin 140ms ease;
  width: .4rem;
}

.endge-native-multiselect[data-open] .endge-native-multiselect__chevron {
  margin-top: .2rem;
  transform: rotate(225deg);
}

.endge-native-multiselect__content {
  animation: endge-native-multiselect-in 120ms ease-out;
  background: var(--popover, var(--background, #fff));
  border: 1px solid var(--border, #e4e4e7);
  border-radius: .5rem;
  box-shadow: 0 12px 32px color-mix(in srgb, var(--foreground, #18181b) 14%, transparent);
  color: var(--popover-foreground, var(--foreground, #18181b));
  display: grid;
  gap: .125rem;
  left: 0;
  margin-top: .375rem;
  max-height: 15rem;
  min-width: 100%;
  overflow-y: auto;
  padding: .25rem;
  position: absolute;
  top: 100%;
  z-index: 50;
}

.endge-native-multiselect__option {
  align-items: center;
  background: transparent;
  border: 0;
  border-radius: .375rem;
  color: inherit;
  cursor: pointer;
  display: flex;
  font: inherit;
  font-size: .875rem;
  gap: .625rem;
  line-height: 1.25rem;
  min-height: 2.25rem;
  outline: none;
  padding: .45rem .55rem;
  text-align: left;
  width: 100%;
}

.endge-native-multiselect__option:hover,
.endge-native-multiselect__option:focus-visible {
  background: var(--accent, var(--muted, #f4f4f5));
  color: var(--accent-foreground, var(--foreground, #18181b));
}

.endge-native-multiselect__option[aria-disabled="true"] {
  cursor: default;
}

.endge-native-multiselect__check {
  align-items: center;
  border: 1px solid var(--input, var(--border, #d4d4d8));
  border-radius: .25rem;
  display: inline-flex;
  flex: none;
  height: 1rem;
  justify-content: center;
  width: 1rem;
}

.endge-native-multiselect__option[aria-selected="true"] .endge-native-multiselect__check {
  background: var(--primary, #18181b);
  border-color: var(--primary, #18181b);
}

.endge-native-multiselect__option[aria-selected="true"] .endge-native-multiselect__check::after {
  border-color: var(--primary-foreground, #fff);
  border-style: solid;
  border-width: 0 1.5px 1.5px 0;
  content: '';
  height: .48rem;
  margin-top: -.1rem;
  transform: rotate(45deg);
  width: .24rem;
}

.endge-native-multiselect__option-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.endge-native-multiselect__empty {
  color: var(--muted-foreground, #71717a);
  font-size: .8125rem;
  padding: .75rem;
  text-align: center;
}

.endge-native-multiselect__native {
  height: 1px;
  opacity: 0;
  overflow: hidden;
  pointer-events: none;
  position: absolute;
  width: 1px;
}

@keyframes endge-native-multiselect-in {
  from {
    opacity: 0;
    transform: translateY(-.25rem);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
