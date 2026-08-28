import preview from "#storybook/preview";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  type TableCellProps,
} from "./Table.tsx";

const meta = preview.meta({ component: Table });

const RECAP = [
  { name: "Wake by 7", state: "done" },
  { name: "Stretch", state: "missed" },
  { name: "Read 20 min", state: "done" },
  { name: "Walk", state: "skipped" },
  { name: "Water x8", state: "done" },
] satisfies { name: string; state: NonNullable<TableCellProps["tone"]> }[];

export const Matrix = meta.story({
  render: () => (
    <Table className="w-96">
      <TableHeader>
        <TableRow>
          <TableHead>#</TableHead>
          <TableHead>routine</TableHead>
          <TableHead className="text-right">state</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {RECAP.map((record, index) => (
          <TableRow key={record.name}>
            <TableCell tone="neutral">{String(index + 1).padStart(2, "0")}</TableCell>
            <TableCell>{record.name}</TableCell>
            <TableCell tone={record.state} align="end">
              {record.state.toUpperCase()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
});
