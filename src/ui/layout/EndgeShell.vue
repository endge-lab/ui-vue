<script setup lang="ts">
import type { EndgeEnvId, EndgeProjectId } from '@endge/core'

import { Endge } from '@endge/core'
import { useSubscribableRefAuto } from '@endge/utils'
import { computed } from 'vue'

import EndgeAppHelperMenu from '@/ui/layout/EndgeAppHelperMenu.vue'

interface Props {
  project: EndgeProjectId
  env: EndgeEnvId
}

defineProps<Props>()

//
//
const appRef = useSubscribableRefAuto(Endge.app)
const isInitializing = computed(() => appRef.value.isInitializing)
const loaderText = 'загрузка приложения'
</script>

<template>
  <slot v-if="!isInitializing" />

  <slot v-else name="spinner">
    <div class="endge-app-loader__overlay" aria-busy="true" aria-live="polite">
      <div class="endge-app-loader__spinner" />
      <p class="endge-app-loader__text">
        {{ loaderText }}
      </p>
    </div>
  </slot>

  <EndgeAppHelperMenu />
</template>

<style scoped>
.endge-app-loader__overlay {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: rgba(248, 250, 252, 0.7);
  backdrop-filter: blur(4px);
  z-index: 220;
}

.endge-app-loader__spinner {
  width: 56px;
  height: 56px;
  border: 3px solid #cbd5e1;
  border-right-color: #38bdf8;
  border-top-color: #0ea5e9;
  border-radius: 9999px;
  animation: endge-app-loader-spin 0.8s linear infinite;
}

.endge-app-loader__text {
  margin: 0;
  color: #475569;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.3;
  letter-spacing: 0.01em;
  text-align: center;
}

@keyframes endge-app-loader-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
