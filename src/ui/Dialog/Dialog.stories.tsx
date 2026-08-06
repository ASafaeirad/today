import preview from "#storybook/preview";

import { Button } from "../Button/Button.tsx";
import { Field, FieldGroup } from "../Field/Field.tsx";
import { Input } from "../Input/Input.tsx";
import { Label } from "../Label/Label.tsx";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./Dialog.tsx";

const meta = preview.meta({
  component: Dialog,
});

export const Default = meta.story({
  render: () => {
    return (
      <Dialog>
        <form>
          <DialogTrigger render={<Button variant="outline">Open Dialog</Button>} />
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Edit profile</DialogTitle>
              <DialogDescription>
                Make changes to your profile here. Click save when you&apos;re done.
              </DialogDescription>
            </DialogHeader>
            <FieldGroup>
              <Field>
                <Label htmlFor="name-1">Name</Label>
                <Input id="name-1" name="name" defaultValue="Pedro Duarte" />
              </Field>
              <Field>
                <Label htmlFor="username-1">Username</Label>
                <Input id="username-1" name="username" defaultValue="@peduarte" />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <DialogClose render={<Button variant="outline">Cancel</Button>} />
              <Button type="submit">Save changes</Button>
            </DialogFooter>
          </DialogContent>
        </form>
      </Dialog>
    );
  },
});
