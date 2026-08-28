import { useState } from "react";

import preview from "#storybook/preview";

import { Tab, TabList, TabPanel, TabStatus, Tabs } from "./Tab.tsx";

const meta = preview.meta({
  component: Tabs,
  parameters: { layout: "fullscreen" },
});

const DAYS = [
  { value: "2026-08-28", short: "TODAY", status: "03 OPEN", tone: "inherit" },
  { value: "2026-08-27", short: "27 THU", status: "READY", tone: "done" },
  { value: "2026-08-26", short: "26 WED", status: "NO DATA", tone: "inherit" },
  { value: "2026-08-25", short: "25 TUE", status: "01 OPEN", tone: "inherit" },
  { value: "2026-08-24", short: "24 MON", status: "SEALED", tone: "seal" },
  { value: "2026-08-23", short: "23 SUN", status: "SEALED", tone: "seal" },
] as const;

export const Matrix = meta.story({
  render: () => {
    const [value, setValue] = useState<string>(DAYS[0].value);

    return (
      <Tabs value={value} onValueChange={(next) => setValue(next as string)}>
        <TabList aria-label="Days">
          {DAYS.map((day) => (
            <Tab key={day.value} value={day.value} disabled={day.status === "NO DATA"}>
              <span className="tracking-wide">{day.short}</span>
              <TabStatus tone={day.tone}>{day.status}</TabStatus>
            </Tab>
          ))}
        </TabList>
        {DAYS.map((day) => (
          <TabPanel key={day.value} value={day.value} className="px-2.5 py-4.5">
            <span className="text-muted-foreground">day </span>
            {day.value}
          </TabPanel>
        ))}
      </Tabs>
    );
  },
});
