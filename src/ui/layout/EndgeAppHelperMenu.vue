<script setup lang="ts">
import { Endge } from '@endge/core'
import { onBeforeUnmount, onMounted, ref } from 'vue'

interface ConsoleItem {
  name: string
  description?: string
}

const HELPER_MENU_OWNER_KEY = '__endgeAppHelperMenuOwner__'
const HELPER_MENU_RELEASE_EVENT = 'endge-helper-menu-owner-released'

const helperMenuLabel = 'Открыть сервисное меню'
const helperMenuTitle = 'Сервисное меню'
const helperMenuNoDescription = 'Без описания'
const helperMenuEmpty = 'Команды консоли не зарегистрированы.'
const helperMenuToggleText = 'E'
const helperMenuDownloadCommand = 'downloadDomain'
const helperMenuDownloadDescription = 'Скачать JSON схему домена'
const helperMenuRuntimesCommand = 'logRuntimeHosts'
const helperMenuRuntimesDescription = 'Вывести в консоль список runtime-сущностей из регистра'

const instanceId = Symbol('endge-app-helper-menu')
const isVisible = ref(false)
const isMenuOpen = ref(false)
const isPrimary = ref(false)
const items = ref<ConsoleItem[]>([])
const rootEl = ref<HTMLElement | null>(null)
const keydownListenerOptions: AddEventListenerOptions = { capture: true }

function getHelperMenuOwner(): symbol | null {
  const owner = (globalThis as Record<string, unknown>)[HELPER_MENU_OWNER_KEY]
  return typeof owner === 'symbol' ? owner : null
}

function claimOwnership(): void {
  ;(globalThis as Record<string, unknown>)[HELPER_MENU_OWNER_KEY] = instanceId
  isPrimary.value = true
}

function releaseOwnership(): void {
  if (getHelperMenuOwner() !== instanceId)
    return

  delete (globalThis as Record<string, unknown>)[HELPER_MENU_OWNER_KEY]
  isPrimary.value = false
  globalThis.dispatchEvent(new CustomEvent(HELPER_MENU_RELEASE_EVENT))
}

function onOwnershipReleased(): void {
  claimOwnership()
}

function runItem(item: ConsoleItem): void {
  try {
    if (item.name === helperMenuDownloadCommand) {
      void Endge.download()
      return
    }
    if (item.name === helperMenuRuntimesCommand) {
      const hosts = Endge.runtime.getRuntimeHosts()
      const list = hosts.map(h => ({
        id: h.id,
        entityType: h.entityType,
        entityIdentity: h.entityIdentity,
        title: h.title,
        status: h.status,
        runtimeType: h.runtimeType,
      }))
      console.log('[Runtime registry]', list.length, 'host(s)')
      console.table(list)
      console.log(list)
      return
    }

    const globalEndge = (globalThis as any)?.Endge as Record<string, unknown> | undefined
    const fn = globalEndge && typeof globalEndge === 'object' ? (globalEndge as any)[item.name] : undefined
    if (typeof fn === 'function')
      fn()
  }
  catch {
    // ignore command runtime errors
  }
  finally {
    isMenuOpen.value = false
  }
}

function onGlobalPointerDown(event: PointerEvent): void {
  if (!isPrimary.value)
    return
  if (!isMenuOpen.value)
    return
  const root = rootEl.value
  if (!root)
    return
  const target = event.target as Node | null
  if (!target)
    return
  if (!root.contains(target))
    isMenuOpen.value = false
}

function refreshItems(): void {
  try {
    const meta = (Endge.console as any)?.getRegisteredMeta?.() as ConsoleItem[] | undefined
    const metaMap = new Map<string, string | undefined>()
    if (Array.isArray(meta)) {
      for (const item of meta) {
        if (!item?.name)
          continue
        metaMap.set(item.name, item.description)
      }
    }

    const globalEndge = (globalThis as any)?.Endge as Record<string, unknown> | undefined
    if (globalEndge && typeof globalEndge === 'object') {
      const result: ConsoleItem[] = []

      result.push({
        name: helperMenuDownloadCommand,
        description: helperMenuDownloadDescription,
      })
      result.push({
        name: helperMenuRuntimesCommand,
        description: helperMenuRuntimesDescription,
      })

      for (const key of Object.keys(globalEndge)) {
        if (!key)
          continue
        if (key === helperMenuDownloadCommand || key === helperMenuRuntimesCommand)
          continue
        if (typeof (globalEndge as any)[key] !== 'function')
          continue
        result.push({
          name: key,
          description: metaMap.get(key),
        })
      }
      items.value = result
    }
    else {
      items.value = [
        {
          name: helperMenuDownloadCommand,
          description: helperMenuDownloadDescription,
        },
        {
          name: helperMenuRuntimesCommand,
          description: helperMenuRuntimesDescription,
        },
        ...(Array.isArray(meta)
          ? meta.filter(item => item?.name && item.name !== helperMenuDownloadCommand && item.name !== helperMenuRuntimesCommand)
          : []),
      ]
    }
  }
  catch {
    items.value = [{
      name: helperMenuDownloadCommand,
      description: helperMenuDownloadDescription,
    }]
  }
}

