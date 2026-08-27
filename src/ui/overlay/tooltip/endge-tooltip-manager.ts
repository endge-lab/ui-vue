import type {
  EndgeTooltipAlign,
  EndgeTooltipConfiguration,
  EndgeTooltipSide,
} from '@endge/core'
import type { InjectionKey, VNodeChild } from 'vue'
import {
  Endge,
  ENDGE_KEYBOARD_CONTEXT_RAPH_PATH,
  matchesComponentSFCInteractionKeyboardCondition,
  normalizeComponentSFCInteractionKeyboardCondition,
} from '@endge/core'
import { Raph } from '@endge/raph'
import { shallowReactive } from 'vue'

export type EndgeTooltipContentKind = 'text' | 'markdown' | 'rich'
export type EndgeTooltipActivationReason = 'pointer' | 'focus'

export interface EndgeVueTooltipPolicy extends EndgeTooltipConfiguration {}

export interface EndgeVueTooltipRequest {
  ownerId: string
  domId: string
  anchor: HTMLElement
  kind: EndgeTooltipContentKind
  policy?: Partial<EndgeVueTooltipPolicy>
  className?: unknown
  authoredId?: string
  part?: string
  renderContent: () => VNodeChild
}

export interface EndgeVueTooltipState {
  phase: 'idle' | 'pending' | 'visible'
  ownerId: string | null
  domId: string | null
  anchor: HTMLElement | null
  kind: EndgeTooltipContentKind
  policy: EndgeVueTooltipPolicy
  className: unknown
  authoredId: string | null
  part: string | null
  content: VNodeChild | null
}

/** One lazy overlay manager owned by one mounted EndgeShell. */
export class EndgeVueTooltipManager {
  public readonly state: EndgeVueTooltipState
  public readonly adapterId: string

  private _request: EndgeVueTooltipRequest | null = null
  private _reasons = new Set<EndgeTooltipActivationReason>()
  private _openTimer: ReturnType<typeof setTimeout> | null = null
  private _closeTimer: ReturnType<typeof setTimeout> | null = null
  private _generation = 0
  private _disposed = false
  private readonly _defaults: EndgeTooltipConfiguration
  private readonly _disposeKeyboardWatch: () => void

  public constructor(adapterId: string, defaults: EndgeTooltipConfiguration) {
    this.adapterId = adapterId
    this._defaults = { ...defaults }
    this.state = shallowReactive({
      phase: 'idle',
      ownerId: null,
      domId: null,
      anchor: null,
      kind: 'text',
      policy: { ...defaults },
      className: null,
      authoredId: null,
      part: null,
      content: null,
    })
    this._disposeKeyboardWatch = Raph.watch([
      ENDGE_KEYBOARD_CONTEXT_RAPH_PATH,
      `${ENDGE_KEYBOARD_CONTEXT_RAPH_PATH}.*`,
    ], () => this._reconcileActivation())
  }

  public activate(request: EndgeVueTooltipRequest, reason: EndgeTooltipActivationReason): void {
    if (this._disposed || !request.anchor.isConnected) {
      return
    }
    this._clearCloseTimer()

    if (this._request?.ownerId !== request.ownerId) {
      this._hideNow()
      this._reasons.clear()
    }

    this._request = request
    this._reasons.add(reason)
    this._reconcileActivation()
  }

  public deactivate(ownerId: string, reason: EndgeTooltipActivationReason): void {
    if (this._request?.ownerId !== ownerId) {
      return
    }
    this._reasons.delete(reason)
    if (this._reasons.size > 0) {
      return
    }
    this._clearOpenTimer()
    const delay = this._resolvePolicy(this._request.policy).closeDelay
    if (delay === 0) {
      this._hideNow()
      return
    }
    this._clearCloseTimer()
    const generation = ++this._generation
    this._closeTimer = setTimeout(() => {
      if (generation === this._generation && this._reasons.size === 0) {
        this._hideNow()
      }
    }, delay)
  }

  public close(ownerId?: string): void {
    if (ownerId && this._request?.ownerId !== ownerId) {
      return
    }
    this._reasons.clear()
    this._hideNow()
  }

  public dispose(): void {
    if (this._disposed) {
      return
    }
    this._disposed = true
    this._disposeKeyboardWatch()
    this._reasons.clear()
    this._hideNow()
  }

  private _show(generation: number, policy: EndgeVueTooltipPolicy): void {
    this._openTimer = null
    const request = this._request
    if (
      this._disposed
      || generation !== this._generation
      || !request
      || this._reasons.size === 0
      || !request.anchor.isConnected
      || !this._matchesKeyboard(policy)
    ) {
      this._hideNow()
      return
    }

    this.state.phase = 'visible'
    this.state.ownerId = request.ownerId
    this.state.domId = request.domId
    this.state.anchor = request.anchor
    this.state.kind = request.kind
    this.state.policy = policy
    this.state.className = request.className ?? null
    this.state.authoredId = request.authoredId ?? null
    this.state.part = request.part ?? null
    this.state.content = request.renderContent()
    addDescribedBy(request.anchor, request.domId)
  }

  private _hideNow(): void {
    this._suspend()
    this._request = null
  }

