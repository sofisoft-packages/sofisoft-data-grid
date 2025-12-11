import "@glideapps/glide-data-grid/dist/index.css";
import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import DataEditor, {
  type GridCell,
  GridCellKind,
  type GridColumn,
  type Item,
  type EditableGridCell,
  type GridSelection,
  CompactSelection,
  type DataEditorRef,
  type CellClickedEventArgs,
  type Rectangle,
  type Theme,
  type CustomCell,
  type CustomRenderer,
} from "@glideapps/glide-data-grid";

import { allCells } from "@glideapps/glide-data-grid-cells";
import "@glideapps/glide-data-grid-cells/dist/index.css";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================
const ROW_MARKER_WIDTH = 33;

export interface BaseRowData {
  id?: number;
  _children?: BaseRowData[];
  _isExpanded?: boolean;
}

export interface DataGridColumn<T extends BaseRowData> {
  field: Extract<keyof T, string>;
  headerName: string;
  editable?: boolean;
  width?: number;
  flex?: number;
  filter?: string;
  pinned?: "left" | "right";
  hidden?: boolean;
  group?: string;
  aggregate?: "sum" | "count" | "avg" | "min" | "max" | "none";
  // Updated calculated column support
  calculated?: {
    compute: (row: T) => string | number;
    reverse?: (row: T, newValue: number | string) => Partial<T>; // Returns fields to update
  };
  cellType?: "text" | "dropdown" | "action";
  // NEW: Dropdown options
  options?: string[];
  actions?: {
    label: string;
    icon?: "view" | "edit" | "delete" | "copy" | "download" | "settings" | "add" | "check" | "close" | "custom";
    customIcon?: (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      size: number,
      color: string
    ) => void;
    onClick: (row: T) => void;
    variant?: "default" | "primary" | "danger" | "success" | "warning";
    hidden?: (row: T) => boolean;
    tooltip?: string;
  }[];
}

export interface ValidationError<T extends BaseRowData> {
  field: Extract<keyof T, string>;
  message: string;
}

// Ref API - Expose actions for custom toolbars
export interface DataGridRef<T extends BaseRowData> {
  undo: () => void;
  redo: () => void;
  addRow: () => void;
  deleteSelected: () => void;
  save: () => Promise<void>;
  openSearch: () => void;
  closeSearch: () => void;
  exportCSV: (filename?: string) => void;
  openColumnVisibility: () => void;
  clearFilters: () => void;
  getData: () => T[];
  getSelectedRows: () => T[];
  selectAll: () => void;
  clearSelection: () => void;
  // State getters
  canUndo: boolean;
  canRedo: boolean;
  hasChanges: boolean;
  selectedCount: number;
  rowCount: number;
  filterCount: number;
}

export interface DataGridProps<T extends BaseRowData> {
  data: T[];
  columns: DataGridColumn<T>[];
  onSave: (data: T[]) => Promise<void>;
  validate: (row: T) => ValidationError<T> | null;
  createEmptyRow: () => Omit<T, "id">;
  toolbar?: "floating" | "top" | "bottom" | "none";
  enableHistory?: boolean;
  enableKeyboardShortcuts?: boolean;
  maxHistorySize?: number;
  batchSize?: number;
  enableColumnReorder?: boolean;
  enableColumnPinning?: boolean;
  enableSearch?: boolean;
  enableExport?: boolean;
  enableTreeData?: boolean;
  showStatusBar?: boolean;
  theme?: Partial<Theme>;
  height?: string | number;
  className?: string;
  onChange?: (data: T[]) => void;
  onSelectionChange?: (selectedRows: T[]) => void;
  themeMode?: "dark" | "light";
  footerLeftContent?: (stats: {
    total: number;
    filtered: number;
    selected: number;
  }) => React.ReactNode;
  colors?: {
    headerBg?: string;
    headerText?: string;
    cellBg?: string;
    cellText?: string;
    accentColor?: string;
    borderColor?: string;
  };
  emptyMessage?: React.ReactNode;
  pagination?: boolean;
  pageSize?: number;
  pageSizeOptions?: number[];
}

interface HistoryState<T> {
  data: T[];
  timestamp: number;
}

interface ColumnFilter {
  type: "text" | "number";
  condition:
    | "contains"
    | "equals"
    | "startsWith"
    | "endsWith"
    | "greaterThan"
    | "lessThan"
    | "between";
  value: string | number;
  value2?: string | number;
}

interface ColumnMenu {
  col: number;
  bounds: Rectangle;
}

interface SearchState {
  query: string;
  currentIndex: number;
  results: Item[];
}

// ============================================================================
// ICONS (SVG Components)
// ============================================================================

export const Icons = {
  Undo: () => (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M3 7v6h6M3 13c0-4.97 4.03-9 9-9s9 4.03 9 9-4.03 9-9 9c-2.12 0-4.07-.74-5.61-1.97" />
    </svg>
  ),
  Redo: () => (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M21 7v6h-6M21 13c0-4.97-4.03-9-9-9s-9 4.03-9 9 4.03 9 9 9c2.12 0 4.07-.74 5.61-1.97" />
    </svg>
  ),
  Plus: () => (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  Search: () => (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  ),
  Columns: () => (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="3" y="3" width="7" height="18" rx="1" />
      <rect x="14" y="3" width="7" height="18" rx="1" />
    </svg>
  ),
  Download: () => (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
  ),
  Save: () => (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
      <polyline points="17,21 17,13 7,13 7,21" />
      <polyline points="7,3 7,8 15,8" />
    </svg>
  ),
  Trash: () => (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <polyline points="3,6 5,6 21,6" />
      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
  ),
  Filter: () => (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46" />
    </svg>
  ),
  X: () => (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  ),
  ChevronUp: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <polyline points="18,15 12,9 6,15" />
    </svg>
  ),
  ChevronDown: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <polyline points="6,9 12,15 18,9" />
    </svg>
  ),
  Menu: () => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  ),
  Check: () => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <polyline points="20,6 9,17 4,12" />
    </svg>
  ),
};

// ============================================================================
// ACTION CELL RENDERER
// ============================================================================

// ============================================================================
// ACTION CELL RENDERER
// ============================================================================

// ============================================================================
// ACTION CELL RENDERER
// ============================================================================

interface ActionCellData {
  kind: "action-cell";
  rowId: number | undefined;
  rowIndex: number;
  actions: {
    label: string;
    icon?: "view" | "edit" | "delete" | "copy" | "download" | "settings" | "add" | "check" | "close" | "custom";
    customIcon?: (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) => void;
    onClick: (row: any) => void;
    variant?: "default" | "primary" | "danger" | "success" | "warning";
    hidden?: (row: any) => boolean;
    tooltip?: string;
  }[];
  row: any;
}

