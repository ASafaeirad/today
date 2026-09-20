import { useId } from "react";

import type { MarkOutcome } from "#domain/outcome";

import { cn } from "#lib/cn";
import { Kbd, Row, RowActions, RowIndex, RowName, RowStatus, Text, Toggle, ToggleGroup } from "#ui";

import { OPS, pad, type RowStatus as Status } from "./console";

interface Props {
  index: number;
  name: string;
  status: Status;
  current: boolean;
  /** A sealed day is read-only: the keys still print, they just no longer work. */
  sealed: boolean;
  /**
   * Whether this line is showing Experience it has not banked. True of a done
   * mark on a day that is still open, and of nothing else: the point goes back
   * the moment the mark changes.
   */
  pending: boolean;
  /**
   * Whether the three keys are open under this line. A pointer has room to
   * carry them on every row at once; a thumb gets them one row at a time, and
   * the line itself is what opens them.
   */
  open: boolean;
  onFocus: () => void;
  onOpen: () => void;
  onMark: (outcome: MarkOutcome) => void;
  ref?: React.Ref<HTMLDivElement>;
}

export function RosterRow({
  index,
  name,
  status,
  current,
  sealed,
  pending,
  open,
  onFocus,
  onOpen,
  onMark,
  ref,
}: Props) {
  const opsId = useId();

  return (
    <Row ref={ref} status={status} current={current && !sealed} onFocusCapture={onFocus}>
      <RowIndex>{pad(index + 1)}</RowIndex>
      <span className="flex min-w-0 items-baseline gap-2.5">
        <RowName>{name}</RowName>
        {pending ? (
          <Text size="xs" className="tone-done tone-fg animate-cut whitespace-nowrap">
            +1 xp
          </Text>
        ) : null}
      </span>
      {/* Keyed on the status so a change lands as a typed word, not a swap. */}
      <RowStatus key={status} typed>
        {status}
      </RowStatus>
      {sealed ? (
        <RowActions className="hidden sm:block">
          <Text tone="subtle" size="xs" className="block text-right">
            locked
          </Text>
        </RowActions>
      ) : (
        <>
          {/* The whole line, as one target, over the width a phone reads it at.
              It is the only control here the pointer never sees: the keys it
              opens are already on the line above the fold on a wider screen. */}
          <button
            type="button"
            aria-expanded={open}
            aria-controls={opsId}
            onClick={onOpen}
            className="absolute inset-x-0 top-0 h-12.5 sm:hidden"
          >
            <span className="sr-only">mark {name}</span>
          </button>
          <RowActions id={opsId} className={cn("sm:block", { hidden: !open })}>
            <ToggleGroup
              className="justify-stretch sm:justify-end"
              aria-label={`${name} outcome`}
              value={status === "open" ? [] : [status]}
              onValueChange={(next) => onMark((next[0] as MarkOutcome | undefined) ?? null)}
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
                  <Kbd variant="hint" className="hidden sm:inline">
                    {op.key}
                  </Kbd>
                  {op.value}
                </Toggle>
              ))}
            </ToggleGroup>
          </RowActions>
        </>
      )}
    </Row>
  );
}
