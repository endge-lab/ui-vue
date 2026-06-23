<script setup lang="ts">
import { computed } from 'vue'

type OnlineStatus = 'online' | 'offline'

interface OnlineBlock {
  status: OnlineStatus
  text: string
  tooltip?: string
}

interface TableStatusData {
  title: string
  displayed: number
  total: number
  selectedRow?: number | null
  online?: OnlineBlock
}

const props = defineProps<{
  data: TableStatusData
}>()

const onlineClass = computed(() =>
  props.data.online?.status === 'offline' ? 'offline' : 'online',
)
</script>

<template>
  <div class="table-status-bar text-sm">
    <!-- TABLE STATS -->
    <span>
      <strong>{{ data.title }}:</strong>
      {{ data.displayed }} / {{ data.total }}
      <span v-if="data.selectedRow != null">
        | выбранная строка {{ data.selectedRow }}
      </span>
    </span>

    <!-- ONLINE -->
<!--    <span-->
<!--      v-if="data.online"-->
<!--      class="status-indicator"-->
<!--      :title="data.online.tooltip ?? ''"-->
<!--    >-->
<!--      <span-->
<!--        class="status-dot"-->
<!--        :class="onlineClass"-->
<!--      ></span>-->
<!--      <span class="status-text">-->
<!--        {{ data.online.text }}-->
<!--      </span>-->
<!--    </span>-->
  </div>
</template>

<style scoped lang="scss">
.table-status-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 100%;
  white-space: nowrap;
}

.status-indicator {
  margin-left: 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.status-dot {
  width: 8px !important;
  height: 8px !important;
  border-radius: 50%;
  display: inline-block;
}

.status-dot.online {
  background-color: #2ecc71;
}

.status-dot.offline {
  background-color: #e74c3c;
}

.status-text {
  text-transform: lowercase;
}
</style>