// Clean SVG-style icon drawing functions
const drawIcons = {
  view: (ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.8;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    
    const scale = size / 24;
    const x = cx - size / 2;
    const y = cy - size / 2;
    
    // Eye shape
    ctx.beginPath();
    ctx.moveTo(x + 2 * scale, y + 12 * scale);
    ctx.bezierCurveTo(
      x + 5 * scale, y + 5 * scale,
      x + 19 * scale, y + 5 * scale,
      x + 22 * scale, y + 12 * scale
    );
    ctx.bezierCurveTo(
      x + 19 * scale, y + 19 * scale,
      x + 5 * scale, y + 19 * scale,
      x + 2 * scale, y + 12 * scale
    );
    ctx.closePath();
    ctx.stroke();
    
    // Pupil
    ctx.beginPath();
    ctx.arc(x + 12 * scale, y + 12 * scale, 3.5 * scale, 0, Math.PI * 2);
    ctx.fill();
  },

  edit: (ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    
    const scale = size / 24;
    const x = cx - size / 2;
    const y = cy - size / 2;
    
    // Pencil body
    ctx.beginPath();
    ctx.moveTo(x + 17 * scale, y + 3 * scale);
    ctx.lineTo(x + 21 * scale, y + 7 * scale);
    ctx.lineTo(x + 8 * scale, y + 20 * scale);
    ctx.lineTo(x + 3 * scale, y + 21 * scale);
    ctx.lineTo(x + 4 * scale, y + 16 * scale);
    ctx.closePath();
    ctx.stroke();
    
    // Edit line
    ctx.beginPath();
    ctx.moveTo(x + 15 * scale, y + 5 * scale);
    ctx.lineTo(x + 19 * scale, y + 9 * scale);
    ctx.stroke();
  },

  delete: (ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    
    const scale = size / 24;
    const x = cx - size / 2;
    const y = cy - size / 2;
    
    // Lid
    ctx.beginPath();
    ctx.moveTo(x + 4 * scale, y + 7 * scale);
    ctx.lineTo(x + 20 * scale, y + 7 * scale);
    ctx.stroke();
    
    // Handle
    ctx.beginPath();
    ctx.moveTo(x + 9 * scale, y + 7 * scale);
    ctx.lineTo(x + 9 * scale, y + 4 * scale);
    ctx.lineTo(x + 15 * scale, y + 4 * scale);
    ctx.lineTo(x + 15 * scale, y + 7 * scale);
    ctx.stroke();
    
    // Bin body
    ctx.beginPath();
    ctx.moveTo(x + 5 * scale, y + 7 * scale);
    ctx.lineTo(x + 6 * scale, y + 20 * scale);
    ctx.lineTo(x + 18 * scale, y + 20 * scale);
    ctx.lineTo(x + 19 * scale, y + 7 * scale);
    ctx.stroke();
    
    // Lines inside
    ctx.beginPath();
    ctx.moveTo(x + 10 * scale, y + 11 * scale);
    ctx.lineTo(x + 10 * scale, y + 16 * scale);
    ctx.moveTo(x + 14 * scale, y + 11 * scale);
    ctx.lineTo(x + 14 * scale, y + 16 * scale);
    ctx.stroke();
  },

  copy: (ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    
    const scale = size / 24;
    const x = cx - size / 2;
    const y = cy - size / 2;
    
    // Back rectangle
    ctx.beginPath();
    ctx.roundRect(x + 8 * scale, y + 3 * scale, 12 * scale, 14 * scale, 2 * scale);
    ctx.stroke();
    
    // Front rectangle
    ctx.beginPath();
    ctx.roundRect(x + 4 * scale, y + 7 * scale, 12 * scale, 14 * scale, 2 * scale);
    ctx.fillStyle = ctx.strokeStyle.toString().replace(')', ', 0.1)').replace('rgb', 'rgba');
    ctx.fill();
    ctx.stroke();
  },

  download: (ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    
    const scale = size / 24;
    const x = cx - size / 2;
    const y = cy - size / 2;
    
    // Arrow down
    ctx.beginPath();
    ctx.moveTo(x + 12 * scale, y + 4 * scale);
    ctx.lineTo(x + 12 * scale, y + 14 * scale);
    ctx.moveTo(x + 7 * scale, y + 10 * scale);
    ctx.lineTo(x + 12 * scale, y + 15 * scale);
    ctx.lineTo(x + 17 * scale, y + 10 * scale);
    ctx.stroke();
    
    // Base
    ctx.beginPath();
    ctx.moveTo(x + 5 * scale, y + 18 * scale);
    ctx.lineTo(x + 5 * scale, y + 20 * scale);
    ctx.lineTo(x + 19 * scale, y + 20 * scale);
    ctx.lineTo(x + 19 * scale, y + 18 * scale);
    ctx.stroke();
  },

  settings: (ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    
    const scale = size / 24;
    
    // Outer gear
    ctx.beginPath();
    ctx.arc(cx, cy, 8 * scale, 0, Math.PI * 2);
    ctx.stroke();
    
    // Inner circle
    ctx.beginPath();
    ctx.arc(cx, cy, 3 * scale, 0, Math.PI * 2);
    ctx.stroke();
    
    // Gear teeth (6 lines)
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * 8 * scale, cy + Math.sin(angle) * 8 * scale);
      ctx.lineTo(cx + Math.cos(angle) * 11 * scale, cy + Math.sin(angle) * 11 * scale);
      ctx.stroke();
    }
  },

  add: (ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    
    const scale = size / 24;
    
    ctx.beginPath();
    ctx.moveTo(cx, cy - 7 * scale);
    ctx.lineTo(cx, cy + 7 * scale);
    ctx.moveTo(cx - 7 * scale, cy);
    ctx.lineTo(cx + 7 * scale, cy);
    ctx.stroke();
  },

  check: (ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    
    const scale = size / 24;
    const x = cx - size / 2;
    const y = cy - size / 2;
    
    ctx.beginPath();
    ctx.moveTo(x + 5 * scale, y + 12 * scale);
    ctx.lineTo(x + 10 * scale, y + 17 * scale);
    ctx.lineTo(x + 19 * scale, y + 7 * scale);
    ctx.stroke();
  },

  close: (ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    
    const scale = size / 24;
    
    ctx.beginPath();
    ctx.moveTo(cx - 6 * scale, cy - 6 * scale);
    ctx.lineTo(cx + 6 * scale, cy + 6 * scale);
    ctx.moveTo(cx + 6 * scale, cy - 6 * scale);
    ctx.lineTo(cx - 6 * scale, cy + 6 * scale);
    ctx.stroke();
  },
};

const getVariantColor = (variant: string | undefined, theme: Theme, isHovered: boolean): string => {
  const colors: Record<string, { normal: string; hover: string }> = {
    primary: { normal: "#3b82f6", hover: "#2563eb" },
    danger: { normal: "#ef4444", hover: "#dc2626" },
    success: { normal: "#22c55e", hover: "#16a34a" },
    warning: { normal: "#f59e0b", hover: "#d97706" },
    default: { normal: theme.textMedium, hover: theme.textDark },
  };
  const colorSet = colors[variant || "default"] || colors.default;
  return isHovered ? colorSet.hover : colorSet.normal;
};

