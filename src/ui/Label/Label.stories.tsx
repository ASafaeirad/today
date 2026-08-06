import preview from "#storybook/preview";

import { Checkbox } from "../Checkbox/Checkbox.tsx";
import { Label } from "./Label.tsx";

const meta = preview.meta({
  component: Label,
});

export const Default = meta.story({
  render: () => {
    return (
      <div className="flex gap-2">
        <Checkbox id="terms" />
        <Label htmlFor="terms">Accept terms and conditions</Label>
      </div>
    );
  },
});
