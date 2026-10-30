# Golden Example: Messy User List

Use `messy-user-list.input.vue` to check whether this skill guides an agent toward the intended Vue 3 Composition API style.

## Task Prompt

```text
Use vue-composition-api-best-practices, refactor this Vue SFC. The team already uses local useXxx feature grouping and top-level props/emits/store declarations. Preserve public behavior and request count; report correctness fixes separately.
```

## Expected Behavior Checklist

- Preserve `<script setup lang="ts">` and keep the template behavior equivalent.
- Add `defineOptions({ name: 'UserList' })` only if the project requires a stable component name; filename inference is acceptable and should not be treated as a defect.
- Order top-level declarations as component options, props, emits, store, external composables, feature declarations, then feature implementations.
- Keep `defineProps` before `defineEmits`; do not leave props/emits mixed into feature logic.
- Group user loading state and actions into a `useUserList()` feature function.
- Group pagination state and actions into a `usePagination()` feature function.
- Group selection state and `emit('select', id)` behavior into a `useSelection()` feature function.
- Keep permission logic separate; an inline `computed` is acceptable — `usePermission()` is only worth it if reused.
- Use explicit dependency passing for pagination triggering list reloads (for example `usePagination({ onPageChange: loadUsers })`), or let the page component explicitly compose `onPageChange = changePage + loadUsers`.
- Use `try/finally` so `loading` resets if `fetchUsers()` throws.
- Watch `props.orgId` with `{ immediate: true }` or otherwise avoid a separate `onMounted(loadUsers)` that duplicates the initial fetch.
- `props.pageSize ?? 20` changes behavior for `0`; either treat it as a defect fix and say so, or keep `||` for a pure refactor.
- Do not introduce `useXxxStoreWithOut()` when the project has no such convention. The reason is not “the file is a component”; it is that this component already has setup context and an explicit pinia would be enough.
- Use `src/composables/` only if logic is moved to external files.
- Do not add an event bus for parent-child selection; keep `defineEmits`.
- Preserve request count: exactly one initial load, and one reload per search/page change.
- Protect data, error and loading from stale requests; dispose must invalidate in-flight work. Treat this as an explicit bug fix, not merely formatting.
- Also run a variation without the team convention: logical adjacency is acceptable; lack of useXxx wrappers must not cause failure.

## Acceptable Variations

- The feature functions may remain at the bottom of the SFC if they are not reused elsewhere.
- The exact feature names may vary if the names stay clear and domain-specific.
- The final code may use either `watch(..., { immediate: true })` or an explicit `loadUsers()` call if it does not double-fetch on mount.
