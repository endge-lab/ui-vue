import type {
  EndgeStyleAttributeSelector,
  EndgeStyleDiagnostic,
  EndgeStylePlacement,
  EndgeStyleRule,
  EndgeStyleSelector,
  EndgeStyleSheetArtifact,
  EndgeStyleSpecificity,
  EndgeStyleTargetProfile,
} from '@endge/core'
import { evaluateEndgeStyleSupport } from '@endge/core'

export interface EndgeDOMStyleClassEntry {
  artifactIdentity: string
  ruleId: string
  selectorIndex: number
  className: string
}

export interface EndgeDOMStyleMaterialization {
  css: string
  /** Поле совместимости. Нативным DOM-селекторам больше не нужны сгенерированные классы. */
  classes: EndgeDOMStyleClassEntry[]
  diagnostics: EndgeStyleDiagnostic[]
}

export type EndgeDOMStyleInput = EndgeStyleSheetArtifact | EndgeStylePlacement

function compareSpecificity(left: EndgeStyleSpecificity, right: EndgeStyleSpecificity): number {
  return left.ids - right.ids || left.classes - right.classes || left.types - right.types
}

function cssString(value: string): string {
  return JSON.stringify(value)
}

function collectCapabilities(rule: EndgeStyleRule): string[] {
  const result: string[] = []
  const visit = (condition: EndgeStyleRule['supports']) => {
    if (!condition) {
      return
    }
    if (condition.type === 'capability') {
      result.push(condition.capability)
    }
    else if (condition.type === 'not') {
      visit(condition.operand)
    }
    else if (condition.type === 'and' || condition.type === 'or') {
      condition.operands.forEach(visit)
    }
  }
  visit(rule.supports)
  return result
}

/** Преобразует нейтральные селекторы AST EndgeCSS в нативные браузерные семантические селекторы. */
export function materializeEndgeCSSForDOM(
  inputs: readonly EndgeDOMStyleInput[],
  target: EndgeStyleTargetProfile = { renderer: 'dom', capabilities: [] },
): EndgeDOMStyleMaterialization {
  const diagnostics: EndgeStyleDiagnostic[] = []
  const availableCapabilities = new Set(target.capabilities ?? [])
  const declarations: Array<{
    selector: EndgeStyleSelector
    nativeSelector: string
    property: string
    value: string
    important: boolean
    sourceOrder: number
    boundaryId?: string
    theme?: string
    scope?: EndgeStyleRule['scope']
    artifactScopeId?: string
  }> = []

  inputs.forEach((input, artifactOrder) => {
    const artifact = isPlacement(input) ? input.artifact : input
    const boundaryId = isPlacement(input) ? input.boundaryId : undefined
    for (const theme of artifact.themes) {
      const root = artifact.scope === 'component' && artifact.scopeId
        ? `[data-endge-scope-root=${cssString(artifact.scopeId)}]`
        : ':root'
      const declarationsText = theme.declarations
        .map(declaration => `${declaration.property}:${declaration.value}${declaration.important ? '!important' : ''};`)
        .join('')
      if (declarationsText) {
        declarations.push({
          selector: { source: root, segments: [], specificity: { ids: 0, classes: 0, types: 0 } },
          nativeSelector: root,
          property: '',
          value: declarationsText,
          important: false,
          sourceOrder: artifactOrder * 1_000_000 - 1,
          boundaryId,
          theme: theme.id,
        })
      }
    }

    for (const rule of artifact.rules) {
      for (const capability of collectCapabilities(rule)) {
        if (!availableCapabilities.has(capability)) {
          diagnostics.push({
            severity: 'warning',
            code: 'ENDGECSS_CAPABILITY_UNAVAILABLE',
            message: `DOM adapter does not expose capability "${capability}"; the guarded rule was excluded.`,
            range: rule.range,
          })
        }
      }
      if (!evaluateEndgeStyleSupport(rule.supports, target)) {
        continue
      }
      for (const selector of rule.selectors) {
        const nativeSelector = compileSelector(selector, artifact.scope === 'component' ? artifact.scopeId : undefined)
        for (const declaration of rule.declarations) {
          declarations.push({
            selector,
            nativeSelector,
            property: declaration.property,
            value: declaration.value,
            important: declaration.important,
            sourceOrder: artifactOrder * 1_000_000 + rule.sourceOrder,
            boundaryId,
            theme: rule.theme,
            scope: rule.scope,
            artifactScopeId: artifact.scope === 'component' ? artifact.scopeId : undefined,
          })
        }
      }
    }
  })

  declarations.sort((left, right) =>
    Number(left.important) - Number(right.important)
    || compareSpecificity(left.selector.specificity, right.selector.specificity)
    || left.sourceOrder - right.sourceOrder)

  const css = declarations.map((declaration) => {
    let selector = declaration.nativeSelector
    if (selector !== ':root' && !selector.startsWith('[data-endge-scope-root=')) {
      selector = uniformSpecificitySelector(selector)
    }
    if (declaration.boundaryId) {
      selector = applyBoundary(selector, declaration.boundaryId)
    }
    if (declaration.theme) {
      selector = selector === ':root'
        ? `:root[data-endge-theme=${cssString(declaration.theme)}]`
        : `:root[data-endge-theme=${cssString(declaration.theme)}] :is(${selector})`
    }
    const body = declaration.property
      ? `${declaration.property}:${declaration.value}${declaration.important ? '!important' : ''};`
      : declaration.value
    const rule = `${selector}{${body}}`
    if (!declaration.scope) {
      return rule
    }
    const roots = declaration.scope.root.map(item => compileSelector(item, declaration.artifactScopeId)).join(',')
    const limit = declaration.scope.limit?.map(item => compileSelector(item, declaration.artifactScopeId)).join(',')
    return `@scope (${roots})${limit ? ` to (${limit})` : ''}{${rule}}`
  }).join('\n')

  return { css, classes: [], diagnostics }
}

