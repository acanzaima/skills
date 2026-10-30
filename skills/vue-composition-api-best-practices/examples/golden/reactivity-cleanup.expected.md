# Golden Example: Reactivity And Cleanup

Use `reactivity-cleanup.input.vue` to check whether this skill guides an agent away from common reactivity and side-effect pitfalls.

## Task Prompt

```text
Use vue skill, refactor this Vue SFC to improve reactivity choices and side-effect cleanup. Keep behavior the same.
```

## Expected Behavior Checklist

- Use `shallowRef` for dynamic component references instead of deep `ref` (the component object does not need deep reactivity).
- Do not run `loadUser()` inside `computed`; keep computed values side-effect free.
- Fetch user data from `watch(() => props.userId, ...)` with `{ immediate: true }`, or another equivalent single initial-load path.
- Avoid duplicate initial requests from both `watch` and `onMounted`.
- Use `try/finally` so `loading` resets when requests fail.
- Cancel stale user requests with `AbortController` and watcher cleanup; only the latest request may set `user` and `loading`.
- Clean up the `resize` listener with `onScopeDispose` or `onUnmounted`, or use a composable helper that handles cleanup.
- Keep `props.userId` and `props.enabled` reactive. Do not do `const { userId } = props`; on Vue 3.5+ directly destructuring `defineProps()` is acceptable.
- Keep behavior equivalent: component switches by `enabled`, width updates on resize, user loads for current `userId`, and the number of requests does not change except for fixing the duplicate initial load.

## Acceptable Variations

- The resize logic may be extracted into a `useWindowSize()` composable under `src/composables/dom/`.
- Vue 3.5+ output may use `onWatcherCleanup()`; Vue 3.0+ output may use the `onCleanup` callback parameter.
