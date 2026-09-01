// oxlint-disable react/no-array-index-key
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
            <th scope="col" rowSpan={withSubs ? 2 : undefined} className="border border-border">
              <span className="sr-only">Variant</span>
            </th>
            {columns.map((col) => {
              const subColumnCount = col.subColumns?.length ?? 0;

              return (
                <th
                  key={col.label}
                  scope={subColumnCount > 0 ? "colgroup" : "col"}
                  colSpan={subColumnCount || undefined}
                  rowSpan={withSubs && subColumnCount === 0 ? 2 : undefined}
                  className="border border-border px-6 py-2.5 text-center text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
                >
                  {col.label}
                </th>
              );
            })}
          </tr>
          {withSubs && (
            <tr>
              {columns.flatMap((col) =>
                col.subColumns?.map((subCol, index) => (
                  <th
                    key={`${col.label}-${subCol}-${index}`}
                    scope="col"
                    className="border border-border px-6 py-2 text-center text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70"
                  >
                    {subCol}
                  </th>
                )),
              )}
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