const ActionRenderer: CustomRenderer<CustomCell<ActionCellData>> = {
  kind: GridCellKind.Custom,
  isMatch: (cell: CustomCell): cell is CustomCell<ActionCellData> =>
    (cell.data as { kind?: string })?.kind === "action-cell",

  draw: (args, cell) => {
    const { ctx, rect, theme, hoverX, hoverY } = args;
    const { actions, row } = cell.data;

    // Draw background
    ctx.fillStyle = theme.bgCell;
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

    // Filter visible actions
    const visibleActions = actions.filter((a) => !a.hidden?.(row));
    if (visibleActions.length === 0) return true;

    const iconSize = 18;
    const hitAreaSize = 32;
    const totalWidth = visibleActions.length * hitAreaSize;
    let startX = rect.x + (rect.width - totalWidth) / 2;
    const centerY = rect.y + rect.height / 2;

    visibleActions.forEach((action, _index) => {
      const iconCenterX = startX + hitAreaSize / 2;
      const iconCenterY = centerY;
      
      // Check if this icon is hovered
      const isHovered = hoverX !== undefined && hoverY !== undefined &&
        hoverX >= startX && 
        hoverX < startX + hitAreaSize &&
        hoverY >= rect.y &&
        hoverY < rect.y + rect.height;

      // Draw hover background (circular)
      if (isHovered) {
        ctx.fillStyle = "rgba(128, 128, 128, 0.15)";
        ctx.beginPath();
        ctx.arc(iconCenterX, iconCenterY, hitAreaSize / 2 - 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Get color based on variant and hover state
      const color = getVariantColor(action.variant, theme, isHovered);

      // Draw the icon
      const iconType = action.icon || "view";
      if (iconType === "custom" && action.customIcon) {
        action.customIcon(ctx, iconCenterX, iconCenterY, iconSize, color);
      } else if (drawIcons[iconType as keyof typeof drawIcons]) {
        drawIcons[iconType as keyof typeof drawIcons](ctx, iconCenterX, iconCenterY, iconSize, color);
      } else {
        drawIcons.view(ctx, iconCenterX, iconCenterY, iconSize, color);
      }

      startX += hitAreaSize;
    });

    return true;
  },

  provideEditor: () => undefined,

  onClick: (args) => {
    const { cell, bounds, posX } = args;
    const { actions, row } = (cell as CustomCell<ActionCellData>).data;

    const visibleActions = actions.filter((a) => !a.hidden?.(row));
    if (visibleActions.length === 0) return undefined;

    const hitAreaSize = 32;
    const totalWidth = visibleActions.length * hitAreaSize;
    const startX = (bounds.width - totalWidth) / 2;

    const relativeX = posX - startX;
    const iconIndex = Math.floor(relativeX / hitAreaSize);

    if (iconIndex >= 0 && iconIndex < visibleActions.length) {
      visibleActions[iconIndex].onClick(row);
    }

    return undefined;
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function exportToCSV<T extends BaseRowData>(
  data: T[],
  columns: DataGridColumn<T>[],
  filename: string = "export.csv"
) {
  const visibleColumns = columns.filter((col) => !col.hidden);
  const header = visibleColumns.map((col) => `"${col.headerName}"`).join(",");
  const rows = data.map((row) => {
    return visibleColumns
      .map((col) => {
        const value = row[col.field];
        const stringValue =
          value !== null && value !== undefined ? String(value) : "";
        return `"${stringValue.replace(/"/g, '""')}"`;
      })
      .join(",");
  });
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function flattenTreeData<T extends BaseRowData>(
  data: T[],
  level: number = 0
): (T & { _level: number })[] {
  const result: (T & { _level: number })[] = [];
  for (const item of data) {
    result.push({ ...item, _level: level });
    if (item._children && item._children.length > 0 && item._isExpanded) {
      result.push(...flattenTreeData(item._children as T[], level + 1));
    }
  }
  return result;
}
function calculateAggregation<T extends BaseRowData>(
  data: T[],
  column: DataGridColumn<T>
): string {
  if (!column.aggregate || column.aggregate === "none") return "";

  const values = data
    .map((row) => {
      if (column.calculated) return column.calculated.compute(row);
      return row[column.field];
    })
    .filter((v) => v !== null && v !== undefined);

  const numericValues = values
    .map((v) => parseFloat(String(v)))
    .filter((n) => !isNaN(n));

  switch (column.aggregate) {
    case "count":
      return `Count: ${values.length}`;
    case "sum":
      return `Sum: ${numericValues
        .reduce((a, b) => a + b, 0)
        .toLocaleString()}`;
    case "avg":
      return `Avg: ${
        numericValues.length
          ? (
              numericValues.reduce((a, b) => a + b, 0) / numericValues.length
            ).toFixed(2)
          : 0
      }`;
    case "min":
      return `Min: ${
        numericValues.length ? Math.min(...numericValues).toLocaleString() : "-"
      }`;
    case "max":
      return `Max: ${
        numericValues.length ? Math.max(...numericValues).toLocaleString() : "-"
      }`;
    default:
      return "";
  }
}

// ============================================================================
// FLOATING ACTION BUTTON MENU
// ============================================================================

interface FABMenuProps {
  actions: {
    id: string;
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    disabled?: boolean;
    variant?: "default" | "primary" | "danger";
    badge?: string | number;
  }[];
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
}

function FABMenu({ actions, position = "bottom-right" }: FABMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const positionClasses = {
    "bottom-right": "gdg-fab-bottom-right",
    "bottom-left": "gdg-fab-bottom-left",
    "top-right": "gdg-fab-top-right",
    "top-left": "gdg-fab-top-left",
  };

  return (
    <div
      ref={menuRef}
      className={`gdg-fab-container ${positionClasses[position]}`}
    >
      {isOpen && (
        <div className="gdg-fab-menu">
          {actions.map((action) => (
            <button
              key={action.id}
              className={`gdg-fab-item ${action.variant || "default"} ${
                action.disabled ? "disabled" : ""
              }`}
              onClick={() => {
                if (!action.disabled) {
                  action.onClick();
                  if (action.id !== "save") setIsOpen(false);
                }
              }}
              disabled={action.disabled}
              title={action.label}
            >
              {action.icon}
              <span className="gdg-fab-label">{action.label}</span>
              {action.badge && (
                <span className="gdg-fab-badge">{action.badge}</span>
              )}
            </button>
          ))}
        </div>
      )}
      <button
        className={`gdg-fab-trigger ${isOpen ? "open" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle menu"
      >
        {isOpen ? <Icons.X /> : <Icons.Menu />}
      </button>
    </div>
  );
}

// ============================================================================
// SEARCH BAR COMPONENT (Floating)
// ============================================================================

interface SearchBarProps {
  searchState: SearchState;
  onSearchChange: (query: string) => void;
  onNavigate: (direction: "next" | "prev") => void;
  onClose: () => void;
}

function SearchBar({
  searchState,
  onSearchChange,
  onNavigate,
  onClose,
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="gdg-search-floating">
      <Icons.Search />
      <input
        ref={inputRef}
        type="text"
        value={searchState.query}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search..."
        className="gdg-search-input"
        onKeyDown={(e) => {
          if (e.key === "Enter") onNavigate(e.shiftKey ? "prev" : "next");
          if (e.key === "Escape") onClose();
        }}
      />
      {searchState.results.length > 0 && (
        <span className="gdg-search-count">
          {searchState.currentIndex + 1}/{searchState.results.length}
        </span>
      )}
      <button
        className="gdg-search-nav-btn"
        onClick={() => onNavigate("prev")}
        disabled={searchState.results.length === 0}
      >
        <Icons.ChevronUp />
      </button>
      <button
        className="gdg-search-nav-btn"
        onClick={() => onNavigate("next")}
        disabled={searchState.results.length === 0}
      >
        <Icons.ChevronDown />
      </button>
      <button className="gdg-search-nav-btn" onClick={onClose}>
        <Icons.X />
      </button>
    </div>
  );
}

// ============================================================================
// COLUMN FILTER MENU COMPONENT
// ============================================================================

interface ColumnFilterMenuProps<T extends BaseRowData> {
  column: DataGridColumn<T>;
  bounds: Rectangle;
  currentFilter: ColumnFilter | undefined;
  onFilterChange: (filter: ColumnFilter | null) => void;
  onClose: () => void;
  onPinColumn?: (position: "left" | "right" | null) => void;
  onHideColumn?: () => void;
  isPinned?: "left" | "right" | null;
}

function ColumnFilterMenu<T extends BaseRowData>({
  column,
  bounds,
  currentFilter,
  onFilterChange,
  onClose,
  onPinColumn,
  onHideColumn,
  isPinned,
}: ColumnFilterMenuProps<T>) {
  const [filterType, setFilterType] = useState<"text" | "number">(
    currentFilter?.type ||
      (column.filter?.includes("Number") ? "number" : "text")
  );
  const [condition, setCondition] = useState<ColumnFilter["condition"]>(
    currentFilter?.condition ||
      (filterType === "number" ? "equals" : "contains")
  );
  const [value, setValue] = useState<string>(
    currentFilter?.value !== undefined ? String(currentFilter.value) : ""
  );
  const [value2, setValue2] = useState<string>(
    currentFilter?.value2 !== undefined ? String(currentFilter.value2) : ""
  );

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    setTimeout(
      () => document.addEventListener("mousedown", handleClickOutside),
      0
    );
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const handleApply = () => {
    if (!value) {
      onFilterChange(null);
      return;
    }
    onFilterChange({
      type: filterType,
      condition,
      value: filterType === "number" ? parseFloat(value) : value,
      value2:
        condition === "between" && value2
          ? filterType === "number"
            ? parseFloat(value2)
            : value2
          : undefined,
    });
  };

  const menuStyle: React.CSSProperties = {
    position: "fixed",
    left: Math.min(bounds.x, window.innerWidth - 280),
    top: bounds.y + bounds.height + 4,
    zIndex: 10000,
  };

  return (
    <div ref={menuRef} className="gdg-column-menu" style={menuStyle}>
      <div className="gdg-column-menu-header">{column.headerName}</div>

      {(onPinColumn || onHideColumn) && (
        <div className="gdg-column-menu-section">
          <div className="gdg-column-menu-actions">
            {onPinColumn && (
              <>
                <button
                  className={`gdg-menu-action-btn ${
                    isPinned === "left" ? "active" : ""
                  }`}
                  onClick={() => {
                    onPinColumn(isPinned === "left" ? null : "left");
                    onClose();
                  }}
                >
                  {isPinned === "left" ? "Unpin" : "Pin Left"}
                </button>
                <button
                  className={`gdg-menu-action-btn ${
                    isPinned === "right" ? "active" : ""
                  }`}
                  onClick={() => {
                    onPinColumn(isPinned === "right" ? null : "right");
                    onClose();
                  }}
                >
                  {isPinned === "right" ? "Unpin" : "Pin Right"}
                </button>
              </>
            )}
            {onHideColumn && (
              <button
                className="gdg-menu-action-btn"
                onClick={() => {
                  onHideColumn();
                  onClose();
                }}
              >
                Hide Column
              </button>
            )}
          </div>
        </div>
      )}

      <div className="gdg-column-menu-section">
        <label className="gdg-menu-label">Filter</label>
        <div className="gdg-menu-row">
          <select
            className="gdg-menu-select"
            value={filterType}
            onChange={(e) => {
              const newType = e.target.value as "text" | "number";
              setFilterType(newType);
              setCondition(newType === "number" ? "equals" : "contains");
            }}
          >
            <option value="text">Text</option>
            <option value="number">Number</option>
          </select>
          <select
            className="gdg-menu-select"
            value={condition}
            onChange={(e) =>
              setCondition(e.target.value as ColumnFilter["condition"])
            }
          >
            {filterType === "text" ? (
              <>
                <option value="contains">Contains</option>
                <option value="equals">Equals</option>
                <option value="startsWith">Starts with</option>
                <option value="endsWith">Ends with</option>
              </>
            ) : (
              <>
                <option value="equals">Equals</option>
                <option value="greaterThan">Greater than</option>
                <option value="lessThan">Less than</option>
                <option value="between">Between</option>
              </>
            )}
          </select>
        </div>
        <input
          className="gdg-menu-input"
          type={filterType === "number" ? "number" : "text"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Value..."
          autoFocus
        />
        {condition === "between" && (
          <input
            className="gdg-menu-input"
            type={filterType === "number" ? "number" : "text"}
            value={value2}
            onChange={(e) => setValue2(e.target.value)}
            placeholder="Second value..."
          />
        )}
      </div>

      <div className="gdg-column-menu-footer">
        <button
          className="gdg-menu-btn secondary"
          onClick={() => onFilterChange(null)}
        >
          Clear
        </button>
        <button className="gdg-menu-btn primary" onClick={handleApply}>
          Apply
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// COLUMN VISIBILITY PANEL
// ============================================================================

interface ColumnVisibilityPanelProps<T extends BaseRowData> {
  columns: DataGridColumn<T>[];
  onToggleColumn: (field: Extract<keyof T, string>) => void;
  onClose: () => void;
}

function ColumnVisibilityPanel<T extends BaseRowData>({
  columns,
  onToggleColumn,
  onClose,
}: ColumnVisibilityPanelProps<T>) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    setTimeout(
      () => document.addEventListener("mousedown", handleClickOutside),
      0
    );
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div ref={menuRef} className="gdg-column-visibility-panel">
      <div className="gdg-column-menu-header">
        Columns
        <button className="gdg-panel-close" onClick={onClose}>
          <Icons.X />
        </button>
      </div>
      <div className="gdg-column-visibility-list">
        {columns.map((col) => (
          <label key={col.field} className="gdg-column-visibility-item">
            <input
              type="checkbox"
              checked={!col.hidden}
              onChange={() => onToggleColumn(col.field)}
            />
            <span>{col.headerName}</span>
            {col.pinned && <span className="gdg-pin-badge">{col.pinned}</span>}
          </label>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// TOAST NOTIFICATION
// ============================================================================

interface ToastProps {
  message: string;
  type: "success" | "error";
  onClose: () => void;
}

function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`gdg-toast ${type}`}>
      {type === "success" ? <Icons.Check /> : <Icons.X />}
      {message}
    </div>
  );
}

// ============================================================================
// ERROR MODAL COMPONENT
// ============================================================================

interface ErrorModalProps {
  errors: string[];
  onClose: () => void;
}

function ErrorModal({ errors, onClose }: ErrorModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    setTimeout(
      () => document.addEventListener("mousedown", handleClickOutside),
      0
    );
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  return (
    <div className="gdg-modal-overlay">
      <div ref={modalRef} className="gdg-error-modal">
        <div className="gdg-error-modal-header">
          <h3>Validation Errors ({errors.length})</h3>
          <button className="gdg-modal-close" onClick={onClose}>
            <Icons.X />
          </button>
        </div>
        <div className="gdg-error-modal-content">
          {errors.map((error, i) => (
            <div key={i} className="gdg-error-item">
              <span className="gdg-error-icon">⚠</span>
              <span>{error}</span>
            </div>
          ))}
        </div>
        <div className="gdg-error-modal-footer">
          <button className="gdg-menu-btn primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PAGINATION COMPONENT
// ============================================================================

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  pageSizeOptions: number[];
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

function Pagination({
  currentPage,
  totalPages,
  pageSize,
  pageSizeOptions,
  totalItems,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="gdg-pagination">
      <div className="gdg-pagination-size">
        <span>Page Size:</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="gdg-pagination-select"
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>

      <div className="gdg-pagination-info">
        <span>
          {startItem} to {endItem} of {totalItems}
        </span>
      </div>

      <div className="gdg-pagination-nav">
        <button
          className="gdg-pagination-btn"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          title="First Page"
        >
          ⟨⟨
        </button>
        <button
          className="gdg-pagination-btn"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          title="Previous Page"
        >
          ⟨
        </button>

        <span className="gdg-pagination-pages">
          Page {currentPage} of {totalPages}
        </span>

        <button
          className="gdg-pagination-btn"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          title="Next Page"
        >
          ⟩
        </button>
        <button
          className="gdg-pagination-btn"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          title="Last Page"
        >
          ⟩⟩
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN DATAGRID COMPONENT
// ============================================================================

function DataGridInner<T extends BaseRowData>(
  {
    data: initialData,
    columns: initialColumns,
    onSave,
    validate,
    createEmptyRow,
    toolbar = "floating",
    themeMode = "dark",
    enableHistory = true,
    enableKeyboardShortcuts = true,
    maxHistorySize = 50,
    enableColumnReorder = true,
    enableColumnPinning = true,
    enableSearch = true,
    enableExport = true,
    enableTreeData = false,
    showStatusBar = true,
    theme: customTheme,
    height = "100%",
    className = "",
    colors,
    onChange,
    onSelectionChange,
    footerLeftContent,
    emptyMessage = "No data to display",
    pagination = false,
    pageSize: initialPageSize = 10,
    pageSizeOptions = [10, 25, 50, 100],
  }: DataGridProps<T>,
  ref: React.ForwardedRef<DataGridRef<T>>
) {
  // ============================================================================
  // STATE
  // ============================================================================

  const [data, setData] = useState<T[]>(initialData);
  const [columns, setColumns] = useState<DataGridColumn<T>[]>(initialColumns);
  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });
  const [history, setHistory] = useState<HistoryState<T>[]>([
    { data: initialData, timestamp: Date.now() },
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [columnFilters, setColumnFilters] = useState<Map<string, ColumnFilter>>(
    new Map()
  );
  const [columnMenu, setColumnMenu] = useState<ColumnMenu | undefined>();
  const [showSearch, setShowSearch] = useState(false);
  const [searchState, setSearchState] = useState<SearchState>({
    query: "",
    currentIndex: 0,
    results: [],
  });
  const [showColumnVisibility, setShowColumnVisibility] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [showContextMenu, setShowContextMenu] = useState<{
    x: number;
    y: number;
    row: number;
  } | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const gridRef = useRef<DataEditorRef>(null);

  const lastSavedData = useRef<T[]>(initialData);
  const [cellErrors, setCellErrors] = useState<Map<string, string>>(new Map());
  const [showErrorModal, setShowErrorModal] = useState(false);

  const gridContainerRef = useRef<HTMLDivElement>(null);
  const aggregationRowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const gridElement =
      gridContainerRef.current?.querySelector(".dvn-scroller");
    const aggRow = aggregationRowRef.current;

    if (!gridElement || !aggRow) return;

    const handleScroll = () => {
      aggRow.scrollLeft = gridElement.scrollLeft;
    };

    gridElement.addEventListener("scroll", handleScroll);
    return () => gridElement.removeEventListener("scroll", handleScroll);
  }, []);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  // ============================================================================
  // DERIVED STATE
  // ============================================================================

  const sortedColumns = useMemo(() => {
    const visible = columns.filter((col) => !col.hidden);
    const leftPinned = visible.filter((col) => col.pinned === "left");
    const rightPinned = visible.filter((col) => col.pinned === "right");
    const center = visible.filter((col) => !col.pinned);
    return [...leftPinned, ...center, ...rightPinned];
  }, [columns]);

  const freezeColumns = useMemo(() => {
    return columns.filter((col) => col.pinned === "left" && !col.hidden).length;
  }, [columns]);

  const filteredData = useMemo(() => {
    let result = enableTreeData ? flattenTreeData(data) : data;

    if (columnFilters.size === 0) return result;

    return result.filter((row) => {
      for (const [field, filter] of columnFilters) {
        const value = row[field as keyof T];
        const stringValue =
          value !== null && value !== undefined
            ? String(value).toLowerCase()
            : "";
        const filterValue = String(filter.value).toLowerCase();

        if (filter.type === "text") {
          switch (filter.condition) {
            case "contains":
              if (!stringValue.includes(filterValue)) return false;
              break;
            case "equals":
              if (stringValue !== filterValue) return false;
              break;
            case "startsWith":
              if (!stringValue.startsWith(filterValue)) return false;
              break;
            case "endsWith":
              if (!stringValue.endsWith(filterValue)) return false;
              break;
          }
        } else {
          const numValue = parseFloat(stringValue);
          const filterNum = filter.value as number;
          switch (filter.condition) {
            case "equals":
              if (numValue !== filterNum) return false;
              break;
            case "greaterThan":
              if (numValue <= filterNum) return false;
              break;
            case "lessThan":
              if (numValue >= filterNum) return false;
              break;
            case "between":
              const filterNum2 = filter.value2 as number;
              if (numValue < filterNum || numValue > filterNum2) return false;
              break;
          }
        }
      }
      return true;
    });
  }, [data, columnFilters, enableTreeData]);

  const glideColumns = useMemo((): GridColumn[] => {
    return sortedColumns.map((col) => ({
      id: col.field,
      title: col.headerName,
      width: col.width || 150,
      grow: col.flex,
      hasMenu: true,
      themeOverride: col.pinned
        ? { bgHeader: "rgba(102, 126, 234, 0.15)" }
        : undefined,
    }));
  }, [sortedColumns]);

  const stats = useMemo(() => {
    const selectedRows = selection.rows.toArray();
    const hasEdits =
      JSON.stringify(data) !== JSON.stringify(lastSavedData.current);
    return {
      total: data.length,
      filtered: filteredData.length,
      selected: selectedRows.length,
      hidden: columns.filter((c) => c.hidden).length,
      edited: hasEdits,
    };
  }, [data, filteredData, selection.rows, columns]);
  const aggregations = useMemo(() => {
    const result: Record<string, string> = {};
    for (const col of sortedColumns) {
      if (col.aggregate) {
        result[col.field] = calculateAggregation(filteredData, col);
      }
    }
    return result;
  }, [filteredData, sortedColumns]);

  const combinedRenderers = useMemo(() => [...allCells, ActionRenderer], []);

  const paginatedData = useMemo(() => {
    if (!pagination) return filteredData;

    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredData.slice(startIndex, endIndex);
  }, [filteredData, pagination, currentPage, pageSize]);

  const totalPages = useMemo(() => {
    if (!pagination) return 1;
    return Math.max(1, Math.ceil(filteredData.length / pageSize));
  }, [filteredData.length, pagination, pageSize]);

  // Reset to page 1 when filters change or data changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filteredData.length, pageSize]);

  // ============================================================================
  // HISTORY MANAGEMENT
  // ============================================================================

  const pushHistory = useCallback(
    (newData: T[]) => {
      if (!enableHistory) return;

      setHistory((prev) => {
        const newHistory = prev.slice(0, historyIndex + 1);
        newHistory.push({ data: newData, timestamp: Date.now() });
        if (newHistory.length > maxHistorySize) {
          newHistory.shift();
          return newHistory;
        }
        return newHistory;
      });
      setHistoryIndex((prev) => Math.min(prev + 1, maxHistorySize - 1));
    },
    [enableHistory, historyIndex, maxHistorySize]
  );

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setData(history[newIndex].data);
      onChange?.(history[newIndex].data);
    }
  }, [historyIndex, history, onChange]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setData(history[newIndex].data);
      onChange?.(history[newIndex].data);
    }
  }, [historyIndex, history, onChange]);

  // ============================================================================
  // DATA OPERATIONS
  // ============================================================================

  const handleAddRow = useCallback(() => {
    const newRow = {
      ...createEmptyRow(),
      id: Date.now(),
    } as T;
    const newData = [...data, newRow];
    setData(newData);
    pushHistory(newData);
    onChange?.(newData);

    setTimeout(() => {
      gridRef.current?.scrollTo(0, newData.length - 1);
    }, 50);
  }, [createEmptyRow, data, pushHistory, onChange]);

  const handleDeleteRows = useCallback(() => {
    const selectedIndices = selection.rows.toArray();
    if (selectedIndices.length === 0) return;

    const rowIdsToDelete = new Set(
      selectedIndices.map((i) => filteredData[i]?.id)
    );
    const newData = data.filter((row) => !rowIdsToDelete.has(row.id));
    setData(newData);
    pushHistory(newData);
    setSelection({
      columns: CompactSelection.empty(),
      rows: CompactSelection.empty(),
    });
    onChange?.(newData);
  }, [selection.rows, filteredData, data, pushHistory, onChange]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setValidationErrors([]);

    const errors: string[] = [];
    data.forEach((row, index) => {
      const error = validate(row);
      if (error) {
        errors.push(`Row ${index + 1}: ${error.message}`);
      }
    });

    if (errors.length > 0) {
      setValidationErrors(errors);
      setIsSaving(false);
      setToast({
        message: `${errors.length} validation error(s)`,
        type: "error",
      });
      return;
    }

    try {
      await onSave(data);
      lastSavedData.current = [...data];
      setToast({ message: "Saved successfully", type: "success" });
    } catch (error) {
      setToast({ message: "Failed to save", type: "error" });
    } finally {
      setIsSaving(false);
    }
  }, [data, validate, onSave]);

  const handleInsertRowAbove = useCallback(
    (rowIndex: number) => {
      const newRow = { ...createEmptyRow(), id: Date.now() } as T;
      const actualIndex = data.findIndex(
        (r) => r.id === filteredData[rowIndex]?.id
      );
      if (actualIndex === -1) return;
      const newData = [
        ...data.slice(0, actualIndex),
        newRow,
        ...data.slice(actualIndex),
      ];
      setData(newData);
      pushHistory(newData);
      setShowContextMenu(null);
      onChange?.(newData);
    },
    [createEmptyRow, data, filteredData, pushHistory, onChange]
  );

  const handleInsertRowBelow = useCallback(
    (rowIndex: number) => {
      const newRow = { ...createEmptyRow(), id: Date.now() } as T;
      const actualIndex = data.findIndex(
        (r) => r.id === filteredData[rowIndex]?.id
      );
      if (actualIndex === -1) return;
      const newData = [
        ...data.slice(0, actualIndex + 1),
        newRow,
        ...data.slice(actualIndex + 1),
      ];
      setData(newData);
      pushHistory(newData);
      setShowContextMenu(null);
      onChange?.(newData);
    },
    [createEmptyRow, data, filteredData, pushHistory, onChange]
  );

  const handleDuplicateRow = useCallback(
    (rowIndex: number) => {
      const sourceRow = filteredData[rowIndex];
      if (!sourceRow) return;
      const newRow = { ...sourceRow, id: Date.now() } as T;
      const actualIndex = data.findIndex((r) => r.id === sourceRow.id);
      if (actualIndex === -1) return;
      const newData = [
        ...data.slice(0, actualIndex + 1),
        newRow,
        ...data.slice(actualIndex + 1),
      ];
      setData(newData);
      pushHistory(newData);
      setShowContextMenu(null);
      onChange?.(newData);
    },
    [filteredData, data, pushHistory, onChange]
  );

  // ============================================================================
  // CELL OPERATIONS
  // ============================================================================
  const onColumnResize = useCallback((column: GridColumn, newSize: number) => {
    setColumns((prev) =>
      prev.map((col) =>
        col.field === column.id ? { ...col, width: newSize } : col
      )
    );
  }, []);
  const getCellContent = useCallback(
    (cell: Item): GridCell => {
      const [col, row] = cell;
      const rowData = paginatedData[row];
      const column = sortedColumns[col];

      if (!rowData || !column) {
        return {
          kind: GridCellKind.Text,
          data: "",
          displayData: "",
          allowOverlay: false,
        };
      }

      let value: any;
      if (column.calculated) {
        value = column.calculated.compute(rowData);
      } else {
        value = rowData[column.field];
      }

      const displayValue =
        value !== null && value !== undefined ? String(value) : "";

      // Check for cell error
      const cellKey = `${rowData.id}-${column.field}`;
      const hasError = cellErrors.has(cellKey);

      // Calculated columns are editable if they have a reverse function
      const isEditable =
        column.editable !== false &&
        (!column.calculated || column.calculated.reverse !== undefined);

      // Handle dropdown cells
      if (column.cellType === "dropdown" && column.options) {
        return {
          kind: GridCellKind.Custom,
          allowOverlay: isEditable,
          copyData: displayValue,
          data: {
            kind: "dropdown-cell",
            allowedValues: column.options,
            value: displayValue,
          },
        };
      }

      if (column.cellType === "action") {
        return {
          kind: GridCellKind.Custom,
          allowOverlay: false,
          copyData: "",
          data: {
            kind: "action-cell",
            rowId: rowData.id,
            rowIndex: row,
            actions: column.actions || [],
            row: rowData,
          },
        } as CustomCell<ActionCellData>;
      }

      // Default text cell
      return {
        kind: GridCellKind.Text,
        data: displayValue,
        displayData: displayValue,
        allowOverlay: isEditable,
        themeOverride: hasError
          ? {
              bgCell: "rgba(231, 76, 60, 0.15)",
              textDark: "#e74c3c",
            }
          : undefined,
      };
    },
    [paginatedData, sortedColumns, cellErrors]
  );

  const validateCell = useCallback(
    (rowId: number, field: string, value: any): string | null => {
      // Find the row and create a temporary updated version
      const rowIndex = data.findIndex((r) => r.id === rowId);
      if (rowIndex === -1) return null;

      const tempRow = { ...data[rowIndex], [field]: value };
      const error = validate(tempRow as T);

      if (error && error.field === field) {
        return error.message;
      }
      return null;
    },
    [data, validate]
  );

  const onCellEdited = useCallback(
    (cell: Item, newValue: EditableGridCell) => {
      const [col, row] = cell;
      const column = sortedColumns[col];
      const rowData = paginatedData[row];
      if (column?.cellType === "action") return;
      if (!column || !rowData || column.editable === false) return;

      if (column.calculated && !column.calculated.reverse) return;

      const actualIndex = data.findIndex((r) => r.id === rowData.id);
      if (actualIndex === -1) return;

      // Extract value based on cell type
      let newCellValue: any;
      if (newValue.kind === GridCellKind.Custom) {
        // Dropdown cell
        const customData = newValue.data as Record<string, any>;
        newCellValue = customData?.value ?? "";
      } else if (newValue.kind === GridCellKind.Text) {
        newCellValue = newValue.data;
      } else {
        return; // Unsupported cell type, exit early
      }

      // Skip if value is undefined
      if (newCellValue === undefined) return;

      let updatedFields: Partial<T>;

      if (column.calculated && column.calculated.reverse) {
        updatedFields = column.calculated.reverse(
          rowData,
          newCellValue as string | number
        );
      } else {
        updatedFields = { [column.field]: newCellValue } as Partial<T>;
      }

      const primaryField = column.calculated
        ? Object.keys(updatedFields)[0]
        : column.field;
      const fieldValue = updatedFields[primaryField as keyof T];
      const cellError =
        fieldValue !== undefined
          ? validateCell(rowData.id!, primaryField, fieldValue)
          : null;
      const cellKey = `${rowData.id}-${column.field}`;

      setCellErrors((prev) => {
        const next = new Map(prev);
        if (cellError) {
          next.set(cellKey, cellError);
        } else {
          next.delete(cellKey);
        }
        return next;
      });

      if (cellError) {
        setToast({
          message: `${column.headerName}: ${cellError}`,
          type: "error",
        });
      }

      const newData = [...data];
      newData[actualIndex] = {
        ...newData[actualIndex],
        ...updatedFields,
      };

      setData(newData);
      pushHistory(newData);
      onChange?.(newData);
    },
    [sortedColumns, paginatedData, data, pushHistory, onChange, validateCell]
  );

  const onCellsEdited = useCallback(
    (newValues: readonly { location: Item; value: EditableGridCell }[]) => {
      const newData = [...data];

      for (const { location, value } of newValues) {
        const [col, row] = location;
        const column = sortedColumns[col];
        const rowData = paginatedData[row];

        if (!column || !rowData || column.editable === false) continue;
        if (column.calculated && !column.calculated.reverse) continue;

        const actualIndex = data.findIndex((r) => r.id === rowData.id);
        if (actualIndex === -1) continue;

        // Extract value based on cell type
        let newCellValue: any;
        if (value.kind === GridCellKind.Custom) {
          const customData = value.data as Record<string, any>;
          newCellValue = customData?.value ?? "";
        } else if (value.kind === GridCellKind.Text) {
          newCellValue = value.data;
        } else {
          continue;
        }

        let updatedFields: Partial<T>;

        if (column.calculated && column.calculated.reverse) {
          updatedFields = column.calculated.reverse(
            rowData,
            newCellValue as string | number
          );
        } else {
          updatedFields = { [column.field]: newCellValue } as Partial<T>;
        }

        newData[actualIndex] = {
          ...newData[actualIndex],
          ...updatedFields,
        };
      }

      setData(newData);
      pushHistory(newData);
      onChange?.(newData);
      return true;
    },
    [sortedColumns, paginatedData, data, pushHistory, onChange]
  );

  // ============================================================================
  // COLUMN OPERATIONS
  // ============================================================================

  const onColumnMoved = useCallback(
    (startIndex: number, endIndex: number) => {
      const visibleCols = columns.filter((col) => !col.hidden);
      const leftPinned = visibleCols.filter((col) => col.pinned === "left");
      const rightPinned = visibleCols.filter((col) => col.pinned === "right");
      const center = visibleCols.filter((col) => !col.pinned);
      const sortedCols = [...leftPinned, ...center, ...rightPinned];

      const movedColumn = sortedCols[startIndex];
      if (!movedColumn) return;

      if (movedColumn.pinned) return;
      if (endIndex < leftPinned.length) return;
      if (endIndex >= sortedCols.length - rightPinned.length) return;

      const newSorted = [...sortedCols];
      newSorted.splice(startIndex, 1);
      newSorted.splice(endIndex, 0, movedColumn);

      const hiddenCols = columns.filter((col) => col.hidden);
      setColumns([...newSorted, ...hiddenCols]);
    },
    [columns]
  );

  const onHeaderMenuClick = useCallback((col: number, bounds: Rectangle) => {
    setColumnMenu({ col, bounds });
  }, []);

  const handleFilterChange = useCallback(
    (field: string, filter: ColumnFilter | null) => {
      setColumnFilters((prev) => {
        const newFilters = new Map(prev);
        if (filter) {
          newFilters.set(field, filter);
        } else {
          newFilters.delete(field);
        }
        return newFilters;
      });
    },
    []
  );

  const handleClearAllFilters = useCallback(() => {
    setColumnFilters(new Map());
  }, []);

  const handlePinColumn = useCallback(
    (field: string, position: "left" | "right" | null) => {
      setColumns((prev) =>
        prev.map((col) =>
          col.field === field ? { ...col, pinned: position || undefined } : col
        )
      );
    },
    []
  );

  const handleHideColumn = useCallback((field: string) => {
    setColumns((prev) =>
      prev.map((col) => (col.field === field ? { ...col, hidden: true } : col))
    );
  }, []);

  const handleToggleColumnVisibility = useCallback(
    (field: Extract<keyof T, string>) => {
      setColumns((prev) =>
        prev.map((col) =>
          col.field === field ? { ...col, hidden: !col.hidden } : col
        )
      );
    },
    []
  );

  // ============================================================================
  // SEARCH
  // ============================================================================

  useEffect(() => {
    if (!searchState.query) {
      setSearchState((prev) => ({ ...prev, results: [], currentIndex: 0 }));
      return;
    }

    const query = searchState.query.toLowerCase();
    const results: Item[] = [];

    filteredData.forEach((row, rowIndex) => {
      sortedColumns.forEach((col, colIndex) => {
        const value = row[col.field];
        if (
          value !== null &&
          value !== undefined &&
          String(value).toLowerCase().includes(query)
        ) {
          results.push([colIndex, rowIndex]);
        }
      });
    });

    setSearchState((prev) => ({ ...prev, results, currentIndex: 0 }));

    if (results.length > 0) {
      gridRef.current?.scrollTo(results[0][0], results[0][1]);
    }
  }, [searchState.query, filteredData, sortedColumns]);

  const handleSearchNavigate = useCallback(
    (direction: "next" | "prev") => {
      if (searchState.results.length === 0) return;

      let newIndex = searchState.currentIndex;
      if (direction === "next") {
        newIndex = (newIndex + 1) % searchState.results.length;
      } else {
        newIndex =
          (newIndex - 1 + searchState.results.length) %
          searchState.results.length;
      }

      setSearchState((prev) => ({ ...prev, currentIndex: newIndex }));

      const result = searchState.results[newIndex];
      if (result) {
        gridRef.current?.scrollTo(result[0], result[1]);
        setSelection({
          columns: CompactSelection.empty(),
          rows: CompactSelection.empty(),
          current: {
            cell: result,
            range: { x: result[0], y: result[1], width: 1, height: 1 },
            rangeStack: [],
          },
        });
      }
    },
    [searchState]
  );

  const handleExportCSV = useCallback(() => {
    exportToCSV(filteredData, columns);
  }, [filteredData, columns]);

  // ============================================================================
  // CONTEXT MENU
  // ============================================================================

  const onCellContextMenu = useCallback(
    (cell: Item, event: CellClickedEventArgs) => {
      event.preventDefault?.();
      setShowContextMenu({
        x: event.bounds.x + event.localEventX,
        y: event.bounds.y + event.localEventY,
        row: cell[1],
      });
    },
    []
  );

  useEffect(() => {
    const handleClickOutside = () => setShowContextMenu(null);
    if (showContextMenu) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [showContextMenu]);

  // ============================================================================
  // KEYBOARD SHORTCUTS
  // ============================================================================

  useEffect(() => {
    if (!enableKeyboardShortcuts) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT"
      ) {
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case "z":
            e.preventDefault();
            handleUndo();
            break;
          case "y":
            e.preventDefault();
            handleRedo();
            break;
          case "s":
            e.preventDefault();
            handleSave();
            break;
          case "f":
            if (enableSearch) {
              e.preventDefault();
              setShowSearch(true);
            }
            break;
          case "e":
            if (enableExport) {
              e.preventDefault();
              handleExportCSV();
            }
            break;
        }
      } else {
        switch (e.key) {
          case "F3":
            e.preventDefault();
            handleAddRow();
            break;
          case "Delete":
            if (selection.rows.length > 0) {
              e.preventDefault();
              handleDeleteRows();
            }
            break;
          case "Escape":
            setShowSearch(false);
            setShowColumnVisibility(false);
            setShowContextMenu(null);
            break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    enableKeyboardShortcuts,
    enableSearch,
    enableExport,
    handleUndo,
    handleRedo,
    handleSave,
    handleAddRow,
    handleDeleteRows,
    handleExportCSV,
    selection.rows.length,
  ]);

  // ============================================================================
  // SELECTION CHANGE CALLBACK
  // ============================================================================

  useEffect(() => {
    if (onSelectionChange) {
      const selectedIndices = selection.rows.toArray();
      const selectedRows = selectedIndices
        .map((i) => filteredData[i])
        .filter(Boolean);
      onSelectionChange(selectedRows);
    }
  }, [selection.rows, filteredData, onSelectionChange]);

  // ============================================================================
  // IMPERATIVE HANDLE (REF API)
  // ============================================================================

  useImperativeHandle(
    ref,
    () => ({
      undo: handleUndo,
      redo: handleRedo,
      addRow: handleAddRow,
      deleteSelected: handleDeleteRows,
      save: handleSave,
      openSearch: () => setShowSearch(true),
      closeSearch: () => setShowSearch(false),
      exportCSV: (filename?: string) =>
        exportToCSV(filteredData, columns, filename),
      openColumnVisibility: () => setShowColumnVisibility(true),
      clearFilters: handleClearAllFilters,
      getData: () => data,
      getSelectedRows: () => {
        const indices = selection.rows.toArray();
        return indices.map((i) => filteredData[i]).filter(Boolean);
      },
      selectAll: () => {
        setSelection({
          columns: CompactSelection.empty(),
          rows: CompactSelection.fromSingleSelection([
            0,
            filteredData.length - 1,
          ]),
        });
      },
      clearSelection: () => {
        setSelection({
          columns: CompactSelection.empty(),
          rows: CompactSelection.empty(),
        });
      },
      canUndo: historyIndex > 0,
      canRedo: historyIndex < history.length - 1,
      hasChanges: stats.edited,
      selectedCount: stats.selected,
      rowCount: stats.total,
      filterCount: columnFilters.size,
    }),
    [
      handleUndo,
      handleRedo,
      handleAddRow,
      handleDeleteRows,
      handleSave,
      handleClearAllFilters,
      data,
      filteredData,
      columns,
      selection.rows,
      historyIndex,
      history.length,
      stats,
      columnFilters.size,
    ]
  );

  // ============================================================================
  // THEME
  // ============================================================================

  const themes = {
    dark: {
      accentColor: "#667eea",
      accentLight: "rgba(102, 126, 234, 0.2)",
      textDark: "#e0e0e0",
      textMedium: "#b0b0b0",
      textLight: "#888888",
      textBubble: "#e0e0e0",
      bgIconHeader: "#2d3748",
      fgIconHeader: "#a0aec0",
      textHeader: "#f7fafc",
      textGroupHeader: "#f7fafc",
      bgCell: "#1a1f21",
      bgCellMedium: "#21272a",
      bgHeader: "#2d3748",
      bgHeaderHasFocus: "#4a5568",
      bgHeaderHovered: "#4a5568",
      bgBubble: "#21272a",
      bgBubbleSelected: "#2d3436",
      bgSearchResult: "rgba(102, 126, 234, 0.2)",
      borderColor: "#4a5568",
      drilldownBorder: "#667eea",
      linkColor: "#667eea",
      headerFontStyle: "600 13px",
      baseFontStyle: "13px",
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif',
    },
    light: {
      accentColor: "#5a67d8",
      accentLight: "rgba(90, 103, 216, 0.15)",
      textDark: "#1a202c",
      textMedium: "#4a5568",
      textLight: "#718096",
      textBubble: "#1a202c",
      bgIconHeader: "#4a5568",
      fgIconHeader: "#ffffff",
      textHeader: "#ffffff",
      textGroupHeader: "#ffffff",
      bgCell: "#ffffff",
      bgCellMedium: "#f7fafc",
      bgHeader: "#5a67d8",
      bgHeaderHasFocus: "#4c51bf",
      bgHeaderHovered: "#4c51bf",
      bgBubble: "#edf2f7",
      bgBubbleSelected: "#e2e8f0",
      bgSearchResult: "rgba(90, 103, 216, 0.15)",
      borderColor: "#e2e8f0",
      drilldownBorder: "#5a67d8",
      linkColor: "#5a67d8",
      headerFontStyle: "600 13px",
      baseFontStyle: "13px",
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif',
    },
  };

  const baseTheme = themes[themeMode as keyof typeof themes];

  const mergedTheme: Partial<Theme> = {
    ...baseTheme,
    // Apply custom colors if provided
    ...(colors?.headerBg && {
      bgHeader: colors.headerBg,
      bgHeaderHasFocus: colors.headerBg,
      bgHeaderHovered: colors.headerBg,
    }),
    ...(colors?.headerText && {
      textHeader: colors.headerText,
      textGroupHeader: colors.headerText,
    }),
    ...(colors?.cellBg && { bgCell: colors.cellBg }),
    ...(colors?.cellText && { textDark: colors.cellText }),
    ...(colors?.accentColor && {
      accentColor: colors.accentColor,
      accentLight: `${colors.accentColor}33`,
      linkColor: colors.accentColor,
      drilldownBorder: colors.accentColor,
    }),
    ...(colors?.borderColor && { borderColor: colors.borderColor }),
    // Then apply any custom theme overrides
    ...customTheme,
  };

  // ============================================================================
  // FAB ACTIONS
  // ============================================================================

  const fabActions = useMemo(() => {
    const actions = [];

    if (enableHistory) {
      actions.push({
        id: "undo",
        icon: <Icons.Undo />,
        label: "Undo",
        onClick: handleUndo,
        disabled: historyIndex === 0,
      });
      actions.push({
        id: "redo",
        icon: <Icons.Redo />,
        label: "Redo",
        onClick: handleRedo,
        disabled: historyIndex >= history.length - 1,
      });
    }

    actions.push({
      id: "add",
      icon: <Icons.Plus />,
      label: "Add Row",
      onClick: handleAddRow,
    });

    actions.push({
      id: "delete",
      icon: <Icons.Trash />,
      label: "Delete",
      onClick: handleDeleteRows,
      disabled: stats.selected === 0,
      variant: "danger" as const,
    });

    if (enableSearch) {
      actions.push({
        id: "search",
        icon: <Icons.Search />,
        label: "Search",
        onClick: () => setShowSearch(true),
      });
    }

    actions.push({
      id: "columns",
      icon: <Icons.Columns />,
      label: "Columns",
      onClick: () => setShowColumnVisibility(true),
      badge: stats.hidden > 0 ? stats.hidden : undefined,
    });

    if (columnFilters.size > 0) {
      actions.push({
        id: "clearFilters",
        icon: <Icons.Filter />,
        label: "Clear Filters",
        onClick: handleClearAllFilters,
        badge: columnFilters.size,
      });
    }

    if (enableExport) {
      actions.push({
        id: "export",
        icon: <Icons.Download />,
        label: "Export CSV",
        onClick: handleExportCSV,
      });
    }

    actions.push({
      id: "save",
      icon: <Icons.Save />,
      label: stats.edited ? "Save *" : "Save",
      onClick: handleSave,
      disabled: isSaving,
      variant: "primary" as const,
    });

    return actions;
  }, [
    enableHistory,
    enableSearch,
    enableExport,
    handleUndo,
    handleRedo,
    handleAddRow,
    handleDeleteRows,
    handleClearAllFilters,
    handleExportCSV,
    handleSave,
    historyIndex,
    history.length,
    stats,
    columnFilters.size,
    isSaving,
  ]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div
      className={`gdg-wrapper ${themeMode} ${className}`}
      style={{
        height,
        ...(colors?.accentColor &&
          ({ "--gdg-accent": colors.accentColor } as React.CSSProperties)),
        ...(colors?.cellBg &&
          ({ "--gdg-bg-cell": colors.cellBg } as React.CSSProperties)),
        ...(colors?.borderColor &&
          ({ "--gdg-border": colors.borderColor } as React.CSSProperties)),
        ...(colors?.headerBg &&
          ({ "--gdg-bg-header": colors.headerBg } as React.CSSProperties)),
        ...(colors?.cellText &&
          ({ "--gdg-text": colors.cellText } as React.CSSProperties)),
      }}
    >
      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Search Bar (Floating) */}
      {showSearch && (
        <SearchBar
          searchState={searchState}
          onSearchChange={(query) =>
            setSearchState((prev) => ({ ...prev, query }))
          }
          onNavigate={handleSearchNavigate}
          onClose={() => setShowSearch(false)}
        />
      )}

      {/* Grid Container */}
      <div ref={gridContainerRef} className="gdg-grid-container">
        {filteredData.length === 0 ? (
          <div className="gdg-empty-state">
            {typeof emptyMessage === "string" ? (
              <>
                <div className="gdg-empty-icon">
                  <Icons.Search />
                </div>
                <p className="gdg-empty-text">{emptyMessage}</p>
              </>
            ) : (
              emptyMessage
            )}
          </div>
        ) : (
          <DataEditor
            ref={gridRef}
            getCellContent={getCellContent}
            columns={glideColumns}
            rows={paginatedData.length}
            onCellEdited={onCellEdited}
            onCellsEdited={onCellsEdited}
            onHeaderMenuClick={onHeaderMenuClick}
            onColumnMoved={enableColumnReorder ? onColumnMoved : undefined}
            gridSelection={selection}
            onGridSelectionChange={setSelection}
            onCellContextMenu={onCellContextMenu}
            theme={mergedTheme}
            onColumnResize={onColumnResize}
            columnSelect="none"
            // themeMode="light"
            width="100%"
            height="100%"
            rowMarkers="both"
            rowSelect="multi"
            // rowSelectionMode="auto"
            smoothScrollX={false}
            smoothScrollY={false}
            getCellsForSelection={true}
            onPaste={true}
            fillHandle={true}
            freezeColumns={freezeColumns}
            columnSelectionBlending="mixed"
            rangeSelectionBlending="mixed"
            onKeyDown={(e) => {
              // Check if Enter pressed on last row
              if (e.key === "Enter" && !e.shiftKey) {
                const currentCell = selection.current?.cell;
                if (currentCell && currentCell[1] === filteredData.length - 1) {
                  e.preventDefault();
                  handleAddRow();
                }
              }
            }}
            customRenderers={combinedRenderers}
            rightElement={null}
            rightElementProps={{
              fill: false,
              sticky: false,
            }}
          />
        )}
      </div>

      {/* Status Bar */}
      {/* Aggregation Row - attached to grid */}
      {/* Aggregation Row - aligned with columns */}
      {showStatusBar && Object.keys(aggregations).length > 0 && (
        <div className="gdg-aggregation-row" ref={aggregationRowRef}>
          {/* Spacer for row marker */}
          <div
            className="gdg-aggregation-cell gdg-aggregation-marker"
            style={{ width: ROW_MARKER_WIDTH }}
          >
            <span className="gdg-aggregation-label">Σ</span>
          </div>
          {/* Column-aligned aggregations */}
          {sortedColumns.map((col) => (
            <div
              key={col.field}
              className="gdg-aggregation-cell"
              style={{ width: col.width || 150 }}
            >
              {aggregations[col.field] ? (
                <>
                  <span className="gdg-aggregation-type">
                    {aggregations[col.field].split(":")[0]}
                  </span>
                  <span className="gdg-aggregation-value">
                    {aggregations[col.field].split(": ")[1]}
                  </span>
                </>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          pageSizeOptions={pageSizeOptions}
          totalItems={filteredData.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
        />
      )}

      {/* Footer Bar - row count, state, errors */}
      {showStatusBar && (
        <div className="gdg-footer-bar">
          <div className="gdg-footer-left">
            {footerLeftContent ? (
              footerLeftContent({
                total: stats.total,
                filtered: stats.filtered,
                selected: stats.selected,
              })
            ) : (
              <>
                <span className="gdg-row-count">{stats.total} rows</span>
                {columnFilters.size > 0 && (
                  <span className="gdg-footer-filtered">
                    ({stats.filtered} filtered)
                  </span>
                )}
                {stats.selected > 0 && (
                  <span className="gdg-footer-selected">
                    {stats.selected} selected
                  </span>
                )}
              </>
            )}
          </div>

          <div className="gdg-footer-right">
            {stats.edited && (
              <span className="gdg-footer-unsaved">
                <span className="gdg-unsaved-dot">●</span> Unsaved changes
              </span>
            )}
            {validationErrors.length > 0 && (
              <button
                className="gdg-footer-errors-btn"
                onClick={() => setShowErrorModal(true)}
              >
                <Icons.X /> {validationErrors.length} error
                {validationErrors.length > 1 ? "s" : ""}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Floating Toolbar */}
      {toolbar === "floating" && (
        <FABMenu actions={fabActions} position="bottom-right" />
      )}

      {/* Context Menu */}
      {showContextMenu && (
        <div
          className="gdg-context-menu"
          style={{ left: showContextMenu.x, top: showContextMenu.y }}
        >
          <button onClick={() => handleInsertRowAbove(showContextMenu.row)}>
            Insert Above
          </button>
          <button onClick={() => handleInsertRowBelow(showContextMenu.row)}>
            Insert Below
          </button>
          <div className="gdg-context-menu-divider" />
          <button onClick={() => handleDuplicateRow(showContextMenu.row)}>
            Duplicate
          </button>
          <div className="gdg-context-menu-divider" />
          <button className="danger" onClick={handleDeleteRows}>
            Delete
          </button>
        </div>
      )}

      {/* Column Filter Menu */}
      {columnMenu && (
        <ColumnFilterMenu
          column={sortedColumns[columnMenu.col]}
          bounds={columnMenu.bounds}
          currentFilter={columnFilters.get(sortedColumns[columnMenu.col].field)}
          onFilterChange={(filter) => {
            handleFilterChange(sortedColumns[columnMenu.col].field, filter);
            setColumnMenu(undefined);
          }}
          onClose={() => setColumnMenu(undefined)}
          onPinColumn={
            enableColumnPinning
              ? (pos) =>
                  handlePinColumn(sortedColumns[columnMenu.col].field, pos)
              : undefined
          }
          onHideColumn={() =>
            handleHideColumn(sortedColumns[columnMenu.col].field)
          }
          isPinned={sortedColumns[columnMenu.col].pinned}
        />
      )}

      {/* Column Visibility Panel */}
      {showColumnVisibility && (
        <ColumnVisibilityPanel
          columns={columns}
          onToggleColumn={handleToggleColumnVisibility}
          onClose={() => setShowColumnVisibility(false)}
        />
      )}

      {/* Error Modal */}
      {showErrorModal && validationErrors.length > 0 && (
        <ErrorModal
          errors={validationErrors}
          onClose={() => setShowErrorModal(false)}
        />
      )}
    </div>
  );
}

// Export with forwardRef
export const DataGrid = forwardRef(DataGridInner) as <T extends BaseRowData>(
  props: DataGridProps<T> & { ref?: React.ForwardedRef<DataGridRef<T>> }
) => React.ReactElement;

export default DataGrid;