  private _suspend(): void {
    this._clearOpenTimer()
    this._clearCloseTimer()
    this._generation += 1
    if (this.state.anchor && this.state.domId) {
      removeDescribedBy(this.state.anchor, this.state.domId)
    }
    this.state.phase = 'idle'
    this.state.ownerId = null
    this.state.domId = null
    this.state.anchor = null
    this.state.className = null
    this.state.authoredId = null
    this.state.part = null
    this.state.content = null
  }

  private _reconcileActivation(): void {
    const request = this._request
    if (this._disposed || !request || this._reasons.size === 0 || !request.anchor.isConnected) {
      return
    }

    const policy = this._resolvePolicy(request.policy)
    if (!this._matchesKeyboard(policy)) {
      this._suspend()
      return
    }
    if ((this.state.phase === 'visible' || this.state.phase === 'pending') && this.state.ownerId === request.ownerId) {
      return
    }

    this._clearOpenTimer()
    this.state.phase = 'pending'
    this.state.ownerId = request.ownerId
    const generation = ++this._generation
    if (policy.openDelay === 0) {
      this._show(generation, policy)
    }
    else { this._openTimer = setTimeout(() => this._show(generation, policy), policy.openDelay) }
  }

  private _matchesKeyboard(policy: EndgeVueTooltipPolicy): boolean {
    const keyboard = Endge.context.getKeyboardState()
    return matchesComponentSFCInteractionKeyboardCondition(policy.keyboard, keyboard, keyboard.platform)
  }

  private _resolvePolicy(local: Partial<EndgeVueTooltipPolicy> | undefined): EndgeVueTooltipPolicy {
    const next: EndgeTooltipConfiguration = { ...this._defaults }
    for (const [key, value] of Object.entries(local ?? {})) {
      if (value != null) {
        (next as any)[key] = value
      }
    }
    const keyboard = normalizeComponentSFCInteractionKeyboardCondition(next.keyboard)
    return {
      side: normalizeSide(next.side),
      align: normalizeAlign(next.align),
      openDelay: normalizeDelay(next.openDelay, this._defaults.openDelay),
      closeDelay: normalizeDelay(next.closeDelay, this._defaults.closeDelay),
      ...(keyboard ? { keyboard } : {}),
    }
  }

  private _clearOpenTimer(): void {
    if (this._openTimer != null) {
      clearTimeout(this._openTimer)
    }
    this._openTimer = null
  }

  private _clearCloseTimer(): void {
    if (this._closeTimer != null) {
      clearTimeout(this._closeTimer)
    }
    this._closeTimer = null
  }
}

export const EndgeVueTooltipManagerKey: InjectionKey<EndgeVueTooltipManager> = Symbol('EndgeVueTooltipManager')

export function attachEndgeTooltipTriggerAttrs(
  attrs: Record<string, unknown>,
  manager: EndgeVueTooltipManager | null,
  createRequest: (anchor: HTMLElement) => EndgeVueTooltipRequest,
): void {
  if (!manager) {
    return
  }
  let ownerId = ''
  appendHandler(attrs, 'onMouseenter', (event: MouseEvent) => {
    const anchor = event.currentTarget as HTMLElement
    const request = createRequest(anchor)
    ownerId = request.ownerId
    manager.activate(request, 'pointer')
  })
  appendHandler(attrs, 'onMouseleave', () => ownerId && manager.deactivate(ownerId, 'pointer'))
  appendHandler(attrs, 'onFocusin', (event: FocusEvent) => {
    const anchor = event.currentTarget as HTMLElement
    const request = createRequest(anchor)
    ownerId = request.ownerId
    manager.activate(request, 'focus')
  })
  appendHandler(attrs, 'onFocusout', () => ownerId && manager.deactivate(ownerId, 'focus'))
  appendHandler(attrs, 'onKeydown', (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !ownerId) {
      return
    }
    event.stopPropagation()
    manager.close(ownerId)
  })
  appendHandler(attrs, 'onVnodeUnmounted', () => ownerId && manager.close(ownerId))
  attrs['data-endge-tooltip-trigger'] = ''
}

function appendHandler(attrs: Record<string, unknown>, name: string, handler: (event: any) => void): void {
  const current = attrs[name]
  attrs[name] = current ? [current, handler] : handler
}

function normalizeSide(value: unknown): EndgeTooltipSide {
  return ['top', 'right', 'bottom', 'left'].includes(String(value)) ? value as EndgeTooltipSide : 'right'
}

function normalizeAlign(value: unknown): EndgeTooltipAlign {
  return ['start', 'center', 'end'].includes(String(value)) ? value as EndgeTooltipAlign : 'center'
}

function normalizeDelay(value: unknown, fallback: number): number {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? Math.min(60_000, Math.round(number)) : fallback
}

function addDescribedBy(anchor: HTMLElement, id: string): void {
  const ids = new Set((anchor.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean))
  ids.add(id)
  anchor.setAttribute('aria-describedby', [...ids].join(' '))
}

function removeDescribedBy(anchor: HTMLElement, id: string): void {
  const ids = (anchor.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(value => value && value !== id)
  if (ids.length) {
    anchor.setAttribute('aria-describedby', ids.join(' '))
  }
  else { anchor.removeAttribute('aria-describedby') }
}
