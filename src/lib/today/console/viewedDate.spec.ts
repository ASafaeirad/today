import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";

import type { LocalDate } from "#domain/date";

import { useViewedDate } from "./model";

describe("the date the console is looking at", () => {
  it("follows today over midnight when it was sitting on today", () => {
    const view = renderHook(({ today }: { today: LocalDate }) => useViewedDate(today), {
      initialProps: { today: "2026-09-11" },
    });

    view.rerender({ today: "2026-09-12" });

    expect(view.result.current[0]).toBe("2026-09-12");
  });

  it("leaves a day the owner opened where they put it", () => {
    const view = renderHook(({ today }: { today: LocalDate }) => useViewedDate(today), {
      initialProps: { today: "2026-09-11" },
    });

    act(() => {
      view.result.current[1]("2026-09-08");
    });
    view.rerender({ today: "2026-09-12" });

    expect(view.result.current[0]).toBe("2026-09-08");
  });
});
