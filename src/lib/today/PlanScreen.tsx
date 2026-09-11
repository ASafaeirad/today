import { valibotResolver } from "@hookform/resolvers/valibot";
import { useForm } from "react-hook-form";
import * as v from "valibot";

import {
  Bar,
  BarItem,
  BarSpacer,
  Button,
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
            <PlanRow
              key={routine._id}
              index={index}
              routine={routine}
              onRemove={(target) => plan.remove(target)}
            />
          ))
        )}
      </div>
      <DraftField onAdd={(name) => plan.add(name)} />
      <Bar placement="bottom">
        <BarItem tone="muted" divided={false}>
          {routines?.length ?? 0} routines · each runs every day
        </BarItem>
        <BarSpacer />
        <Button size="sm" className="min-h-11 sm:min-h-6" onClick={onDone}>
          <span className="hidden sm:inline">ESC · </span>back to tracking
        </Button>
      </Bar>
    </Panel>
  );
}

interface PlanRowProps {
  index: number;
  routine: RoutineView;
  onRemove: (routine: RoutineView) => Promise<void>;
}

function PlanRow({ index, routine, onRemove }: PlanRowProps) {
  return (
    <Row status="open">
      <RowIndex>{pad(index + 1)}</RowIndex>
      <RowName>{routine.name}</RowName>
      <RowStatus>daily</RowStatus>
      <RowActions>
        <Button
          variant="ghost"
          className="min-h-11 w-full sm:min-h-7 sm:w-auto"
          onClick={() => void onRemove(routine)}
        >
          remove
        </Button>
      </RowActions>
    </Row>
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
    <form onSubmit={submit} className="border-t border-border p-2">
      <Field name="name" invalid={message !== undefined}>
        <FieldLabel className="sr-only">new routine</FieldLabel>
        <Input
          sigil="+"
          // Plan mode is a mode you deliberately entered to type a name into.
          // oxlint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          autoComplete="off"
          disabled={isSubmitting}
          placeholder="new routine — enter to add"
          invalid={message !== undefined}
          {...form.register("name")}
        />
        <FieldError match={message !== undefined}>{message}</FieldError>
      </Field>
    </form>
  );
}
