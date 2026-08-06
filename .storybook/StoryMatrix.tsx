import type React from "react";

import { cn } from "#lib/cn";

interface Column {
  label: string;
  subColumns?: string[];
}

interface CellParams {
  row: string;
  col: string;
  subCol: string;
}

interface StoryMatrixProps {
  columns: Column[];
  rows: string[];
  cell: (params: CellParams) => React.ReactNode;
  className?: string;
}

const hasSubColumns = (columns: Column[]) => columns.some((c) => c.subColumns?.length);

const flattenColumns = (columns: Column[]) =>
  columns.flatMap((col) =>
    col.subColumns?.length
      ? col.subColumns.map((sub) => ({ col: col.label, subCol: sub }))
      : [{ col: col.label, subCol: col.label }],
  );

export function StoryMatrix({ columns, rows, cell, className }: StoryMatrixProps) {
  const flat = flattenColumns(columns);
  const withSubs = hasSubColumns(columns);

  return (
    <div className={cn("overflow-auto", className)}>
      <table className="border-collapse">
        <thead>
          <tr>
            <th className="border border-border" />
            {columns.map((col) => (
              <th
                key={col.label}
                colSpan={col.subColumns?.length ?? 1}
                className="border border-border px-6 py-2.5 text-center text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
              >
                {col.label}
              </th>
            ))}
          </tr>
          {withSubs && (
            <tr>
              <th className="border border-border" />
              {flat.map(({ col, subCol }, i) => (
                <th
                  key={`${col}-${subCol}-${i}`}
                  className="border border-border px-6 py-2 text-center text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70"
                >
                  {subCol !== col ? subCol : ""}
                </th>
              ))}
            </tr>
          )}
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row}>
              <td className="border border-border px-5 py-4 text-[10px] font-semibold uppercase tracking-widest whitespace-nowrap text-muted-foreground">
                {row}
              </td>
              {flat.map(({ col, subCol }, i) => (
                <td key={`${row}-${col}-${subCol}-${i}`} className="border border-border p-5">
                  <div className="flex items-center justify-center">
                    {cell({ row, col, subCol })}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
