import { StoryMatrix } from "#storybook/matrix";
import preview from "#storybook/preview";

import { Input } from "../Input/Input.tsx";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "./Field.tsx";

const meta = preview.meta({ component: Field });

export const Matrix = meta.story({
  render: () => (
    <StoryMatrix
      columns={[{ label: "Label only" }, { label: "Described" }, { label: "Invalid" }]}
      rows={["Default", "Disabled"]}
      cell={({ row, col }) => (
        <Field
          disabled={row === "Disabled"}
          invalid={col === "Invalid"}
          className="w-60"
          name="note"
        >
          <FieldLabel>closing note</FieldLabel>
          <Input sigil=">" placeholder="one line" />
          {col === "Described" && (
            <FieldDescription>Say plainly how the day went.</FieldDescription>
          )}
          {col === "Invalid" && <FieldError match>A note is required to lock.</FieldError>}
        </Field>
      )}
    />
  ),
});

export const Group = meta.story({
  render: () => (
    <FieldGroup className="w-72">
      <Field name="note">
        <FieldLabel>closing note</FieldLabel>
        <Input sigil=">" placeholder="one line" />
        <FieldDescription>Stored with the record. It cannot be edited later.</FieldDescription>
      </Field>
      <Field name="tag">
        <FieldLabel>tag</FieldLabel>
        <Input placeholder="optional" />
      </Field>
    </FieldGroup>
  ),
});
