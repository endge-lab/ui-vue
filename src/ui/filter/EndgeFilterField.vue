<script setup lang="ts">
import type { FilterRuntimeHost, SourceFieldDefinition } from '@endge/core'

import { Endge } from '@endge/core'
import Checkbox from 'primevue/checkbox'
import DatePicker from 'primevue/datepicker'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  runtime: FilterRuntimeHost
  field: SourceFieldDefinition
  modelValue: unknown
  readonly?: boolean
}>()

const emit = defineEmits<{ (event: 'update:modelValue', value: unknown): void }>()
const vocabOptions = ref<Array<{ value: unknown, label: string }>>([])
const vocabLoading = ref(false)
const vocabError = ref<string | null>(null)
const options = computed(() => props.field.options?.map(item => ({
  value: item.value,
  label: item.label ?? String(item.value),
})) ?? vocabOptions.value)
const dateValue = computed(() => {
  if (!props.modelValue)
    return null
  const date = props.modelValue instanceof Date ? props.modelValue : new Date(String(props.modelValue))
  return Number.isNaN(date.getTime()) ? null : date
})

watch(() => props.field.vocab?.identity, () => void loadVocab(), { immediate: true })

async function loadVocab(): Promise<void> {
  const vocab = props.field.vocab
  if (!vocab) {
    vocabOptions.value = []
    vocabError.value = null
    return
  }
  vocabLoading.value = true
  vocabError.value = null
  try {
    const rows = await Endge.vocabs.loadVocab(vocab.identity, { throwOnError: true })
    vocabOptions.value = rows.map(row => ({
      value: readPath(row, vocab.valuePath),
      label: String(readPath(row, vocab.labelPath) ?? readPath(row, vocab.valuePath) ?? ''),
    }))
  }
  catch (error) {
    vocabOptions.value = []
    vocabError.value = error instanceof Error ? error.message : String(error)
  }
  finally {
    vocabLoading.value = false
  }
}

function updateDate(value: Date | Date[] | (Date | null)[] | null | undefined): void {
  if (!(value instanceof Date)) {
    emit('update:modelValue', undefined)
    return
  }
  emit('update:modelValue', props.field.type === 'Date'
    ? value.toISOString().slice(0, 10)
    : value.toISOString())
}

function readPath(source: unknown, path: string): unknown {
  return String(path ?? '').split('.').filter(Boolean).reduce<any>((value, key) => value?.[key], source as any)
}
</script>

<template>
  <label class="endge-filter-field">
    <span class="endge-filter-field__label">{{ field.key }}</span>
    <MultiSelect
      v-if="field.array && (field.options || field.vocab)"
      :model-value="Array.isArray(modelValue) ? modelValue : []"
      :options="options"
      option-label="label"
      option-value="value"
      :loading="vocabLoading"
      :disabled="readonly"
      display="chip"
      @update:model-value="emit('update:modelValue', $event)"
    />
    <Select
      v-else-if="field.options || field.vocab"
      :model-value="modelValue"
      :options="options"
      option-label="label"
      option-value="value"
      :loading="vocabLoading"
      :disabled="readonly"
      @update:model-value="emit('update:modelValue', $event)"
    />
    <InputNumber
      v-else-if="field.type === 'Number'"
      :model-value="typeof modelValue === 'number' ? modelValue : null"
      :disabled="readonly"
      @update:model-value="emit('update:modelValue', $event)"
    />
    <Checkbox
      v-else-if="field.type === 'Boolean'"
      :model-value="modelValue === true"
      binary
      :disabled="readonly"
      @update:model-value="emit('update:modelValue', $event)"
    />
    <DatePicker
      v-else-if="field.type === 'Date' || field.type === 'DateTime'"
      :model-value="dateValue"
      :show-time="field.type === 'DateTime'"
      :disabled="readonly"
      date-format="yy-mm-dd"
      @update:model-value="updateDate"
    />
    <InputText
      v-else
      :model-value="typeof modelValue === 'string' ? modelValue : ''"
      :disabled="readonly"
      @update:model-value="emit('update:modelValue', $event)"
    />
    <small v-if="vocabError" class="endge-filter-field__error">{{ vocabError }}</small>
  </label>
</template>

<style scoped>
.endge-filter-field { display: grid; gap: .35rem; min-width: 0; }
.endge-filter-field__label { font-size: .75rem; color: var(--p-text-muted-color, #64748b); }
.endge-filter-field__error { color: var(--p-red-500, #ef4444); }
</style>
