import type { TimelineRecipeContent, TimelineRecipeIconShape } from '@endge/core'

const glyphs = new Map<string, HTMLCanvasElement>()
const lucideAssets = new WeakMap<readonly TimelineRecipeIconShape[], Map<string, HTMLCanvasElement>>()

function iconPath({ tag, attrs }: TimelineRecipeIconShape): Path2D {
  if (tag === 'path') {
    return new Path2D(attrs.d)
  }
  const path = new Path2D()
  const n = (name: string) => {
    const value = Number(attrs[name])
    return Number.isFinite(value) ? value : 0
  }
  switch (tag) {
    case 'circle':
      path.arc(n('cx'), n('cy'), Math.max(0, n('r')), 0, 2 * Math.PI)
      break
    case 'ellipse':
      path.ellipse(n('cx'), n('cy'), Math.max(0, n('rx')), Math.max(0, n('ry')), 0, 0, 2 * Math.PI)
      break
    case 'line':
      path.moveTo(n('x1'), n('y1'))
      path.lineTo(n('x2'), n('y2'))
      break
    case 'polyline':
    case 'polygon': {
      const points = (attrs.points?.match(/[+-]?(?:\d*\.\d+|\d+\.?\d*)(?:e[+-]?\d+)?/gi) ?? []).map(Number)
      const [x, y] = points
      if (x === undefined || y === undefined || !points.every(Number.isFinite)) {
        break
      }
      path.moveTo(x, y)
      for (let index = 2; index + 1 < points.length; index += 2) {
        path.lineTo(points[index]!, points[index + 1]!)
      }
      if (tag === 'polygon') {
        path.closePath()
      }
      break
    }
    case 'rect': {
      const width = Math.max(0, n('width'))
      const height = Math.max(0, n('height'))
      const rx = Math.max(0, attrs.rx === undefined ? n('ry') : n('rx'))
      const ry = Math.max(0, attrs.ry === undefined ? n('rx') : n('ry'))
      path.roundRect(n('x'), n('y'), width, height, { x: Math.min(rx, width / 2), y: Math.min(ry, height / 2) })
      break
    }
  }
  return path
}

export function timelineRecipeIconAsset(content: TimelineRecipeContent): string | HTMLCanvasElement | undefined {
  if (content.iconSource === 'asset') {
    return content.value.trim() || undefined
  }
  const shapes = content.iconSource === 'lucide' ? content.iconShapes : undefined
  if (!content.value || typeof document === 'undefined' || (content.iconSource === 'lucide' && !shapes?.length)) {
    return undefined
  }
  const color = content.iconColor?.trim() ?? '#fff'
  const key = shapes ? color : JSON.stringify([content.value, color])
  const cache = shapes ? lucideAssets.get(shapes) ?? new Map<string, HTMLCanvasElement>() : glyphs
  const existing = cache.get(key)
  if (existing) {
    return existing
  }
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 48
  const context = canvas.getContext('2d')
  if (!context) {
    return undefined
  }
  context.scale(2, 2)
  context.fillStyle = color
  if (shapes) {
    context.strokeStyle = color
    context.lineWidth = 2
    context.lineCap = 'round'
    context.lineJoin = 'round'
    for (const shape of shapes) {
      const path = iconPath(shape)
      if (shape.attrs.fill === 'currentColor') {
        context.fill(path)
      }
      context.stroke(path)
    }
    lucideAssets.set(shapes, cache)
  }
  else {
    context.font = 'bold 19.5px sans-serif'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(Array.from(content.value).slice(0, 2).join(''), 12, 12.75, 22.5)
  }
  if (cache.size >= 64) {
    cache.delete(cache.keys().next().value!)
  }
  cache.set(key, canvas)
  return canvas
}
