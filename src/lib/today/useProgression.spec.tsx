import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const query = vi.hoisted(() => vi.fn());

/**
 * Convex hands back a callable carrying `withOptimisticUpdate`. This hook never
 * reaches for it — the walk over history has nothing to paint ahead of the
 * server — but the stub has to be the same shape to stand in for the real one.
 */
const mutation = vi.hoisted(() => Object.assign(vi.fn(), { withOptimisticUpdate: vi.fn() }));

vi.mock(import("convex/react"), () => ({
  useQuery: () => query(),
  useMutation: () => mutation,
}));

const { useProgression } = await import("./useProgression");

const behind = {
  experience: 0,
  streak: 0,
  multiplier: 1,
  heldDays: 0,
  caughtUp: false,
  backfill: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("driving the walk over history", () => {
  it("offers the walk again after a chunk fails, rather than stranding it", async () => {
    query.mockReturnValue(behind);
    mutation.mockRejectedValue(new Error("network"));

    renderHook(() => useProgression());
    expect(mutation).toHaveBeenCalledOnce();

    // Nothing the query is watching moved, so without the timer the walk would
    // sit here for the rest of the session.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(mutation).toHaveBeenCalledTimes(2);
  });

  it("stops asking once the walk reports itself caught up", async () => {
    query.mockReturnValue({ ...behind, caughtUp: true });
    mutation.mockResolvedValue({ complete: true });

    renderHook(() => useProgression());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(mutation).not.toHaveBeenCalled();
  });
});
