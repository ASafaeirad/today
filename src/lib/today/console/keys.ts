import { useHotkeys } from "@tanstack/react-hotkeys";

import type { Outcome } from "#domain/outcome";

import type { Mode } from "./presentation";

export interface KeyCommands {
  mode: Mode;
  enabled: boolean;
  enterMode: (mode: Mode) => void;
  stepRoster: (delta: number) => void;
  stepLog: (delta: number) => void;
  openLog: () => void;
  mark: (outcome: Outcome) => void;
  beginClose: () => void;
  stepDay: (delta: number) => void;
  today: () => void;
}

/** Owns the console-wide keyboard map. */
export function useConsoleKeys(c: KeyCommands): void {
  useHotkeys(
    [
      { hotkey: "P", callback: () => c.enterMode("plan") },
      { hotkey: "Escape", callback: () => c.enterMode("track") },
      { hotkey: "J", callback: () => (c.mode === "log" ? c.stepLog(1) : c.stepRoster(1)) },
      { hotkey: "K", callback: () => (c.mode === "log" ? c.stepLog(-1) : c.stepRoster(-1)) },
      { hotkey: "Enter", callback: c.openLog },
      { hotkey: "D", callback: () => c.mark("done") },
      { hotkey: "M", callback: () => c.mark("missed") },
      { hotkey: "S", callback: () => c.mark("skipped") },
      { hotkey: "Z", callback: () => c.mode === "track" && c.beginClose() },
      { hotkey: "L", callback: () => c.mode !== "plan" && c.stepDay(-1) },
      { hotkey: "H", callback: () => c.mode !== "plan" && c.stepDay(1) },
      { hotkey: "T", callback: () => c.mode !== "plan" && c.today() },
      {
        hotkey: "G",
        callback: () => c.mode !== "plan" && c.enterMode(c.mode === "log" ? "track" : "log"),
      },
    ],
    { enabled: c.enabled },
  );
}