function toggleMenu(): void {
  if (!isMenuOpen.value)
    refreshItems()
  isMenuOpen.value = !isMenuOpen.value
}

function hideAll(): void {
  isMenuOpen.value = false
  isVisible.value = false
}

function isToggleShortcut(event: KeyboardEvent): boolean {
  if (!event.ctrlKey && !event.metaKey)
    return false

  const key = event.key?.toLowerCase()
  const code = event.code

  return key === 'e' || code === 'KeyE'
}

function handleKeydown(event: KeyboardEvent): void {
  if (!isPrimary.value)
    return
  if (!isToggleShortcut(event))
    return

  event.preventDefault()

  if (!isVisible.value) {
    isVisible.value = true
    isMenuOpen.value = false
    return
  }

  if (!isMenuOpen.value) {
    refreshItems()
    isMenuOpen.value = true
  }
  else {
    hideAll()
  }
}

onMounted(() => {
  claimOwnership()
  window.addEventListener('keydown', handleKeydown, keydownListenerOptions)
  window.addEventListener('pointerdown', onGlobalPointerDown)
  window.addEventListener(HELPER_MENU_RELEASE_EVENT, onOwnershipReleased)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown, keydownListenerOptions)
  window.removeEventListener('pointerdown', onGlobalPointerDown)
  window.removeEventListener(HELPER_MENU_RELEASE_EVENT, onOwnershipReleased)
  releaseOwnership()
})
</script>

<template>
  <div
    v-if="isVisible"
    ref="rootEl"
    class="endge-helper-menu"
  >
    <div class="endge-helper-menu__container">
      <button
        type="button"
        class="endge-helper-menu__toggle"
        :aria-label="helperMenuLabel"
        @click="toggleMenu"
      >
        {{ helperMenuToggleText }}
      </button>

      <Transition name="endge-helper-menu-fade">
        <div
          v-if="isMenuOpen"
          class="endge-helper-menu__panel"
        >
          <div class="endge-helper-menu__title">
            {{ helperMenuTitle }}
          </div>

          <div
            v-if="items.length"
            class="endge-helper-menu__list"
          >
            <button
              v-for="item in items"
              :key="item.name"
              type="button"
              class="endge-helper-menu__item"
              @click="runItem(item)"
            >
              <span class="endge-helper-menu__item-name">
                {{ item.name }}
              </span>
              <span class="endge-helper-menu__item-desc">
                {{ item.description || helperMenuNoDescription }}
              </span>
            </button>
          </div>

          <div
            v-else
            class="endge-helper-menu__empty"
          >
            {{ helperMenuEmpty }}
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.endge-helper-menu {
  position: fixed;
  left: 16px;
  bottom: 16px;
  z-index: 260;
}

.endge-helper-menu__container {
  position: relative;
}

.endge-helper-menu__toggle {
  width: 44px;
  height: 44px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.9);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 10px 24px -14px rgba(2, 6, 23, 0.75);
  transition: background-color 120ms ease;
}

.endge-helper-menu__toggle:hover {
  background: rgba(15, 23, 42, 1);
}

.endge-helper-menu__toggle:focus-visible {
  outline: 2px solid rgba(14, 165, 233, 0.5);
  outline-offset: 2px;
}

.endge-helper-menu__panel {
  position: absolute;
  left: 0;
  bottom: 52px;
  width: 288px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.96);
  padding: 10px;
  box-shadow: 0 20px 30px -20px rgba(2, 6, 23, 0.6);
}

.endge-helper-menu__title {
  margin: 0 0 8px;
  color: #64748b;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.endge-helper-menu__list {
  display: grid;
  gap: 6px;
}

.endge-helper-menu__item {
  width: 100%;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: #0f172a;
  cursor: pointer;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 10px;
  text-align: left;
  transition: background-color 120ms ease;
}

.endge-helper-menu__item:hover {
  background: rgba(15, 23, 42, 0.06);
}

.endge-helper-menu__item-name {
  margin-top: 1px;
  flex-shrink: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 11px;
  font-weight: 600;
}

.endge-helper-menu__item-desc {
  color: #64748b;
  font-size: 11px;
  line-height: 1.3;
}

.endge-helper-menu__empty {
  color: #64748b;
  font-size: 11px;
  line-height: 1.4;
  padding: 8px;
}

.endge-helper-menu-fade-enter-active,
.endge-helper-menu-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.endge-helper-menu-fade-enter-from,
.endge-helper-menu-fade-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.98);
}
</style>
