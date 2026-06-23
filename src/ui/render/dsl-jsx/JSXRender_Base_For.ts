function parseForExpression(exp: string): {
  valueAlias: string
  keyAlias?: string
  indexAlias?: string
  sourceExpr: string
} {
  const IN_RE = /\s+(in|of)\s+/
  const m = exp.match(IN_RE)
  if (!m) throw new Error(`v-for: неверное выражение "${exp}"`)
  const lhs = exp.slice(0, m.index).trim()
  const rhs = exp.slice((m.index || 0) + m[0].length).trim()

  let valueAlias = ''
  let keyAlias: string | undefined
  let indexAlias: string | undefined

  if (lhs.startsWith('(') && lhs.endsWith(')')) {
    const aliases = lhs
      .slice(1, -1)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    valueAlias = aliases[0] || 'item'
    keyAlias = aliases[1]
    indexAlias = aliases[2]
  } else {
    valueAlias = lhs
  }
  return { valueAlias, keyAlias, indexAlias, sourceExpr: rhs }
}

export function readForFromNode(node: any) {
  const forDir = node?.props?.find(
    (p: any) => p.type === 7 && p.name === 'for' && (p.exp || p.source),
  )
  if (!forDir) return null

  // Если compiler-dom уже дал разобранные части - используем их
  const sourceExpr = forDir.source?.content?.trim?.()
  const valueAlias = forDir.value?.content
  const keyAlias = forDir.key?.content
  const indexAlias = forDir.index?.content

  if (sourceExpr) {
    return {
      sourceExpr,
      valueAlias: valueAlias || 'item',
      keyAlias,
      indexAlias,
    }
  }

  // Иначе парсим exp вручную
  if (forDir.exp?.type === 4) {
    const {
      valueAlias: v,
      keyAlias: k,
      indexAlias: i,
      sourceExpr: s,
    } = parseForExpression(forDir.exp.content.trim())
    return { sourceExpr: s, valueAlias: v, keyAlias: k, indexAlias: i }
  }

  return null
}
