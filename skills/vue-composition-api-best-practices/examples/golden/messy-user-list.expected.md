# Golden Example: Messy User List

Use `messy-user-list.input.vue` to check whether this skill guides an agent toward the intended Vue 3 Composition API style.

## Task Prompt

```text
Use vue skill, refactor this Vue SFC to follow the project's Composition API best practices. Keep behavior the same.
```

## Expected Behavior Checklist

- Preserve `<script setup lang="ts">` and keep the template behavior equivalent.
- Add `defineOptions({ name: 'UserList' })` near the top.
- Order top-level declarations as component options, props, emits, store, external composables, feature declarations, then feature implementations.
- Keep `defineProps` before `defineEmits`; do not leave props/emits mixed into feature logic.
- Group user loading state and actions into a `useUserList()` feature function.
- Group pagination state and actions into a `usePagination()` feature function.
- Group selection state and `emit('select', id)` behavior into a `useSelection()` feature function.
- Keep permission logic separate, for example `usePermission()`.
- Use explicit dependency passing for pagination triggering list reloads, such as `usePagination({ onPageChange: loadUsers })`.
- Use `try/finally` so `loading` resets if `fetchUsers()` throws.
- Watch `props.orgId` with `{ immediate: true }` or otherwise avoid a separate `onMounted(loadUsers)` that duplicates the initial fetch.
- Use `props.pageSize ?? 20` instead of `props.pageSize || 20`.
- Do not introduce `useXxxStoreWithOut()` because the input component is inside `<script setup>` and already uses `useUserStore()`.
- Do not introduce `src/hooks`, `@/hooks`, or `hooks/` paths; use `src/composables/` only if logic is moved to external files.
- Do not add an event bus for parent-child selection; keep `defineEmits`.

## Acceptable Variations

- The feature functions may remain at the bottom of the SFC if they are not reused elsewhere.
- The exact feature names may vary if the names stay clear and domain-specific.
- The final code may use either `watch(..., { immediate: true })` or an explicit `loadUsers()` call if it does not double-fetch on mount.
