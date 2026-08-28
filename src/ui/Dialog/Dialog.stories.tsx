import { useState } from "react";

import preview from "#storybook/preview";

import { BarItem, BarSpacer } from "../Bar/Bar.tsx";
import { Button } from "../Button/Button.tsx";
import { ButtonGroup } from "../ButtonGroup/ButtonGroup.tsx";
import { Field, FieldLabel } from "../Field/Field.tsx";
import { Input } from "../Input/Input.tsx";
import { Kbd } from "../Kbd/Kbd.tsx";
import { Table, TableBody, TableCell, TableRow, type TableCellProps } from "../Table/Table.tsx";
import { Text } from "../Text/Text.tsx";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./Dialog.tsx";

const meta = preview.meta({ component: Dialog });

const RECAP = [
  { name: "Wake by 7", state: "done" },
  { name: "Stretch", state: "missed" },
  { name: "Walk", state: "skipped" },
] satisfies { name: string; state: NonNullable<TableCellProps["tone"]> }[];

export const Resolve = meta.story({
  render: () => (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="accent" size="lg">
            Z · SEAL
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <span className="px-2.5 py-1.25">SEAL 2026-08-28</span>
          <span className="px-2.5 py-1.25">STAGE 1/3 · RESOLVE · 3 LEFT</span>
        </DialogHeader>
        <DialogBody>
          <DialogTitle>resolve --interactive</DialogTitle>
          <DialogDescription className="mb-3">
            line 04 <Text tone="inverted">Walk</Text>
          </DialogDescription>
          <ButtonGroup attached={false}>
            {[
              ["D", "done"],
              ["M", "missed"],
              ["S", "skipped"],
            ].map(([key, action]) => (
              <Button key={action} size="lg">
                <Kbd variant="hint">{key}</Kbd>
                {action}
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
          <BarSpacer />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
});

export const Recap = meta.story({
  render: () => (
    <Dialog>
      <DialogTrigger render={<Button>open recap</Button>} />
      <DialogContent>
        <DialogHeader>
          <span className="px-2.5 py-1.25">SEAL 2026-08-28</span>
          <span className="px-2.5 py-1.25">STAGE 2/3 · RECAP · READ ONLY</span>
        </DialogHeader>
        <DialogBody>
          <DialogTitle>recap --all</DialogTitle>
          <Table>
            <TableBody>
              {RECAP.map((record, index) => (
                <TableRow key={record.name}>
                  <TableCell tone="neutral">{String(index + 1).padStart(2, "0")}</TableCell>
                  <TableCell>{record.name}</TableCell>
                  <TableCell tone={record.state} align="end">
                    {record.state.toUpperCase()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Text tone="record" className="tone-missed mt-2.5 block">
            1 done / 1 missed / 1 skipped
          </Text>
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
          <BarItem tone="muted" divided={false} className="p-0">
            <Button variant="ghost">
              <Kbd>&#8629;</Kbd>
              confirm recap
            </Button>
          </BarItem>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
});

export const Note = meta.story({
  render: () => {
    const [note, setNote] = useState("");

    return (
      <Dialog>
        <DialogTrigger render={<Button>open note</Button>} />
        <DialogContent>
          <DialogHeader>
            <span className="px-2.5 py-1.25">SEAL 2026-08-28</span>
            <span className="px-2.5 py-1.25">STAGE 3/3 · NOTE · REQUIRED</span>
          </DialogHeader>
          <DialogBody>
            <DialogTitle>note --one-line</DialogTitle>
            <Field name="note">
              <FieldLabel>closing note</FieldLabel>
              <Input
                sigil=">"
                size="lg"
                value={note}
                placeholder="closing note"
                onValueChange={setNote}
              />
            </Field>
            <Text tone="record" className="tone-missed mt-2.5 block">
              ! LOCK IS IRREVERSIBLE. THE DAY CANNOT BE REOPENED.
            </Text>
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
            <Button variant="accent" disabled={!note.trim()}>
              <Kbd>&#8629;</Kbd>
              LOCK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  },
});