function compileSelector(selector: EndgeStyleSelector, scopeId?: string): string {
  if (selector.segments.length === 0) {
    return selector.source
  }
  return selector.segments.map((segment, index) => {
    const combinator = index === 0
      ? ''
      : segment.combinator === 'child'
        ? ' > '
        : segment.combinator === 'adjacent'
          ? ' + '
          : segment.combinator === 'sibling'
            ? ' ~ '
            : ' '
    const isTarget = index === selector.segments.length - 1
    return `${combinator}${compileCompound(segment.compound, isTarget ? scopeId : undefined)}`
  }).join('')
}

function compileCompound(
  compound: EndgeStyleSelector['segments'][number]['compound'],
  scopeId?: string,
): string {
  const parts: string[] = []
  if (compound.tag) {
    parts.push(`[data-endge-tag=${cssString(compound.tag)}]`)
  }
  for (const id of compound.ids) {
    parts.push(`[data-endge-id=${cssString(id)}]`)
  }
  for (const className of compound.classes) {
    parts.push(`.${escapeIdentifier(className)}`)
  }
  for (const attribute of compound.attributes) {
    parts.push(compileAttribute(attribute))
  }
  for (const pseudo of compound.pseudos) {
    if (pseudo.name === 'first-child' || pseudo.name === 'last-child') {
      parts.push(`:${pseudo.name}`)
    }
    else if (pseudo.name === 'nth-child') {
      parts.push(`:nth-child(${pseudo.expression})`)
    }
    else if (pseudo.name === 'component') {
      parts.push(`[data-endge-component=${cssString(pseudo.value)}]`)
    }
    else if (pseudo.name === 'identity') {
      parts.push(`[data-endge-identity=${cssString(pseudo.value)}]`)
    }
    else if (pseudo.name === 'state') {
      parts.push(`[data-endge-state~=${cssString(pseudo.value)}]`)
    }
    else if (pseudo.name === 'part') {
      parts.push(`[data-endge-part~=${cssString(pseudo.value)}]`)
    }
    else if ('selectors' in pseudo) {
      parts.push(`:${pseudo.name}(${pseudo.selectors.map(item => compileSelector(item, scopeId)).join(',')})`)
    }
  }
  if (scopeId) {
    parts.push(`[data-endge-scope=${cssString(scopeId)}]`)
  }
  return parts.join('') || '*'
}

function compileAttribute(attribute: EndgeStyleAttributeSelector): string {
  const name = escapeIdentifier(attribute.name)
  if (attribute.operator === 'exists') {
    return `[${name}]`
  }
  return `[${name}${attribute.operator}${cssString(attribute.value ?? '')}${attribute.insensitive ? ' i' : ''}]`
}

function uniformSpecificitySelector(selector: string): string {
  return `:where(${selector}):is([data-endge-node],[data-endge-part])`
}

function applyBoundary(selector: string, boundaryId: string): string {
  const marker = `[data-endge-runtime-scope~=${cssString(boundaryId)}]`
  if (selector === ':root') {
    return marker
  }
  return `${marker}${selector},${marker} ${selector}`
}

function escapeIdentifier(value: string): string {
  return value.replace(/(^-?\d)|[^\w-]/g, match => `\\${match.codePointAt(0)!.toString(16)} `)
}

function isPlacement(input: EndgeDOMStyleInput): input is EndgeStylePlacement {
  return 'artifact' in input && 'boundaryId' in input
}
