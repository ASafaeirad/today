import { useState } from "react";

import preview from "#storybook/preview";

import { Kbd } from "../Kbd/Kbd.tsx";
import { Toggle, ToggleGroup } from "../Toggle/Toggle.tsx";
import { Row, RowActions, RowHeader, RowIndex, RowName, RowStatus, type RowProps } from "./Row.tsx";

const meta = preview.meta({
  component: Row,
  parameters: { layout: "fullscreen" },
});

const OPS = [
  { value: "done", key: "D" },
  { value: "missed", key: "M" },
  { value: "skipped", key: "S" },
] as const;

const RECORDS = [
  { name: "Wake by 7", status: "done" },
  { name: "Stretch", status: "missed" },
  { name: "Read 20 min", status: "skipped" },
  { name: "Walk", status: "open" },
  { name: "Water x8", status: "open" },
] satisfies { name: string; status: NonNullable<RowProps["status"]> }[];

export const Matrix = meta.story({
  render: () => {
    const [current, setCurrent] = useState(3);
    const [states, setStates] = useState(RECORDS.map((record) => record.status));

    return (
      <div>
        <RowHeader className="hidden sm:grid">
          <span>#</span>
          <span>routine</span>
          <span>state</span>
          <span className="justify-self-end">set</span>
        </RowHeader>
        {RECORDS.map((record, index) => {
          const status = states[index]!;

          return (
            <Row
              key={record.name}
              status={status}
              current={index === current}
              onFocusCapture={() => setCurrent(index)}
            >
              <RowIndex>{String(index + 1).padStart(2, "0")}</RowIndex>
              <RowName>{record.name}</RowName>
              <RowStatus typed>{status === "open" ? "open" : status}</RowStatus>
              <RowActions>
                <ToggleGroup
                  className="justify-stretch sm:justify-end"
                  value={status === "open" ? [] : [status]}
                  onValueChange={(next) => {
                    setStates((previous) =>
                      previous.map((value, i) =>
                        i === index ? ((next[0] ?? "open") as typeof value) : value,
                      ),
                    );
                  }}
                >
                  {OPS.map((op) => (
                    <Toggle
                      key={op.value}
                      value={op.value}
                      tone={op.value}
                      variant="embedded"
                      aria-label={op.value}
                      className="min-h-13 flex-1 sm:min-h-7 sm:flex-none"
                    >
                      <Kbd variant="hint">{op.key}</Kbd>
                      {op.value}
                    </Toggle>
                  ))}
                </ToggleGroup>
              </RowActions>
            </Row>
          );
        })}
      </div>
    );
  },
});

export const States = meta.story({
  render: () => (
    <div>
      {(["open", "done", "missed", "skipped"] as const).map((status, index) => (
        <Row key={status} status={status} current={status === "open"}>
          <RowIndex>{String(index + 1).padStart(2, "0")}</RowIndex>
          <RowName>Read 20 min</RowName>
          <RowStatus>{status}</RowStatus>
          <RowActions className="text-right text-muted-foreground">—</RowActions>
        </Row>
      ))}
    </div>
  ),
});
