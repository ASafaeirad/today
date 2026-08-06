import { useState, useEffect } from "react";

import { StoryMatrix } from "#storybook/matrix";
import preview from "#storybook/preview";

import {
  CircularProgressRoot,
  CircularProgressIndicator,
  CircularProgressRange,
  CircularProgressTrack,
  CircularProgressValueText,
} from "./CircleProgress";

const meta = preview.meta({
  component: CircularProgressRoot,
});

function Circle({ value, size }: { value: number | null; size: number }) {
  return (
    <CircularProgressRoot value={value} size={size}>
      <CircularProgressIndicator>
        <CircularProgressTrack />
        <CircularProgressRange />
      </CircularProgressIndicator>
      <CircularProgressValueText />
    </CircularProgressRoot>
  );
}

export const Default = meta.story({
  render: () => {
    const [value, setValue] = useState(0);

    useEffect(() => {
      const interval = setInterval(() => {
        setValue((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + 2;
        });
      }, 150);
      return () => clearInterval(interval);
    }, []);

    return <Circle value={value} size={80} />;
  },
});

const sizes = [40, 60, 80, 100, 120] as const;
const values = [0, 25, 50, 75, 100] as const;

export const Matrix = meta.story({
  render: () => (
    <StoryMatrix
      columns={sizes.map((s) => ({ label: `${s}px` }))}
      rows={[...values.map((v) => `${v}%`), "Indeterminate"]}
      cell={({ row, col }) => {
        const size = parseInt(col);
        const value = row === "Indeterminate" ? null : parseInt(row);
        return <Circle value={value} size={size} />;
      }}
    />
  ),
});
