# Today Console architecture

`index.ts` is the UI package boundary. Screens import its view types and pure presentation helpers. The route calls `useConsoleModel`; full-console stories render the same view with `useStoryConsoleModel`.

## Ownership

- `model.ts` composes the production model. It owns cross-workflow coordination and announcements, not Convex calls.
- `reads.ts`, `marks.ts`, `plan.ts`, `seal.ts`, and `progression.ts` own their named Convex operations. A retry or mutation rule belongs in the module that names the operation. `marks.ts` also owns the shared optimistic roster update.
- `navigation.ts` owns pure roster selection, Log cursor movement, and derived day facts. Production and Storybook both use it.
- `viewedDate.ts` owns the rule for following midnight while the owner is still viewing today.
- `keys.ts` owns the console-wide keyboard map.
- `storyAdapter.ts` is a deterministic in-memory implementation of `ConsoleModel`. Production code must not import it.
- `presentation.ts` contains pure display calculations. It must not import React or Convex.
- `types.ts` is the UI-facing contract. Add a field only when a renderer needs it.

Keep Convex imports in the operation owners. Keep screen-local form, focus, scroll, and DOM state in the screen components. If production and Storybook need the same rule, put a pure function in the named owner instead of copying the rule.

## Verification

- Pure console behavior: `vp test src/lib/today/console`
- Full-console interactions: `vp test --project storybook src/lib/today/TodayConsole.stories.tsx`
- Complete repository: `vp check && vp test && vp run build`
