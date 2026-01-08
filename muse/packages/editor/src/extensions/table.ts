import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";

export interface TableOptions {
  resizable?: boolean;
  cellMinWidth?: number;
}

export const tableExtensions = (options: TableOptions = {}) => [
  Table.configure({
    resizable: options.resizable ?? true,
    cellMinWidth: options.cellMinWidth ?? 100,
  }),
  TableRow,
  TableHeader,
  TableCell,
];

export { Table, TableRow, TableHeader, TableCell };
