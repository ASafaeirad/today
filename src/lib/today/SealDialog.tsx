import { useHotkeys } from "@tanstack/react-hotkeys";
import { useEffect, useRef } from "react";

import type { Outcome } from "#domain/outcome";

import { cn } from "#lib/cn";
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
  Meter,
  MeterIndicator,
  MeterTrack,
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
import {
  bandNote,
  bankedTotal,
  HELD_NOTE,
  levelUpLine,
  levelView,
  leveledUp,
  receiptLines,
  RESET_NOTE,
  type ReceiptView,
} from "./experience";

const STAGE_LABEL = {
  resolve: "RESOLVE",
  lock: "LOCK · FINAL",
  receipt: "BANKED",
} as const;

/**
 * The ceremony, in three acts: resolve every open line one at a time, read the
 * record back and lock it, then read what the lock banked. Nothing is written
 * to the day until the lock, so escape at either of the first two leaves it
 * exactly as open as it was.
 *
 * The receipt is a stage of this dialog rather than a second one. A level-up
 * expands it instead of stacking another box over a day that is already closed:
 * the milestone is the same event, told louder.
 */
export function SealDialog({
  seal,
  balance,
}: {
  seal: SealCeremony;
  balance: BalanceView | undefined;
}) {
  const { day, receipt } = seal;
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
        initialFocus={resolving && seal.receipt === null ? undefined : lockRef}
      >
        <Panel className="max-h-full w-full max-w-115 bg-background">
          <DialogHeader>
            <span className="px-2.5 py-1.25">
              {receipt === null ? "SEAL" : "SEALED"} {seal.date}
            </span>
            <span className="px-2.5 py-1.25">
              {day === undefined
                ? "OPENING"
                : resolving
                  ? `${STAGE_LABEL.resolve} · ${seal.pending.length} LEFT`
                  : STAGE_LABEL[seal.stage]}
            </span>
          </DialogHeader>
          {receipt !== null ? (
            <ReceiptStage receipt={receipt} onClose={() => seal.cancel()} closeRef={lockRef} />
          ) : day === undefined ? (
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

const LINE_TONE = {
  done: "tone-done tone-fg",
  seal: "tone-seal tone-fg",
  skipped: "tone-skipped tone-fg",
  muted: "text-muted-foreground",
} as const;

interface ReceiptStageProps {
  receipt: ReceiptView;
  onClose: () => void;
  closeRef: React.RefObject<HTMLButtonElement | null>;
}

/**
 * Act three: the reward, itemised. What the marks earned, what closing earned,
 * what the run multiplied it by, and what settling an older day released.
 *
 * A broken run gets a line and a note rather than a smaller number in red: the
 * ten points for closing are still banked, which is the whole reason the day
 * was worth facing. A level-up expands this same receipt with a band above it.
 */
function ReceiptStage({ receipt, onClose, closeRef }: ReceiptStageProps) {
  const level = levelView(receipt.experienceAfter);

  useEffect(() => {
    closeRef.current?.focus();
  }, [closeRef]);

  return (
    <>
      {leveledUp(receipt) ? (
        <div className="flex animate-cut flex-col gap-1 border-b border-border bg-inverted px-3 py-3.5 text-inverted-foreground">
          {/* The band has already set the ink it inverts to; every line in it
              takes that rather than painting itself back to the body colour. */}
          <Text tone="inherit" size="xs" tracking="widest" caps className="opacity-70">
            {levelUpLine(receipt)}
          </Text>
          <Text tone="inherit" size="xl" tracking="brand" caps>
            LV {level.plate} · {level.title}
          </Text>
          <Text tone="inherit" size="xs" className="opacity-70">
            {bandNote(level.level)}
          </Text>
        </div>
      ) : null}
      <DialogBody className="max-w-none">
        <DialogTitle className="mb-1.5">bank --receipt {receipt.date}</DialogTitle>
        <div className="border-t border-border">
          {receiptLines(receipt).map((line) => (
            <div
              key={line.id}
              className="flex items-baseline justify-between gap-3.5 border-b border-border py-1.5"
            >
              <Text size="xs" tone="muted" tracking="widest" caps>
                {line.label}
              </Text>
              <Text size="sm" className={cn(LINE_TONE[line.tone], "whitespace-nowrap")}>
                {line.value}
              </Text>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-3.5 py-2.25">
            <Text size="xs" tracking="widest" caps>
              banked
            </Text>
            <Text size="lg" tracking="wider" caps>
              {bankedTotal(receipt)}
            </Text>
          </div>
        </div>
        {receipt.reset ? <ReceiptNote text={RESET_NOTE} /> : null}
        {receipt.held ? <ReceiptNote text={HELD_NOTE} tone="skipped" /> : null}
        <div className="mt-2.5 flex items-center gap-2.25">
          <Meter
            tone="ink"
            value={level.percent}
            aria-label={`level ${level.level}, ${level.into} of ${level.span} experience to level ${level.level + 1}`}
          >
            <MeterTrack className="h-2">
              <MeterIndicator animated />
            </MeterTrack>
          </Meter>
          <Text size="xs" tone="muted" className="whitespace-nowrap">
            {level.spanLine}
          </Text>
        </div>
      </DialogBody>
      <DialogFooter>
        <BarItem tone="muted" divided={false}>
          {level.lifetimeLine}
        </BarItem>
        <BarSpacer />
        <Button
          ref={closeRef}
          variant="accent"
          className="border-l border-border"
          onClick={onClose}
        >
          <Kbd>&#8629;</Kbd>
          CLOSE
        </Button>
      </DialogFooter>
    </>
  );
}

/** A sentence beside the numbers, for the two cases that owe an explanation. */
function ReceiptNote({ text, tone }: { text: string; tone?: "skipped" }) {
  return (
    <div
      className={cn(
        "mt-1 border border-border px-2.25 py-2",
        tone === "skipped" ? "tone-skipped tone-tint" : "bg-chrome",
      )}
    >
      <Text size="xs" tone="muted">
        {text}
      </Text>
    </div>
  );
}
