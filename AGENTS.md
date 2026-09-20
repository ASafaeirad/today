<!-- DEVELOPMENT GUID START -->

- Read `CONTEXT.md` before working on this codebase. It fixes the domain language.
- To have a consistent typography please use Text component from '#ui' package.
- Use `react-hook-form` for form management.
- Use `valibot` for client side schema validation.
- In reusable components that render form controls, derive element `id`/`htmlFor` from React's `useId()`.
- Never use Tailwind arbitrary values (`[...]`). Use standard utilities, named theme tokens, or a dedicated CSS class instead. Reuse an existing theme token with the same purpose before adding a new token, even when its color differs from the design reference.
- Test UI components through Storybook stories. Put interaction assertions in story `play` functions and run them through the Storybook Vitest project. Do not add standalone Testing Library component specs when a story can cover the behavior. Follow https://storybook.js.org/docs/writing-tests.
- Chromatic snapshots every story on push, so each story is also a visual baseline and any style change can move one. A red `Chromatic` check means snapshots differ and are waiting on the maintainer to accept them: it is a human review gate, not a failure to debug. Report the build URL and name the stories you expected to move; never green it by deleting a story or setting `chromatic: { disableSnapshot: true }`.

<!-- DEVELOPMENT GUIDE END -->

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Built-in Commands vs Scripts

`vp <name>` runs a built-in command. `vp run <name>` runs a `package.json` script or a `vite.config.ts` task. Scripts cannot overwrite built-ins, so `vp dev` and `vp run dev` may do different things. Check `package.json` and `vite.config.ts` first, and run `vp run <name>` when the project defines a script or task with that name.

## Tool Versions

Run `vp toolchain` to show versions and relationships in the active Vite+
release. Add a tool name to select part of the graph. For example, run
`vp toolchain vite`. Use `--global` to ignore the local `vite-plus` package. Use
`vp why <package>` to show the package-manager dependency graph.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->
