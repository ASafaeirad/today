import preview from "#storybook/preview";

import { Bar, BarItem, BarSpacer } from "../Bar/Bar.tsx";
import { Button } from "../Button/Button.tsx";
import { Heading, Text } from "../Text/Text.tsx";
import { Panel, PanelBody } from "./Panel.tsx";

const meta = preview.meta({ component: Panel });

export const Matrix = meta.story({
  render: () => (
    <div className="flex flex-col gap-8">
      <Panel className="w-80">
        <PanelBody>
          <Heading as="h2" size="base" prompt>
            recap --all
          </Heading>
          <Text tone="muted">Five routines on record. Nothing locked yet.</Text>
        </PanelBody>
      </Panel>

      <Panel className="w-80">
        <Bar variant="accent" placement="none" className="justify-between">
          <span className="px-2.5 py-1.25">SEAL 2026-08-24</span>
          <span className="px-2.5 py-1.25">STAGE 3/3</span>
        </Bar>
        <PanelBody>
          <Text tone="muted">The day cannot be reopened once it is locked.</Text>
        </PanelBody>
        <Bar placement="bottom">
          <BarItem tone="muted">esc cancel</BarItem>
          <BarSpacer />
          <Button variant="accent" className="border-l border-border">
            LOCK
          </Button>
        </Bar>
      </Panel>
    </div>
  ),
});
