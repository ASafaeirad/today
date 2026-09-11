import { valibotResolver } from "@hookform/resolvers/valibot";
import { useHotkey, useHotkeys } from "@tanstack/react-hotkeys";
import { useForm } from "react-hook-form";
import * as v from "valibot";

import type { Outcome } from "#domain/outcome";

import {
  Button,
  ButtonGroup,
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldError,
  FieldLabel,
  Input,
  Kbd,
  Meter,
  MeterIndicator,
  MeterLabel,
  MeterTrack,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Text,
} from "#ui";

import type { DayView, RosterEntry } from "./DayScreen";

import { OPS, errorText, pad, rowStatus } from "./console";

export type SealStage = "resolve" | "recap" | "note" | "sealed";

interface Props {
  day: DayView;
  /** Where the ceremony is, as requested; `resolve` falls through once nothing is open. */
  stage: SealStage;
  open: boolean;
  onStage: (stage: SealStage) => void;
  onMark: (entry: RosterEntry, outcome: Outcome) => void;
  onLock: (note: string) => Promise<void>;
  /** Escape, the backdrop, or RETURN after the lock. */
  onClose: () => void;
}

function Cell({ children, tone }: { children: React.ReactNode; tone?: Outcome | "neutral" }) {
  return (
    <TableCell tone={tone ?? "inherit"} align={tone && tone !== "neutral" ? "end" : "start"}>
      {children}
    </TableCell>
  );
}

