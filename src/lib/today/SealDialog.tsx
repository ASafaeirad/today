import { useHotkeys } from "@tanstack/react-hotkeys";
import { useEffect, useRef } from "react";

import type { Outcome } from "#domain/outcome";

import {
  BarItem,
  BarSpacer,
  Button,
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Kbd,
  Panel,
  Row,
  RowIndex,
  RowName,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Text,
} from "#ui";

import type { DayView, RosterEntry } from "./ledger";
import type { SealCeremony } from "./useSealCeremony";

import { OPS, pad, rowStatus, type BalanceView } from "./console";
import { BalanceItem } from "./ConsoleChrome";

/**
 * The ceremony, in two acts: resolve every open line one at a time, then read
 * the record back and lock it. Nothing is written to the day until the lock, so
 * escape at any point leaves it exactly as open as it was.
 */
export function SealDialog({
  seal,
  balance,
}: {
  seal: SealCeremony;
  balance: BalanceView | undefined;
}) {
  const { day } = seal;
  const resolving = seal.stage === "resolve";
  const total = day?.roster.length ?? 0;
  // The last word answers to the return key, so the return key has to land on
  // it — not on whatever the dialog would otherwise focus first.
  const lockRef = useRef<HTMLButtonElement>(null);

  return (
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) seal.cancel();
      }}
    >
      <DialogContent
        className="flex items-end justify-center bg-transparent p-3 data-open:animate-cut sm:items-center sm:p-6"
        initialFocus={resolving ? undefined : lockRef}
      >
        <Panel className="max-h-full w-full max-w-115 bg-background">
          <DialogHeader>
            <span className="px-2.5 py-1.25">SEAL {seal.date}</span>
            <span className="px-2.5 py-1.25">
              {day === undefined
                ? "OPENING"
                : resolving
                  ? `RESOLVE · ${seal.pending.length} LEFT`
                  : "LOCK · FINAL"}
            </span>
          </DialogHeader>
          {day === undefined ? (
            <DialogBody aria-busy="true">
              <DialogTitle>seal --open</DialogTitle>
              <DialogDescription>reading the record ...</DialogDescription>
            </DialogBody>
          ) : resolving ? (
            <ResolveStage seal={seal} day={day} total={total} balance={balance} />
          ) : (
            <LockStage seal={seal} day={day} lockRef={lockRef} />
          )}
        </Panel>
      </DialogContent>
    </Dialog>
  );
}

function Refusal({ text }: { text: string | null }) {
  if (text === null) return null;
  return (
    <Text as="p" tone="record" className="tone-missed mt-2.5" role="alert">
      ! {text}
    </Text>
  );
}

interface StageProps {
  seal: SealCeremony;
  day: DayView;
}

/**
 * Act one: the same three letters the row toggles use, one line at a time. The
 * skip bank stands in the footer because S spends it here, and the day cannot
 * seal until every line has a verdict — an owner about to discover the bank is
 * empty should see it running down rather than meet it as a refusal.
 */
function ResolveStage({
  seal,
  day,
  total,
  balance,
}: StageProps & { total: number; balance: BalanceView | undefined }) {
  useHotkeys(
    OPS.map((op) => ({ hotkey: op.key, callback: () => seal.resolve(op.value) })),
    { enabled: seal.pending.length > 0 },
  );

  return (
    <>
      <DialogBody className="max-w-none">
        <DialogTitle className="mb-1.5">resolve --interactive</DialogTitle>
        <DialogDescription className="mb-2">
          nothing seals until every line has a verdict.
        </DialogDescription>
        <div className="no-scrollbar mb-2.5 max-h-55 overflow-x-hidden overflow-y-auto border border-border">
          {seal.pending.map((entry, index) => (
            <PendingRow key={entry.instanceId} day={day} entry={entry} current={index === 0} />
          ))}
        </div>
        <div className="joined flex">
          {OPS.map((op) => (
            <Button
              key={op.value}
              size="lg"
              className="min-h-12 flex-1"
              onClick={() => seal.resolve(op.value)}
            >
              <Kbd variant="hint">{op.key}</Kbd>
              {op.value}
            </Button>
          ))}
        </div>
        <Refusal text={seal.refusal} />
      </DialogBody>
      <DialogFooter>
        <DialogClose render={<Button variant="ghost">esc — nothing locked</Button>} />
        <BarSpacer />
        <BalanceItem balance={balance} />
        <BarItem tone="muted" divided={false}>
          {total - seal.pending.length}/{total}
        </BarItem>
      </DialogFooter>
    </>
  );
}

interface PendingRowProps {
  day: DayView;
  entry: RosterEntry;
  current: boolean;
}

function PendingRow({ day, entry, current }: PendingRowProps) {
  return (
    <Row layout="queue" status="open" current={current}>
      <RowIndex>{pad(day.roster.indexOf(entry) + 1)}</RowIndex>
      <RowName>{entry.name}</RowName>
    </Row>
  );
}

function tally(day: DayView, outcome: Outcome): number {
  return day.roster.filter((entry) => rowStatus(entry) === outcome).length;
}

interface LockStageProps extends StageProps {
  lockRef: React.RefObject<HTMLButtonElement | null>;
}

/** Act two: the record as it will stand for good, and the last word on it. */
function LockStage({ seal, day, lockRef }: LockStageProps) {
  // Reached by resolving the last line, the stage swaps under a focus that was
  // on a button which no longer exists. The return key has one target here.
  useEffect(() => {
    lockRef.current?.focus();
  }, [lockRef]);

  return (
    <>
      <DialogBody className="max-w-none">
        <DialogTitle className="mb-1.5">seal --final</DialogTitle>
        <Table>
          <TableBody>
            {day.roster.map((entry, index) => {
              const status = rowStatus(entry);
              return (
                <TableRow key={entry.instanceId}>
                  <TableCell tone="neutral">{pad(index + 1)}</TableCell>
                  <TableCell>{entry.name}</TableCell>
                  <TableCell tone={status === "open" ? "neutral" : status} align="end">
                    {status.toUpperCase()}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <Text tone="record" className="mt-2.5 block">
          {tally(day, "done")} done / {tally(day, "missed")} missed / {tally(day, "skipped")}{" "}
          skipped
        </Text>
        <Text tone="record" className="tone-missed mt-2.5 block">
          ! LOCK IS IRREVERSIBLE. THE DAY CANNOT BE REOPENED.
        </Text>
        <Refusal text={seal.refusal} />
      </DialogBody>
      <DialogFooter>
        <DialogClose
          render={
            <Button variant="ghost">
              <Kbd>ESC</Kbd>
              cancel
            </Button>
          }
        />
        <BarSpacer />
        <Button
          ref={lockRef}
          variant="accent"
          className="border-l border-border"
          loading={seal.locking}
          onClick={() => seal.lock()}
        >
          <Kbd>&#8629;</Kbd>
          LOCK
        </Button>
      </DialogFooter>
    </>
  );
}
