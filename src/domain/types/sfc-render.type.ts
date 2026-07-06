import type {
  RComponentSFC_IR,
  RComponentSFC_IR_ElementNode,
  RComponentSFC_IR_Node,
  RComponentSFC_IR_Tag,
  RComponentSFC_IR_Value,
} from '@endge/core'
import type { h as VueH, VNode } from 'vue'

/** Поддерживаемые SFC primitive-теги во Vue adapter. */
export type SFCVueRenderPrimitive = RComponentSFC_IR_Tag

/** Будущий контракт binding-ов renderer adapter. */
export type SFCVueRenderBinding
  = | {
    kind: 'literal'
    value: unknown
  }
    | {
      kind: 'prop'
      path: string
    }

/** Контекст текущего SFC render pass. */
export interface SFCVueRenderContext {
  props: Record<string, unknown>
  locals: Record<string, unknown>
  iteration: SFCVueRenderIteration | null
  renderVersion: number
}

/** Данные текущей for-итерации. */
export interface SFCVueRenderIteration {
  item: string
  index?: string
  value: unknown
  indexValue: number
  key: unknown
}

/** Входные props корневого SFC renderer adapter. */
export interface SFCVueRenderAdapterProps {
  ir: RComponentSFC_IR | null
  props?: Record<string, unknown>
  renderVersion?: number
}

/** Тип Vue h-функции, который нужен renderer-слою без привязки к компоненту. */
export type SFCVueRenderH = typeof VueH

/** Результат рендера одного SFC узла. */
export type SFCVueRenderResult = VNode | string | null

/** Результат рендера списка SFC узлов. */
export type SFCVueRenderListResult = Array<VNode | string>

/** Вход renderer-а одного SFC element node. */
export interface SFCVueRenderElementInput {
  h: SFCVueRenderH
  node: RComponentSFC_IR_ElementNode
  context: SFCVueRenderContext
  children: SFCVueRenderListResult
  renderChildren: (context: SFCVueRenderContext) => SFCVueRenderListResult
  props: Record<string, unknown>
  attrs: Record<string, unknown>
}

/** Функция renderer-а одного SFC primitive-тега. */
export type SFCVueRenderFunction = (
  input: SFCVueRenderElementInput,
) => SFCVueRenderResult

/** Вход функции рендера произвольного SFC IR узла. */
export interface SFCVueRenderNodeInput {
  h: SFCVueRenderH
  node: RComponentSFC_IR_Node
  context: SFCVueRenderContext
}

/** Настройки условного рендера, вычисленные из sibling chain. */
export interface SFCVueRenderConditionState {
  shouldRender: boolean
  startsChain: boolean
  matchedChain: boolean
  closesChain: boolean
}

/** Нормализованное значение style prop. */
export type SFCVueRenderStyleValue = string | number | null | undefined

/** Сервисная функция вычисления IR-значений. */
export type SFCVueRenderValueEvaluator = (
  value: RComponentSFC_IR_Value | undefined,
  context: SFCVueRenderContext,
) => unknown
