import { useState } from "react";

import { StoryMatrix } from "#storybook/matrix";
import preview from "#storybook/preview";

import { Label } from "../Label/Label";
import { Slider } from "./Slider";

const meta = preview.meta({
  component: Slider,
});

const stateProps = {
  Default: {},
  Disabled: { disabled: true },
};

export const Matrix = meta.story({
  render: () => (
    <StoryMatrix
      columns={[{ label: "Horizontal" }, { label: "Vertical" }]}
      rows={Object.keys(stateProps)}
      cell={({ row, col }) => {
        const props = stateProps[row as keyof typeof stateProps];
        return col === "Horizontal" ? (
          <Slider defaultValue={[60]} max={100} step={1} className="w-40" {...props} />
        ) : (
          <Slider
            defaultValue={[60]}
            max={100}
            step={1}
            orientation="vertical"
            className="h-24"
            {...props}
          />
        );
      }}
    />
  ),
});

export const Range = meta.story({
  render: () => {
    const [value, setValue] = useState([0.3, 0.7]);

    return (
      <div className="mx-auto grid min-w-md gap-3">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="slider-range">Range</Label>
          <span className="text-sm text-muted-foreground">{value.join(", ")}</span>
        </div>
        <Slider
          id="slider-range"
          value={value}
          onValueChange={(value) => setValue(value as number[])}
          min={0}
          max={1}
          step={0.1}
        />
      </div>
    );
  },
});