export function SealDialog({ day, stage, open, onStage, onMark, onLock, onClose }: Props) {
  const openRows = day.roster.filter((entry) => rowStatus(entry) === "open");
  const effective: SealStage = stage === "resolve" && openRows.length === 0 ? "recap" : stage;
  const next = openRows[0];

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DialogContent aria-label={`Seal ${day.date}`}>
        <DialogHeader>
          <span className="px-2.5 py-1.25">SEAL {day.date}</span>
          <span className="px-2.5 py-1.25">
            {effective === "resolve" && `STAGE 1/3 · RESOLVE · ${openRows.length} LEFT`}
            {effective === "recap" && "STAGE 2/3 · RECAP · READ ONLY"}
            {effective === "note" && "STAGE 3/3 · NOTE · REQUIRED"}
            {effective === "sealed" && "SEALED"}
          </span>
        </DialogHeader>
        {effective === "resolve" && next && (
          <ResolveStage day={day} next={next} open={open} onMark={onMark} />
        )}
        {effective === "recap" && <RecapStage day={day} open={open} onStage={onStage} />}
        {effective === "note" && <NoteStage onLock={onLock} />}
        {effective === "sealed" && <SealedStage day={day} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

interface ResolveStageProps {
  day: DayView;
  next: RosterEntry;
  open: boolean;
  onMark: (entry: RosterEntry, outcome: Outcome) => void;
}

/** Stage 1: the same three letters the row toggles use, one cell at a time. */
function ResolveStage({ day, next, open, onMark }: ResolveStageProps) {
  useHotkeys(
    [
      { hotkey: "D", callback: () => onMark(next, "done") },
      { hotkey: "M", callback: () => onMark(next, "missed") },
      { hotkey: "S", callback: () => onMark(next, "skipped") },
    ],
    { enabled: open },
  );

  return (
    <>
      <DialogBody>
        <DialogTitle>resolve --interactive</DialogTitle>
        <DialogDescription className="mb-3">
          line {pad(day.roster.indexOf(next) + 1)} <Text tone="inverted">{next.name}</Text>
        </DialogDescription>
        <ButtonGroup attached={false} aria-label={`${next.name} outcome`}>
          {OPS.map((op) => (
            <Button key={op.value} size="lg" onClick={() => onMark(next, op.value)}>
              <Kbd variant="hint">{op.key}</Kbd>
              {op.value}
            </Button>
          ))}
        </ButtonGroup>
      </DialogBody>
      <DialogFooter>
        <DialogClose
          render={
            <Button variant="ghost">
              <Kbd>ESC</Kbd>
              cancel — nothing locked
            </Button>
          }
        />
      </DialogFooter>
    </>
  );
}

interface RecapStageProps {
  day: DayView;
  open: boolean;
  onStage: (stage: SealStage) => void;
}

/** Stage 2: read the recap, then commit to writing the note. */
function RecapStage({ day, open, onStage }: RecapStageProps) {
  useHotkey("Enter", () => onStage("note"), { enabled: open });

  const counts = {
    done: day.roster.filter((entry) => rowStatus(entry) === "done").length,
    missed: day.roster.filter((entry) => rowStatus(entry) === "missed").length,
    skipped: day.roster.filter((entry) => rowStatus(entry) === "skipped").length,
  };

  return (
    <>
      <DialogBody>
        <DialogTitle>recap --all</DialogTitle>
        <Table>
          <TableBody>
            {day.roster.map((entry, index) => {
              const status = rowStatus(entry);
              return (
                <TableRow key={entry.instanceId}>
                  <Cell tone="neutral">{pad(index + 1)}</Cell>
                  <Cell>{entry.name}</Cell>
                  <Cell tone={status === "open" ? "neutral" : status}>{status.toUpperCase()}</Cell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <Text tone="record" className="tone-missed mt-2.5 block">
          {counts.done} done / {counts.missed} missed / {counts.skipped} skipped
        </Text>
      </DialogBody>
      <DialogFooter className="justify-between">
        <DialogClose
          render={
            <Button variant="ghost">
              <Kbd>ESC</Kbd>
              cancel
            </Button>
          }
        />
        <Button variant="ghost" onClick={() => onStage("note")}>
          <Kbd>&#8629;</Kbd>
          confirm recap
        </Button>
      </DialogFooter>
    </>
  );
}

function SealedStage({ day, onClose }: { day: DayView; onClose: () => void }) {
  return (
    <div className="grid h-full place-content-center gap-3 p-5 text-center">
      <Meter value={100} className="w-72 items-center" aria-label="Record locked">
        <MeterTrack>
          <MeterIndicator animated />
        </MeterTrack>
        <MeterLabel className="text-lg font-bold tracking-brand text-accent">
          RECORD LOCKED
        </MeterLabel>
      </Meter>
      <Text as="p" tone="muted">
        {day.date} · {day.roster.length} routines · note stored
      </Text>
      <div>
        {/* The dialog already traps focus; landing it on the one exit is the point. */}
        {/* oxlint-disable-next-line jsx-a11y/no-autofocus */}
        <Button variant="accent" size="lg" autoFocus onClick={onClose}>
          RETURN
        </Button>
      </div>
    </div>
  );
}

const noteSchema = v.object({
  note: v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty("A closing note is required."),
    v.maxLength(2000, "Closing note must be 2000 characters or fewer."),
  ),
});

type NoteForm = v.InferOutput<typeof noteSchema>;

/** Stage 3: the one field the ceremony requires before it will lock. */
function NoteStage({ onLock }: { onLock: (note: string) => Promise<void> }) {
  const form = useForm<NoteForm>({
    resolver: valibotResolver(noteSchema),
    defaultValues: { note: "" },
    mode: "onChange",
  });
  const { errors, isSubmitting, isValid } = form.formState;

  const submit = form.handleSubmit(async ({ note }) => {
    try {
      await onLock(note);
    } catch (error) {
      form.setError("root", { message: errorText(error) });
    }
  });

  return (
    <form onSubmit={submit} className="contents">
      <DialogBody>
        <DialogTitle>note --one-line</DialogTitle>
        <Field name="note" invalid={errors.note !== undefined}>
          <FieldLabel>closing note</FieldLabel>
          {/* The dialog already traps focus; the note is the only field in it. */}
          <Input
            sigil=">"
            size="lg"
            // oxlint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            autoComplete="off"
            placeholder="closing note"
            invalid={errors.note !== undefined}
            {...form.register("note")}
          />
          <FieldError match={errors.note !== undefined}>{errors.note?.message}</FieldError>
        </Field>
        <Text tone="record" className="tone-missed mt-2.5 block">
          ! LOCK IS IRREVERSIBLE. THE DAY CANNOT BE REOPENED.
        </Text>
        {errors.root?.message ? (
          <Text as="p" tone="record" className="tone-missed mt-2.5" role="alert">
            ! {errors.root.message}
          </Text>
        ) : null}
      </DialogBody>
      <DialogFooter className="justify-between">
        <DialogClose
          render={
            <Button variant="ghost" type="button">
              <Kbd>ESC</Kbd>
              cancel
            </Button>
          }
        />
        <Button variant="accent" type="submit" disabled={!isValid} loading={isSubmitting}>
          <Kbd>&#8629;</Kbd>
          LOCK
        </Button>
      </DialogFooter>
    </form>
  );
}
