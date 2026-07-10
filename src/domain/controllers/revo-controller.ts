export type Row = unknown // подставьте DRequestResult
export type Entity = {
  key: string
  index: number
  doExtract: (row: Row) => { unwrap(): [any] }
  componentRule?: { newDataClass?: (v: any) => any }
  typeRule?: { newDataClass?: (v: any) => any }
}
export type MultiFilterItem = Record<
  string,
  Array<{
    id: number
    type: string | number
    value: any
    relation?: 'and' | 'or'
  }>
>

export interface IStorageMap {
  has(key: string): boolean
  get<T = any>(key: string): T | undefined
  set<T = any>(key: string, value: T): void
  entries(): IterableIterator<[string, any]>
}

export interface IRevoApi {
  clearFiltering(): Promise<void>
  onFilterChange(multi: MultiFilterItem): Promise<void>
  /** Доступ к внутренним multiFilterItems RevoGrid (UI-значения) */
  getMultiFilterItems(): MultiFilterItem
}

export interface IRevoBridge {
  /** Возвращает API плагинов для активной таблицы */
  getApi(): Promise<IRevoApi | null>
}

export interface IFiltersService {
  /** Возвращает список фильтров для сборки customFilters */
  filters(): Array<{
    type: string | number
    tName: string
    fn?: string
    extra?: unknown
  }>
}

export interface RevoGridCoreOptions {
  id: string
  viewId: string
  entities: Entity[]
  localFiltersEnabled: boolean
  pinnedSet: Set<string>
  filtersService: IFiltersService
  revo: IRevoBridge
  storage: IStorageMap // views-columns-settings
  columnId: (colIndex: number | string) => string
  applyGlobalFilters: (rows: Row[], data: object) => Row[]
  getGlobalFilterData: () => object // settings.value.localFilterData
  cellSort: (header: Entity, rule: any, a: Row, b: Row) => number
}

export type RevoGridControllerSelectedItem = {
  model?: Row | null
  col?: string | null
  row: string | null
  lastTime?: number
}

export class RevoGrid_Controller {
  //
  //
  private opts: RevoGridCoreOptions
  private loaded = false
  /** UI-состояние фильтров (MultiFilterItem) */
  filterMulti: MultiFilterItem = {}
  /** Текущее выделение (данные, без DOM) */
  selected: RevoGridControllerSelectedItem = { model: null, col: null, row: null, lastTime: 0 }
  /** Мультивыделение (данные, без DOM) */
  multiSelected: RevoGridControllerSelectedItem[] = []

  constructor(opts: RevoGridCoreOptions) {
    this.opts = opts
  }

  /** Сборка customFilters-конфига для UI (имен/локализации) - данные отдайте во Vue-слой */
  buildCustomFilters() {
    const { filtersService } = this.opts
    const defs = filtersService.filters().map((f, i) => ({
      key: String(i),
      columnFilterType: f.type,
      name: 'CHECK IT',
      fnName: f.fn,
      extra: f.extra,
    }))
    return defs
  }

  /** Восстановить UI-фильтры в RevoGrid из локального storage */
  async restoreFiltersUI(): Promise<void> {
    if (!this.loaded) return
    const api = await this.opts.revo.getApi()
    if (!api) return

    const settings = this.getColumnsSettings()
    const multi: MultiFilterItem = {}

    for (const [, config] of Object.entries(settings) as Array<
      [string, { _index?: number | string; filter?: any[] }]
    >) {
      const entity = this.opts.entities[Number(config?._index)]
      if (config?.filter && Array.isArray(config.filter) && entity) {
        multi[entity.key] = config.filter.map((item, idx) => ({
          id: idx,
          type: item.type,
          value: item.value,
          relation: item.relation || 'and',
        }))
      }
    }
    await api.onFilterChange(multi)
  }

  /** Синхронизировать фактические UI-фильтры из RevoGrid в локальное состояние Core */
  async restoreFiltersData(): Promise<void> {
    const api = await this.opts.revo.getApi()
    if (!api) return
    const next = api.getMultiFilterItems()
    const same = JSON.stringify(this.filterMulti) === JSON.stringify(next)
    if (!same) this.filterMulti = structuredClone(next)
  }

