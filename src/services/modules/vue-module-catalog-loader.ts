import type { ModuleArtifactLoader, ModuleManifest } from '@endge/core'
import type { VueModuleExports, VueModuleHost } from './vue-module'
import { createVueModuleArtifact } from './vue-module'

interface ModuleVersionDescriptor {
  version: string
  manifest: ModuleManifest
  assets: { js: string, css?: string }
}

interface VueModuleCatalogLoaderOptions {
  backendURL: string
  host: () => Promise<VueModuleHost>
  resolveAccessToken?: () => Promise<string | null>
}

/** Loads an exact catalog version with the host's session and shared dependencies. */
export function createVueModuleCatalogLoader(options: VueModuleCatalogLoaderOptions): ModuleArtifactLoader {
  return async (reference, signal) => {
    const backend = new URL(options.backendURL, location.href)
    const sameOrigin = backend.origin === location.origin
    if (!sameOrigin && !options.resolveAccessToken) {
      throw new Error('A cross-origin module catalog requires a host access-token resolver.')
    }

    const token = await options.resolveAccessToken?.()
    signal.throwIfAborted()
    const catalog = backend.href.replace(/\/$/, '')
    const versionURL = `${catalog}/api/v1/modules/${encodeURIComponent(reference.identity)}/versions/${encodeURIComponent(reference.version)}`
    const request = async (url: string): Promise<Response> => {
      const response = await fetch(url, {
        signal,
        credentials: sameOrigin ? 'same-origin' : 'omit',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        redirect: 'error',
      })
      if (!response.ok) {
        throw new Error(`Module "${reference.identity}@${reference.version}" catalog request failed (HTTP ${response.status}).`)
      }
      return response
    }

    const descriptor = await (await request(versionURL)).json() as ModuleVersionDescriptor
    const { manifest } = descriptor
    if (descriptor.version !== reference.version || manifest?.identity !== reference.identity
      || manifest.version !== reference.version || manifest.formatVersion !== 1 || manifest.hostApi !== 1) {
      throw new Error(`Incompatible module manifest for "${reference.identity}@${reference.version}".`)
    }

    const assetURL = (path: string, filename: string): string => {
      const expected = `${versionURL}/assets/${filename}`
      const actual = new URL(path, backend.origin)
      if (actual.href !== expected) {
        throw new Error(`Module asset must use the configured Backend origin and catalog path: ${filename}.`)
      }
      return actual.href
    }
    const asset = assetURL(descriptor.assets.js, 'module.js')
    const cssURL = descriptor.assets.css && assetURL(descriptor.assets.css, 'module.css')
    const [host, css, source] = await Promise.all([
      options.host(),
      cssURL ? request(cssURL).then(response => response.text()) : undefined,
      token || !sameOrigin ? request(asset).then(response => response.text()) : undefined,
    ])
    signal.throwIfAborted()

    // Native import carries the same-origin session. A bearer-authenticated response
    // needs a browser module URL because import() cannot attach request headers.
    const objectURL = source === undefined
      ? undefined
      : URL.createObjectURL(new Blob([source], { type: 'text/javascript' }))
    try {
      const module = await import(/* @vite-ignore */ (objectURL ?? asset)) as VueModuleExports
      signal.throwIfAborted()
      return createVueModuleArtifact(module, host, css)
    }
    finally {
      if (objectURL) {
        URL.revokeObjectURL(objectURL)
      }
    }
  }
}
