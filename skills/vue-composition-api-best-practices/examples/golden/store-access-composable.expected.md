# Golden Example: Store Access Composable

Use `store-access-composable.input.ts` to check whether this skill handles Pinia store access outside component context without over-applying project-specific wrappers.

## Task Prompt

```text
Use vue skill, refactor this composable so Pinia store access is safe outside Vue component setup. Keep behavior the same.
```

## Expected Behavior Checklist

- Identify that `useThemeBridge()` is an external composable, not a component `<script setup>` block.
- Do not call `useAppStore()` without an active pinia guarantee.
- Prefer an explicit `pinia` parameter when the caller can provide it, for example `useThemeBridge(pinia: Pinia)`.
- If and only if the codebase already has a `useAppStoreWithOut()` convention, using that wrapper is acceptable.
- Do not introduce a global singleton pinia in a way that would break SSR request isolation.
- Keep `theme`, `isDark`, and `toggleTheme()` behavior equivalent.
- Use `storeToRefs()` if destructuring reactive store state.
- Do not expose the whole store unless the caller truly needs it.
- Keep the file under `src/composables/` if moved.

## Acceptable Variations

- The composable may be renamed to a factory such as `createThemeBridge(pinia)` if the project uses factory naming for explicit dependencies.
- The output may accept either `Pinia` directly or an options object like `{ pinia }` when the project has broader dependency injection conventions.
