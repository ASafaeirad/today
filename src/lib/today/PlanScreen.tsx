import { valibotResolver } from "@hookform/resolvers/valibot";
import { useState } from "react";
import { useForm } from "react-hook-form";
import * as v from "valibot";

import {
  Bar,
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
  Field,
  FieldError,
  FieldLabel,
  Heading,
  Input,
  Panel,
  PanelBody,
  Row,
  RowActions,
  RowIndex,
  RowName,
  RowStatus,
  Text,
} from "#ui";

import type { RoutineView } from "./ledger";
import type { RoutinePlan } from "./useRoutinePlan";

import { errorText, pad } from "./console";

interface Props {
  plan: RoutinePlan;
  onDone: () => void;
}

/**
 * Plan mode: the routine list, and the one field that grows it. Every routine
 * is daily, so there is no schedule to state — the only two operations are
 * naming one and retiring one.
 */
export function PlanScreen({ plan, onDone }: Props) {
  const { routines } = plan;
  const [removing, setRemoving] = useState<RoutineView | null>(null);
  const handleRemove = plan.remove;

  return (
    <Panel className="min-h-0 flex-1">
      <div className="min-h-0 flex-1 overflow-auto">
        {routines === undefined ? (
          <PanelBody aria-busy="true">
            <Text
              as="p"
              tone="muted"
              className="w-fit animate-type overflow-hidden whitespace-nowrap"
            >
              loading routines ...
            </Text>
          </PanelBody>
        ) : routines.length === 0 ? (
          <PanelBody>
            <Heading as="h2" size="base" prompt>
              today --empty
            </Heading>
            <Text tone="muted">
              no routines yet. you are in plan mode — name one below and it runs every day. no
              schedule, no setup.
            </Text>
          </PanelBody>
        ) : (
          routines.map((routine, index) => (
            <PlanRow key={routine._id} index={index} routine={routine} onRemove={setRemoving} />
          ))
        )}
      </div>
      <DraftField onAdd={(name) => plan.add(name)} />
      {/* The way out of the mode. A pointer has the key and the count beside it;
          a thumb gets the full width of the bar to land on. */}
      <Bar placement="bottom">
        <BarItem tone="muted" divided={false} className="hidden sm:flex">
          {routines?.length ?? 0} routines · each runs every day
        </BarItem>
        <BarSpacer className="hidden sm:block" />
        <Button size="sm" className="min-h-11.5 w-full sm:min-h-6 sm:w-auto" onClick={onDone}>
          <span className="hidden sm:inline">ESC · </span>back to tracking
        </Button>
      </Bar>
      {removing ? (
        <RemoveRoutineDialog
          routine={removing}
          onRemove={handleRemove}
          onClose={() => setRemoving(null)}
        />
      ) : null}
    </Panel>
  );
}

interface PlanRowProps {
  index: number;
  routine: RoutineView;
  onRemove: (routine: RoutineView) => void;
}

function PlanRow({ index, routine, onRemove }: PlanRowProps) {
  return (
    <Row status="open">
      <RowIndex>{pad(index + 1)}</RowIndex>
      <RowName>{routine.name}</RowName>
      {/* Every routine is daily, so the word is a column heading's worth of
          information: the wider screen has room to state it, the phone does not. */}
      <RowStatus className="hidden sm:inline-block">daily</RowStatus>
      <RowActions className="flex justify-end">
        <Button
          variant="ghost"
          className="min-h-11 min-w-22.5 sm:min-h-7 sm:min-w-0"
          onClick={() => onRemove(routine)}
        >
          remove
        </Button>
      </RowActions>
    </Row>
  );
}

interface RemoveRoutineDialogProps {
  routine: RoutineView;
  onRemove: (routine: RoutineView) => Promise<void>;
  onClose: () => void;
}

/** Retirement needs a deliberate second action because its schedule change is today-forward. */
function RemoveRoutineDialog({ routine, onRemove, onClose }: RemoveRoutineDialogProps) {
  const [isRemoving, setIsRemoving] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);

  const remove = async () => {
    if (isRemoving) return;
    setIsRemoving(true);
    setRefusal(null);
    try {
      await onRemove(routine);
      onClose();
    } catch (error) {
      setRefusal(errorText(error));
      setIsRemoving(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !isRemoving) onClose();
      }}
    >
      <DialogContent
        className="flex items-end justify-center bg-transparent p-3 data-open:animate-cut sm:items-center sm:p-6"
        onKeyDownCapture={(event) => {
          if (isRemoving && event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        <Panel className="max-h-full w-full max-w-115 bg-background">
          <DialogHeader>
            <Text className="px-2.5 py-1.25" caps tracking="widest">
              REMOVE ROUTINE
            </Text>
          </DialogHeader>
          <DialogBody>
            <DialogTitle className="mb-1.5">remove --confirm</DialogTitle>
            <DialogDescription render={<Text as="p" tone="muted" />}>
              Retire &quot;{routine.name}&quot; after today? It leaves the plan now, but
              today&apos;s instance and its history stay in the ledger.
            </DialogDescription>
            {refusal ? (
              <Text as="p" tone="record" className="tone-missed mt-2.5" role="alert">
                ! {refusal}
              </Text>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <DialogClose
              render={
                <Button variant="ghost" disabled={isRemoving}>
                  cancel
                </Button>
              }
            />
            <BarSpacer />
            <Button
              variant="accent"
              aria-label="remove routine"
              loading={isRemoving}
              onClick={() => void remove()}
            >
              remove routine
            </Button>
          </DialogFooter>
        </Panel>
      </DialogContent>
    </Dialog>
  );
}

const draftSchema = v.object({
  name: v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty("Name the routine before adding it."),
    v.maxLength(120, "A routine name must be 120 characters or fewer."),
  ),
});

type Draft = v.InferOutput<typeof draftSchema>;

/** The whole of creation: a name, and the return key. */
function DraftField({ onAdd }: { onAdd: (name: string) => Promise<void> }) {
  const form = useForm<Draft>({
    resolver: valibotResolver(draftSchema),
    defaultValues: { name: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async ({ name }) => {
    try {
      await onAdd(name);
      form.reset();
    } catch (error) {
      form.setError("name", { message: errorText(error) });
    }
  });

  const message = errors.name?.message;

  return (
    <form
      onSubmit={(event) => {
        if (isSubmitting) {
          event.preventDefault();
          return;
        }
        void submit(event);
      }}
      className="border-t border-border p-2"
    >
      <Field name="name" invalid={message !== undefined}>
        <FieldLabel className="sr-only">new routine</FieldLabel>
        <Input
          sigil="+"
          // Plan mode is a mode you deliberately entered to type a name into.
          // oxlint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          autoComplete="off"
          readOnly={isSubmitting}
          placeholder="new routine — enter to add"
          invalid={message !== undefined}
          {...form.register("name")}
        />
        <FieldError match={message !== undefined}>{message}</FieldError>
      </Field>
    </form>
  );
}
