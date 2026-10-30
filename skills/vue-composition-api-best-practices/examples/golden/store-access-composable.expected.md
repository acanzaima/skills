# Golden Example: Store Access Composable

Use `store-access-composable.input.ts` to check whether this skill handles Pinia store access outside component context without over-applying project-specific wrappers.

## Task Prompt

```text
Use vue skill, refactor this composable so Pinia store access is safe outside Vue component setup. Keep behavior the same.
```

## Expected Behavior Checklist

- Recognize that being in a `.ts` file is not itself the problem: a composable called synchronously from `setup()` still has injection context.
- Treat the real criterion as “can the correct pinia instance be obtained at call time”, not component vs non-component file location.
- If the composable may be called outside `setup()` (plugins, router guards, tests, SSR), accept an explicit `pinia` parameter, for example `useThemeBridge(pinia: Pinia)`.
- If it is only called from `setup()`, `useAppStore()` is valid; do not rewrite it to `WithOut` merely because it lives in a `.ts` file.
- If and only if the codebase already has a `useAppStoreWithOut()` convention, and the project is a single-app non-SSR context, using that wrapper is acceptable.
- Do not introduce a global singleton pinia in a way that would break SSR request isolation or test isolation.
- Keep `theme`, `isDark`, and `toggleTheme()` behavior equivalent.
- Use `storeToRefs()` if destructuring reactive store state.
- Do not expose the whole store unless the caller truly needs it.
- Keep the file under `src/composables/` if moved.

## Acceptable Variations

- The composable may be renamed to a factory such as `createThemeBridge(pinia)` if the project uses factory naming for explicit dependencies.
- The output may accept either `Pinia` directly or an options object like `{ pinia }` when the project has broader dependency injection conventions.
