import type { TimelineRecipeBounds, TimelineRecipeRect, TimelineRecipeShape } from '@endge/core'

const assets = new Map<string, HTMLCanvasElement>()

function figurePath(shape: TimelineRecipeShape, width: number, height: number, inset: number, radius: number): Path2D {
  const left = inset
  const top = inset
  const right = width - inset
  const bottom = height - inset
  const centerX = width / 2
  const centerY = height / 2
  const path = new Path2D()
  if (shape === 'circle') {
    path.arc(centerX, centerY, Math.max(0, centerX - inset), 0, Math.PI * 2)
  }
  else if (shape === 'rect') {
    path.roundRect(left, top, right - left, bottom - top, Math.min(radius, centerX - inset, centerY - inset))
  }
  else {
    const vertices = shape === 'diamond'
      ? [[centerX, top], [right, centerY], [centerX, bottom], [left, centerY]]
      : [[centerX, top], [right, bottom], [left, bottom]]
    const rounding = Math.min(radius, (right - left) / 4, (bottom - top) / 4)
    const [first, next] = vertices
    path.moveTo((first![0]! + next![0]!) / 2, (first![1]! + next![1]!) / 2)
    for (let index = 1; index <= vertices.length; index++) {
      const [x, y] = vertices[index % vertices.length]!
      const [nextX, nextY] = vertices[(index + 1) % vertices.length]!
      path.arcTo(x!, y!, (x! + nextX!) / 2, (y! + nextY!) / 2, rounding)
    }
    path.closePath()
  }
  return path
}

function paintFigure(context: CanvasRenderingContext2D, path: Path2D, fill: TimelineRecipeRect['fill'], width: number, height: number) {
  if (typeof fill === 'string') {
    context.fillStyle = fill
    context.fill(path)
    return
  }
  const angle = fill.angle * Math.PI / 180
  if (fill.type === 'linear-gradient') {
    const dx = Math.sin(angle)
    const dy = -Math.cos(angle)
    const extent = (Math.abs(dx) * width + Math.abs(dy) * height) / 2
    const gradient = context.createLinearGradient(width / 2 - dx * extent, height / 2 - dy * extent, width / 2 + dx * extent, height / 2 + dy * extent)
    gradient.addColorStop(0, fill.from)
    gradient.addColorStop(1, fill.to)
    context.fillStyle = gradient
    context.fill(path)
    return
  }
  context.save()
  context.clip(path)
  context.fillStyle = fill.background
  context.fillRect(0, 0, width, height)
  const tile = document.createElement('canvas')
  tile.width = Math.ceil(fill.width * 4)
  tile.height = 1
  const tileContext = tile.getContext('2d')
  if (tileContext) {
    tileContext.fillStyle = fill.color
    tileContext.fillRect(0, 0, fill.width * 2, 1)
    const pattern = context.createPattern(tile, 'repeat')
    if (pattern) {
      pattern.setTransform(new DOMMatrix().rotate(fill.angle - 90).scale(0.5, 1))
      context.fillStyle = pattern
      context.fillRect(0, 0, width, height)
    }
  }
  context.restore()
}

export function timelineRecipeElementAsset(shape: TimelineRecipeShape, item: TimelineRecipeRect, bounds: TimelineRecipeBounds, clip: TimelineRecipeBounds): HTMLCanvasElement | undefined {
  if (typeof document === 'undefined' || bounds.width <= 0 || bounds.height <= 0 || clip.width <= 0 || clip.height <= 0
    || (item.fill === 'transparent' && !item.border)) {
    return undefined
  }
  const { width, height } = bounds
  const x = bounds.x - clip.x
  const y = bounds.y - clip.y
  const key = JSON.stringify([shape, item.fill, item.opacity, item.radius, item.border, width, height, x, y, clip.width, clip.height])
  const cached = assets.get(key)
  if (cached) {
    return cached
  }
  const canvas = document.createElement('canvas')
  const scale = Math.min(2, 512 / Math.max(clip.width, clip.height))
  canvas.width = Math.max(1, Math.ceil(clip.width * scale))
  canvas.height = Math.max(1, Math.ceil(clip.height * scale))
  const context = canvas.getContext('2d')
  if (!context) {
    return undefined
  }
  context.scale(canvas.width / clip.width, canvas.height / clip.height)
  context.translate(x, y)
  const radius = item.radius ?? 0
  context.fillStyle = 'transparent'
  context.globalAlpha = item.opacity ?? 1
  paintFigure(context, figurePath(shape, width, height, 0, radius), item.fill, width, height)
  if (item.border) {
    const lineWidth = Math.min(item.border.width, width, height)
    context.globalAlpha = 1
    context.strokeStyle = item.border.color
    context.lineWidth = lineWidth
    context.lineJoin = 'round'
    context.setLineDash(item.border.style === 'dashed' ? [lineWidth * 3, lineWidth * 2] : [])
    context.stroke(figurePath(shape, width, height, lineWidth / 2, Math.max(0, radius - lineWidth / 2)))
  }
  if (assets.size >= 96) {
    assets.delete(assets.keys().next().value!)
  }
  assets.set(key, canvas)
  return canvas
}
