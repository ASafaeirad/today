import preview from "#storybook/preview";

import { CommandLine, CommandLineValue } from "./CommandLine.tsx";

const meta = preview.meta({
  component: CommandLine,
  parameters: { layout: "fullscreen" },
});

export const Matrix = meta.story({
  render: () => (
    <div className="flex flex-col gap-8">
      <CommandLine action="jump --next-open">
        <CommandLineValue>6/8</CommandLineValue> resolved today ·{" "}
        <CommandLineValue>2</CommandLineValue> earlier days open
      </CommandLine>
      <CommandLine>
        <CommandLineValue>8/8</CommandLineValue> resolved today · [clear]
      </CommandLine>
    </div>
  ),
});