  /** Сброс всех фильтров: и в RevoGrid, и локально, и в storage */
  async resetAllFilters(): Promise<void> {
    const api = await this.opts.revo.getApi()
    if (!api) return
    await api.clearFiltering()
    this.filterMulti = {}
    this.resetColumnSettingField('filter')
  }

  /** Отфильтровать список строк (вторая ступень после глобальных фильтров) */
  filterRows(rows: Row[]): Row[] {
    const global = this.opts.applyGlobalFilters(
      rows,
      this.opts.localFiltersEnabled ? this.opts.getGlobalFilterData() : {},
    )
    const filters = this.filterMulti
    if (!Object.keys(filters).length) return global

    const entityByKey = new Map(this.opts.entities.map((e) => [e.key, e]))
    return global.filter((row) => {
      return Object.entries(filters).every(([columnKey, conditions]) => {
        const entity = entityByKey.get(columnKey)
        if (!entity) return true // невалидный фильтр - пропускаем

        const [rawValue] = entity.doExtract(row).unwrap()
        const instance =
          entity.componentRule?.newDataClass?.(rawValue) ??
          entity.typeRule?.newDataClass?.(rawValue)

        // логические группы
        let andPassed = true
        let orPassed = false

        for (const cond of conditions) {
          const passed = this.applyFilterFunction(
            instance,
            entity,
            cond.type,
            cond.value,
          )
          if (cond.relation === 'or') orPassed = orPassed || passed
          else andPassed = andPassed && passed
        }
        return andPassed || orPassed
      })
    })
  }

  /** Хук для сопоставления cond.type - instance[fn](val) по вашим фильтрам */
  private applyFilterFunction(
    instance: any,
    entity: Entity,
    typeKey: string | number,
    value: any,
  ): boolean {
    // Совет: маппинг typeKey - fnName соберите переданным конфигом (buildCustomFilters()) во Vue-слое,
    // здесь можно держать precomputed Map, проброшенную в opts.
    const fnName =
      instance && typeof typeKey !== 'undefined'
        ? this.resolveFnName(typeKey)
        : undefined
    if (!fnName || typeof instance?.[fnName] !== 'function') return true
    try {
      return !!instance[fnName](value, entity)
    } catch {
      return true
    }
  }

  /** Подмените на real-mapping из Vue-слоя */
  private resolveFnName(_typeKey: string | number): string | undefined {
    return undefined
  }

  /** Управление selection (данные). DOM-подсветка делает Vue-слой */
  selectSingle(cellId: { col: string; row: string }): void {
    const now = Date.now()
    this.selected = {
      ...this.selected,
      col: cellId.col,
      row: cellId.row,
      lastTime: now,
    }
    this.multiSelected.length = 0
  }

  toggleMulti(rowId: string): void {
    const idx = this.multiSelected.findIndex((x) => x.row === rowId)
    if (idx >= 0) this.multiSelected.splice(idx, 1)
    else this.multiSelected.push({ row: rowId } as RevoGridControllerSelectedItem)
  }

  resetSelection(): void {
    this.selected = { model: null, col: null, row: null, lastTime: 0 }
    this.multiSelected.length = 0
  }

  /** Persist: чтение/запись колонных настроек */
  getColumnsSettings(): Record<string, object> {
    const res: Record<string, object> = {}
    for (const [key, value] of this.opts.storage.entries()) {
      if (key.startsWith(`${this.opts.viewId}-`)) res[key] = value
    }
    return res
  }

  updateColumnSettings(colIndex: number, data: object): void {
    const key = this.opts.columnId(colIndex)
    const exists = this.opts.storage.get<object>(key) || {}
    this.opts.storage.set(key, {
      ...exists,
      ...data,
      _updated: Date.now(),
      _index: colIndex,
    })
  }

  resetColumnSettingField(fieldKey: string): void {
    for (const [key, value] of this.opts.storage.entries()) {
      if (key.startsWith(`${this.opts.viewId}-`)) {
        this.opts.storage.set(key, { ...value, [fieldKey]: undefined })
      }
    }
  }

  markLoaded(): void {
    this.loaded = true
  }
  markUnloaded(): void {
    this.loaded = false
  }
}
