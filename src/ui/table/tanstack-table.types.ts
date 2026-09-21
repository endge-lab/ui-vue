import type {
  ComponentSFCEventBoundary,
  ComponentSFCTableColumnMenuDescriptor,
  ComponentSFCTableColumnPinMode,
  ComponentSFCTableColumnPinStateItem,
  ComponentSFCTableRowMenuDescriptor,
  ComponentSFCTableSortComparator,
  ComponentSFCTableSortMode,
  ComponentSFCTableSortStateItem,
  RComponentSFC_IR_ElementNode,
  RComponentSFC_IR_EventBinding,
  RComponentSFC_IR_Node,
  TableCellSelectionMode,
  TableSelectionMode,
  TableSelectionTrigger,
} from '@endge/core'
import type {
  SFCVueRenderContext,
  SFCVueRenderResult,
  SFCVueRuntimeStateController,
} from '@/services/render/sfc/sfc-vue-render.type'
import type { SFCTableCellAlignment } from '@/ui/render/sfc/SFCRender_TableAlignment'
import type { SFCTableColumnStyleSurfaces, SFCTableStyleContract } from '@/ui/render/sfc/SFCRender_TableStyle'

export interface EndgeTanStackTableColumnSort {
  sortable: boolean
  comparator: ComponentSFCTableSortComparator
  paths: string[]
}

export interface EndgeTanStackTableColumn {
  index: number
  key: string
  title: string
  width: number | null
  minWidth: number
  maxWidth: number
  pinnable: boolean
  alignment: SFCTableCellAlignment
  metadata?: Readonly<Record<string, unknown>>
  cellMenu?: ComponentSFCTableRowMenuDescriptor
  sort: EndgeTanStackTableColumnSort | null
  cellNode: RComponentSFC_IR_ElementNode | null
  cellNodes: RComponentSFC_IR_Node[]
  styleSurfaces: SFCTableColumnStyleSurfaces
}

export type EndgeTanStackTablePaging = 'pages' | 'virtual'

export interface EndgeTanStackTableProps {
  boundaryId: string
  nodeId?: string
  tableRef?: string | null
  tableId: string
  eventBoundary?: ComponentSFCEventBoundary | null
  eventBindings?: RComponentSFC_IR_EventBinding[]
  selectionMode?: TableSelectionMode
  selectionTrigger?: TableSelectionTrigger
  cellSelectionMode?: TableCellSelectionMode
  runtimeState: SFCVueRuntimeStateController | null
  columns: EndgeTanStackTableColumn[]
  source: Record<string, unknown>[]
  styleContract: SFCTableStyleContract
  rowKey: string
  sortMode: ComponentSFCTableSortMode
  pinMode: ComponentSFCTableColumnPinMode
  columnMenu: ComponentSFCTableColumnMenuDescriptor
  rowMenu?: ComponentSFCTableRowMenuDescriptor
  menuContext?: SFCVueRenderContext
  defaultSort: ComponentSFCTableSortStateItem[]
  defaultPin: ComponentSFCTableColumnPinStateItem[]
  defaultHidden: string[]
  rowSize: number
  paging?: EndgeTanStackTablePaging
  pageSize?: number
  pageSizes?: number[]
  lazy?: boolean
  renderVersion: number
  renderCell: (
    column: EndgeTanStackTableColumn,
    row: Record<string, unknown>,
    rowIndex: number,
    rowId: string,
  ) => SFCVueRenderResult
}
