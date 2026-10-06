import type {
  EndgeTooltipAlign,
  EndgeTooltipConfiguration,
  EndgeTooltipSide,
} from '@endge/core'
import type { RaphScope } from '@raphy-js/raph'
import type { InjectionKey, VNode, VNodeChild } from 'vue'
import {
  Endge,
  ENDGE_KEYBOARD_CONTEXT_RAPH_PATH,
  matchesComponentSFCInteractionKeyboardCondition,
  normalizeComponentSFCInteractionKeyboardCondition,
} from '@endge/core'
import { Raph } from '@raphy-js/raph'
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

let tooltipScopeSequence = 0

/**
 * Один ленивый manager overlay, принадлежащий одному смонтированному EndgeShell.
 */
export class EndgeVueTooltipManager {
  public readonly state: EndgeVueTooltipState
  public readonly adapterId: string

  private _request: EndgeVueTooltipRequest | null = null
  private _reasons = new Set<EndgeTooltipActivationReason>()
  private _openTimer: ReturnType<typeof setTimeout> | null = null
  private _closeTimer: ReturnType<typeof setTimeout> | null = null
  private _detachTimer: ReturnType<typeof setTimeout> | null = null
  private _detachedAnchor: HTMLElement | null = null
  private _generation = 0
  private _disposed = false
  private readonly _defaults: EndgeTooltipConfiguration
  private readonly _disposeKeyboardWatch: () => void
  private readonly _raphScope: RaphScope

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
    this._raphScope = Raph.runtime().scope(`tooltip:${adapterId}:${tooltipScopeSequence++}`)
    this._disposeKeyboardWatch = this._raphScope.watch(
      Raph.runtime().path(ENDGE_KEYBOARD_CONTEXT_RAPH_PATH),
      'watch',
      () => this._reconcileActivation(),
    )
  }

  public activate(request: EndgeVueTooltipRequest, reason: EndgeTooltipActivationReason): void {
    if (this._disposed || !request.anchor.isConnected) {
      return
    }
    this._clearCloseTimer()
    this._clearDetachTimer()

    if (this._request?.ownerId !== request.ownerId) {
      this._hideNow()
      this._reasons.clear()
    }

    this._request = request
    this._reasons.add(reason)
    if (this.state.phase === 'visible' && this.state.ownerId === request.ownerId && this.state.anchor !== request.anchor) {
      if (this.state.anchor && this.state.domId) {
        removeDescribedBy(this.state.anchor, this.state.domId)
      }
      this.state.anchor = request.anchor
      this.state.policy = this._resolvePolicy(request.policy)
      this.state.className = request.className ?? null
      this.state.authoredId = request.authoredId ?? null
      this.state.part = request.part ?? null
      this.state.content = request.renderContent()
      addDescribedBy(request.anchor, request.domId)
    }
    this._reconcileActivation()
  }

  public deactivate(ownerId: string, reason: EndgeTooltipActivationReason, anchor?: HTMLElement): void {
    if (this._request?.ownerId !== ownerId || (anchor && this._request.anchor !== anchor)) {
      return
    }
    if (anchor && (this._detachedAnchor === anchor || !anchor.isConnected)) {
      this.detachTrigger(ownerId, anchor)
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

  public detachTrigger(ownerId: string, anchor: HTMLElement): void {
    if (this._request?.ownerId !== ownerId || this._request.anchor !== anchor || this._detachedAnchor === anchor) {
      return
    }
    this._detachedAnchor = anchor
    this._reasons.clear()
    this._clearOpenTimer()
    this._clearCloseTimer()
    if (this.state.phase === 'pending') {
      this.state.phase = 'idle'
      this.state.ownerId = null
    }
    const generation = ++this._generation
    const delay = Math.min(150, Math.max(50, this._resolvePolicy(this._request.policy).closeDelay))
    this._detachTimer = setTimeout(() => {
      this._detachTimer = null
      this._detachedAnchor = null
      if (generation === this._generation && this._request?.anchor === anchor) {
        this._hideNow()
      }
    }, delay)
  }

  public reattachIfHovered(
    ownerId: string,
    anchor: HTMLElement,
    createRequest: (anchor: HTMLElement) => EndgeVueTooltipRequest,
  ): void {
    if (this._request?.ownerId !== ownerId || this._request.anchor === anchor) {
      return
    }
    const reattach = () => {
      if (!anchor.isConnected || this._request?.ownerId !== ownerId || this._request.anchor === anchor) {
        return
      }
      if (anchor.matches(':hover')) {
        this.activate(createRequest(anchor), 'pointer')
      }
      if (anchor.contains(document.activeElement)) {
        this.activate(createRequest(anchor), 'focus')
      }
    }
    reattach()
    if (this._request?.anchor !== anchor) {
      requestAnimationFrame(reattach)
    }
  }

  public refreshTrigger(
    ownerId: string,
    anchor: HTMLElement,
    createRequest: (anchor: HTMLElement) => EndgeVueTooltipRequest,
  ): void {
    if (this._request?.ownerId !== ownerId || this._request.anchor !== anchor) {
      return
    }
    const request = createRequest(anchor)
    this._request = request
    if (this.state.phase === 'visible' && request.kind === 'text') {
      const content = request.renderContent()
      if (this.state.content !== content) {
        this.state.content = content
      }
    }
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
    this._raphScope.dispose()
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
    this._clearDetachTimer()
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

  private _clearDetachTimer(): void {
    if (this._detachTimer != null) {
      clearTimeout(this._detachTimer)
    }
    this._detachTimer = null
    this._detachedAnchor = null
  }
}

export const EndgeVueTooltipManagerKey: InjectionKey<EndgeVueTooltipManager> = Symbol('EndgeVueTooltipManager')

export function attachEndgeTooltipTriggerAttrs(
  attrs: Record<string, unknown>,
  manager: EndgeVueTooltipManager | null,
  ownerId: string,
  createRequest: (anchor: HTMLElement) => EndgeVueTooltipRequest,
): void {
  if (!manager) {
    return
  }
  appendHandler(attrs, 'onMouseenter', (event: MouseEvent) => {
    const anchor = event.currentTarget as HTMLElement
    manager.activate(createRequest(anchor), 'pointer')
  })
  appendHandler(attrs, 'onMouseleave', (event: MouseEvent) => manager.deactivate(ownerId, 'pointer', event.currentTarget as HTMLElement))
  appendHandler(attrs, 'onFocusin', (event: FocusEvent) => {
    const anchor = event.currentTarget as HTMLElement
    manager.activate(createRequest(anchor), 'focus')
  })
  appendHandler(attrs, 'onFocusout', (event: FocusEvent) => manager.deactivate(ownerId, 'focus', event.currentTarget as HTMLElement))
  appendHandler(attrs, 'onKeydown', (event: KeyboardEvent) => {
    if (event.key !== 'Escape') {
      return
    }
    event.stopPropagation()
    manager.close(ownerId)
  })
  appendHandler(attrs, 'onVnodeMounted', (vnode: VNode) => {
    if (vnode.el instanceof HTMLElement) {
      manager.reattachIfHovered(ownerId, vnode.el, createRequest)
    }
  })
  appendHandler(attrs, 'onVnodeUpdated', (vnode: VNode) => {
    if (vnode.el instanceof HTMLElement) {
      manager.refreshTrigger(ownerId, vnode.el, createRequest)
    }
  })
  appendHandler(attrs, 'onVnodeUnmounted', (vnode: VNode) => {
    if (vnode.el instanceof HTMLElement) {
      manager.detachTrigger(ownerId, vnode.el)
    }
  })
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
