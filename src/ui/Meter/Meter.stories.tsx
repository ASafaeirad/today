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
    <Meter value={100} className="w-72 text-center" aria-label="Sealing record">
      <MeterTrack>
        <MeterIndicator animated />
      </MeterTrack>
      <MeterLabel>record locked</MeterLabel>
      <MeterValue />
    </Meter>
  ),
});
