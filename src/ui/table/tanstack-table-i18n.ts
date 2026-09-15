const TABLE_MESSAGES = {
  en: {
    'table.column.hide': 'Hide column',
    'table.column.pinLeft': 'Pin left',
    'table.column.pinRight': 'Pin right',
    'table.column.unpin': 'Unpin',
    'table.sort.setColumnAsc': 'Sort ascending',
    'table.sort.setColumnDesc': 'Sort descending',
    'table.sort.clearColumn': 'Clear column sort',
    'table.search.placeholder': 'Search…',
    'table.search.ariaLabel': 'Search table',
    'table.filters.show': 'Show filters',
    'table.filters.hide': 'Hide filters',
    'table.summary.rows': 'rows',
    'table.selection.visibleRows': 'Select visible rows',
    'table.selection.row': 'Select row',
    'table.empty': 'No data',
    'table.pagination.ariaLabel': 'Table pagination',
    'table.pagination.rowsPerPage': 'Rows per page',
    'table.pagination.pageOf': 'Page {current} of {total}',
    'table.pagination.firstPage': 'First page',
    'table.pagination.previousPage': 'Previous page',
    'table.pagination.nextPage': 'Next page',
    'table.pagination.lastPage': 'Last page',
    'table.columns.trigger': 'Columns',
    'table.columns.dialog': 'Configure columns',
    'table.columns.visibility': 'Visibility',
    'table.columns.order': 'Order',
    'table.columns.move': 'Move {title}',
  },
  ru: {
    'table.column.hide': 'Скрыть колонку',
    'table.column.pinLeft': 'Закрепить слева',
    'table.column.pinRight': 'Закрепить справа',
    'table.column.unpin': 'Открепить',
    'table.sort.setColumnAsc': 'Сортировать по возрастанию',
    'table.sort.setColumnDesc': 'Сортировать по убыванию',
    'table.sort.clearColumn': 'Сбросить сортировку колонки',
    'table.search.placeholder': 'Поиск…',
    'table.search.ariaLabel': 'Поиск по таблице',
    'table.filters.show': 'Показать фильтры',
    'table.filters.hide': 'Скрыть фильтры',
    'table.summary.rows': 'строк',
    'table.selection.visibleRows': 'Выбрать отображаемые строки',
    'table.selection.row': 'Выбрать строку',
    'table.empty': 'Нет данных',
    'table.pagination.ariaLabel': 'Пагинация таблицы',
    'table.pagination.rowsPerPage': 'Строк на странице',
    'table.pagination.pageOf': 'Страница {current} из {total}',
    'table.pagination.firstPage': 'Первая страница',
    'table.pagination.previousPage': 'Предыдущая страница',
    'table.pagination.nextPage': 'Следующая страница',
    'table.pagination.lastPage': 'Последняя страница',
    'table.columns.trigger': 'Колонки',
    'table.columns.dialog': 'Настройка колонок',
    'table.columns.visibility': 'Видимость',
    'table.columns.order': 'Порядок',
    'table.columns.move': 'Переместить {title}',
  },
} as const

type TableLocale = keyof typeof TABLE_MESSAGES
export type TanStackTableMessageKey = keyof typeof TABLE_MESSAGES.en
const typedTableMessages: Record<TableLocale, Record<TanStackTableMessageKey, string>> = TABLE_MESSAGES

export function resolveTanStackTableFallback(
  key: TanStackTableMessageKey,
  locale: string,
  fallback: string,
  params?: Record<string, unknown>,
): string {
  const language = String(locale ?? '').trim().toLowerCase().split(/[-_]/)[0]
  const catalog = typedTableMessages[(language === 'ru' ? 'ru' : 'en') satisfies TableLocale]
  const text = catalog[key] ?? fallback

  if (!params) {
    return text
  }

  return text.replace(/\{([^{}]+)\}/g, (match, paramKey: string) => {
    const value = params[paramKey]
    return value == null ? match : String(value)
  })
}
