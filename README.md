# React Glide Data Grid Pro

A powerful, feature-rich React data grid component built on top of [Glide Data Grid](https://github.com/glideapps/glide-data-grid). This is a **free, open-source alternative to AG-Grid Enterprise** with many similar features.

![npm version](https://img.shields.io/npm/v/sofisoft-data-grid)
![license](https://img.shields.io/npm/l/sofisoft-data-grid)

## ✨ Features

- 🚀 **High Performance** - Built on Glide Data Grid's canvas-based rendering
- 📊 **Sorting** - Click column headers to sort (ascending/descending)
- 🔍 **Advanced Filtering** - Text, Number, Date, and Dropdown filters
- 📄 **Pagination** - Built-in pagination with customizable page sizes
- ✏️ **Inline Editing** - Edit cells directly in the grid
- 🎯 **Row Selection** - Single and multi-row selection
- 📌 **Column Pinning** - Pin columns to left or right
- 👁️ **Column Visibility** - Show/hide columns
- 🔄 **Column Reordering** - Drag and drop columns
- ↩️ **Undo/Redo** - Full history support
- 🎨 **Action Cells** - Custom action buttons (view, edit, delete, etc.)
- 📈 **Aggregations** - Sum, Count, Avg, Min, Max
- 💾 **Export to CSV** - One-click data export
- 🔎 **Search** - Global search with navigation
- 🌙 **Dark/Light Theme** - Built-in theme support
- 📱 **Responsive** - Works on all screen sizes
- 💪 **TypeScript** - Full TypeScript support

## 📦 Installation

```bash
# npm
npm install sofisoft-data-grid

# yarn
yarn add sofisoft-data-grid

# pnpm
pnpm add sofisoft-data-grid
```

## 🚀 Quick Start

```tsx
import { DataGrid, type DataGridColumn, type BaseRowData } from 'sofisoft-data-grid';
import 'sofisoft-data-grid/styles.css';

// Define your data type
interface Employee extends BaseRowData {
  name: string;
  email: string;
  department: string;
  salary: number;
  startDate: string;
  status: string;
}

// Sample data
const data: Employee[] = [
  { id: 1, name: 'John Smith', email: 'john@company.com', department: 'Engineering', salary: 95000, startDate: '2021-03-15', status: 'Active' },
  { id: 2, name: 'Sarah Johnson', email: 'sarah@company.com', department: 'Marketing', salary: 78000, startDate: '2020-07-22', status: 'Active' },
  // ... more data
];

// Define columns
const columns: DataGridColumn<Employee>[] = [
  { field: 'name', headerName: 'Name', width: 180 },
  { field: 'email', headerName: 'Email', width: 220 },
  { 
    field: 'department', 
    headerName: 'Department', 
    width: 140,
    cellType: 'dropdown',
    options: ['Engineering', 'Marketing', 'Sales', 'HR']
  },
  { field: 'salary', headerName: 'Salary', width: 120, aggregate: 'sum' },
  { field: 'startDate', headerName: 'Start Date', width: 120 },
  { 
    field: 'status', 
    headerName: 'Status', 
    width: 100,
    cellType: 'dropdown',
    options: ['Active', 'On Leave', 'Terminated']
  },
];

function App() {
  const handleSave = async (data: Employee[]) => {
    console.log('Saving:', data);
    // Your API call here
  };

  const validate = (row: Employee) => {
    if (!row.name?.trim()) {
      return { field: 'name', message: 'Name is required' };
    }
    return null;
  };

  const createEmptyRow = () => ({
    name: '',
    email: '',
    department: '',
    salary: 0,
    startDate: new Date().toISOString().split('T')[0],
    status: 'Active',
  });

  return (
    <div style={{ height: '100vh' }}>
      <DataGrid
        data={data}
        columns={columns}
        onSave={handleSave}
        validate={validate}
        createEmptyRow={createEmptyRow}
        pagination={true}
        pageSize={10}
        enableSearch={true}
        enableExport={true}
        showStatusBar={true}
        themeMode="dark"
      />
    </div>
  );
}
```

## 📖 Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `T[]` | **required** | Array of data objects |
| `columns` | `DataGridColumn<T>[]` | **required** | Column definitions |
| `onSave` | `(data: T[]) => Promise<void>` | **required** | Save handler |
| `validate` | `(row: T) => ValidationError \| null` | **required** | Row validation function |
| `createEmptyRow` | `() => Omit<T, 'id'>` | **required** | Factory for new rows |
| `toolbar` | `'floating' \| 'top' \| 'bottom' \| 'none'` | `'floating'` | Toolbar position |
| `pagination` | `boolean` | `false` | Enable pagination |
| `pageSize` | `number` | `10` | Rows per page |
| `pageSizeOptions` | `number[]` | `[10, 25, 50, 100]` | Page size options |
| `enableSearch` | `boolean` | `true` | Enable search |
| `enableExport` | `boolean` | `true` | Enable CSV export |
| `enableHistory` | `boolean` | `true` | Enable undo/redo |
| `enableColumnReorder` | `boolean` | `true` | Enable column reordering |
| `enableColumnPinning` | `boolean` | `true` | Enable column pinning |
| `showStatusBar` | `boolean` | `true` | Show status bar |
| `themeMode` | `'dark' \| 'light'` | `'dark'` | Theme mode |
| `onChange` | `(data: T[]) => void` | - | Data change callback |
| `onSelectionChange` | `(rows: T[]) => void` | - | Selection change callback |

## 📋 Column Definition

```tsx
interface DataGridColumn<T> {
  field: keyof T;              // Field name from data
  headerName: string;          // Display name
  width?: number;              // Column width
  editable?: boolean;          // Allow editing (default: true)
  pinned?: 'left' | 'right';   // Pin column
  hidden?: boolean;            // Hide column
  cellType?: 'text' | 'dropdown' | 'action';
  options?: string[];          // For dropdown type
  aggregate?: 'sum' | 'count' | 'avg' | 'min' | 'max';
  actions?: ActionConfig[];    // For action type
}
```

## 🎯 Action Cells

```tsx
{
  field: 'actions',
  headerName: 'Actions',
  width: 130,
  cellType: 'action',
  editable: false,
  actions: [
    {
      label: 'View',
      icon: 'view',  // 'view' | 'edit' | 'delete' | 'copy' | 'download' | 'settings' | 'add' | 'check' | 'close'
      onClick: (row) => console.log('View:', row),
      variant: 'primary',  // 'default' | 'primary' | 'danger' | 'success' | 'warning'
    },
    {
      label: 'Delete',
      icon: 'delete',
      onClick: (row) => handleDelete(row),
      variant: 'danger',
      hidden: (row) => row.status === 'Terminated',  // Conditionally hide
    },
  ],
}
```

## 🎨 Custom Styling

Override CSS variables to customize the theme:

```css
:root {
  --gdg-accent: #667eea;
  --gdg-accent-light: rgba(102, 126, 234, 0.2);
  --gdg-text: #e0e0e0;
  --gdg-text-muted: #b0b0b0;
  --gdg-bg: #181d1f;
  --gdg-bg-cell: #1a1f21;
  --gdg-bg-header: #21272a;
  --gdg-border: #2d3436;
  --gdg-danger: #e74c3c;
  --gdg-success: #27ae60;
}
```

## 🔧 Ref API

Access grid methods programmatically:

```tsx
const gridRef = useRef<DataGridRef<Employee>>(null);

// Available methods
gridRef.current?.addRow();
gridRef.current?.deleteSelected();
gridRef.current?.save();
gridRef.current?.undo();
gridRef.current?.redo();
gridRef.current?.exportCSV('filename.csv');
gridRef.current?.openSearch();
gridRef.current?.clearFilters();
gridRef.current?.getData();
gridRef.current?.getSelectedRows();
```

## 📄 License

MIT © [sofisoft-packages]

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 🙏 Acknowledgments

Built on top of the amazing [Glide Data Grid](https://github.com/glideapps/glide-data-grid) by Glide.
