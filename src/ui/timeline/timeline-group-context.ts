import type { TimelineChart } from '@nova-lab/timeline'
import type { InjectionKey, Ref } from 'vue'
import type { TimelineViewportRange } from './timeline-input'

type TimelineHandle = ReturnType<typeof TimelineChart.mount>

export interface TimelineGroupContext {
  labelWidth: Readonly<Ref<number | undefined>>
  resizeLabels: (width: number) => void
  height: (key: string) => number | undefined
  resize: (key: string, height: number) => void
  attach: (key: string, handle: TimelineHandle, api: typeof TimelineChart) => () => void
  viewport: () => TimelineViewportRange | undefined
}

export const timelineGroupKey: InjectionKey<TimelineGroupContext> = Symbol('TimelineGroup')
