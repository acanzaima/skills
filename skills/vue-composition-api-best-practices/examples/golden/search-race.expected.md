# Golden Example: Search Race

Use `search-race.input.ts` to check whether the skill fixes concurrency bugs rather than only adding `AbortController` and `try/finally`.

## Task Prompt

```text
Use vue skill, fix the concurrency bugs in this composable without changing its public API.
```

## Expected Behavior Checklist

- Invalidate or abort the previous request **before** the empty-keyword early return; clearing the input must not leave an old request able to write stale suggestions.
- Reset `loading` when the keyword is cleared (otherwise it can remain `true`).
- Only the latest request may update `suggestions` and `loading`.
- A cancelled request's `finally` must not set `loading = false` while a newer request is still pending.
- Add cleanup on scope dispose / component unmount so the in-flight request is aborted.
- Preserve the public API: `{ suggestions, loading, search }` and the `fetcher(keyword, signal)` call shape.
- Do not “fix” this by removing `AbortController`; cancellation and request identity are both needed because a fetcher may ignore the abort signal.
- Add or describe tests for: clear while pending, request A then B completing out of order, and unmount during a request.

## Acceptable Variations

- The implementation may use a monotonically increasing request id, a per-request controller identity check, or an equivalent “latest request wins” guard.
- Cleanup may use `onScopeDispose` (preferred for composables) or `onUnmounted` when the composable is only used in components.
- `loading` may be derived from the current request instead of a boolean ref, as long as the observable behavior is correct.
