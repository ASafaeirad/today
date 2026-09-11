import type { Outcome } from "#domain/outcome";

import { Kbd, Row, RowActions, RowIndex, RowName, RowStatus, Toggle, ToggleGroup } from "#ui";

import { OPS, pad, type RowStatus as Status } from "./console";

interface Props {
  index: number;
  name: string;
  status: Status;
  current: boolean;
  /** A sealed day is read-only: the keys still print, they just no longer work. */
  sealed: boolean;
  onFocus: () => void;
  onMark: (outcome: Outcome | null) => void;
  ref?: React.Ref<HTMLDivElement>;
}

export function RosterRow({ index, name, status, current, sealed, onFocus, onMark, ref }: Props) {
  return (
    <Row ref={ref} status={status} current={current && !sealed} onFocusCapture={onFocus}>
      <RowIndex>{pad(index + 1)}</RowIndex>
      <RowName>{name}</RowName>
      {/* Keyed on the status so a change lands as a typed word, not a swap. */}
      <RowStatus key={status} typed>
        {status}
      </RowStatus>
      <RowActions>
        <ToggleGroup
          className="justify-stretch sm:justify-end"
          aria-label={`${name} outcome`}
          disabled={sealed}
          value={status === "open" ? [] : [status]}
          onValueChange={(next) => onMark((next[0] as Outcome | undefined) ?? null)}
        >
          {OPS.map((op) => (
            <Toggle
              key={op.value}
              value={op.value}
              tone={op.value}
              aria-label={op.value}
              disabled={sealed}
              className="flex-1 sm:flex-none"
            >
              <Kbd variant="hint">{op.key}</Kbd>
              {op.value}
            </Toggle>
          ))}
        </ToggleGroup>
      </RowActions>
    </Row>
  );
}
