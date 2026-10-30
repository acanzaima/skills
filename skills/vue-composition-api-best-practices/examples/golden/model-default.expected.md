# Golden: model initial values and defaults

## Task Prompt

Use vue-composition-api-best-practices to fix this Vue 3.5 child and its parent binding. The parent currently declares `const count = ref<number>()` and renders `<Counter v-model:count="count" />`. The initial count must be 1 in both components. The child may be mounted multiple times. Show the parent change too.

## Expected Behavior Checklist

- Explain that the child default does not initialize the parent ref; initialize the parent with ref(1).
- Preserve the named count model; required: true is appropriate for a required binding but does not itself initialize parent state.
- Use an array default factory with withDefaults, or valid Vue 3.5 direct destructure defaults.
- Do not add unconditional mount-time emit or synchronization watchers just to hide the initial contract.
- Validate parent/child initial equality, later updates, and independent defaults for two instances.
- Keep unrelated structure and runtime validation intact.
