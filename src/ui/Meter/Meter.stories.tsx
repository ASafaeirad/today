import { expect, within } from "storybook/test";

import { StoryMatrix } from "#storybook/matrix";
import preview from "#storybook/preview";

import {
  Meter,
  MeterIndicator,
  MeterLabel,
  MeterTrack,
  MeterValue,
  type MeterProps,
} from "./Meter.tsx";

const meta = preview.meta({ component: Meter });

const tones = ["ink", "done", "missed", "skipped", "seal"] satisfies MeterProps["tone"][];

export const Matrix = meta.story({
  render: () => (
    <StoryMatrix
      columns={[{ label: "Empty" }, { label: "Partial" }, { label: "Full" }]}
      rows={tones}
      cell={({ row, col }) => (
        <Meter
          tone={row as MeterProps["tone"]}
          value={col === "Empty" ? 0 : col === "Partial" ? 62 : 100}
          aria-label={`${row} ${col.toLowerCase()}`}
          className="w-48"
        >
          <MeterTrack>
            <MeterIndicator />
          </MeterTrack>
        </Meter>
      )}
    />
  ),
});

export const Sealing = meta.story({
  render: () => (
    <Meter value={100} className="w-72 text-center">
      <MeterTrack>
        <MeterIndicator animated />
      </MeterTrack>
      <MeterLabel>record locked</MeterLabel>
      <MeterValue />
    </Meter>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // `role="meter"` is only useful if the reading is attached to a name, and
    // a `MeterLabel` is the one the meter should take when it has one.
    await expect(canvas.getByRole("meter", { name: "record locked" })).toHaveAttribute(
      "aria-valuenow",
      "100",
    );
  },
});
