# Golden: Vue 3.5 props getter

## Task Prompt

Use vue-composition-api-best-practices to fix this Vue 3.5 component. The output must follow parent count changes. Preserve the public API; do not restructure for style.

## Expected Behavior Checklist

- Replace `watch(count, ...)` with a getter source, or use an equivalent props/toRef approach.
- Pass a reactive source to useDouble; if using a getter, change its input type to `MaybeRefOrGetter<number>`.
- Read toValue inside the tracked getter/effect, not once outside it.
- Do not write to the destructured prop or wrap the current count in ref as a fake fix.
- Verify initial and later parent values, including 0, rather than merely compiling.
- No required defineOptions, WithOut, event bus or 11-section rearrangement.
- Variant: on Vue 3.4 without experimental props destructure, use props access/toRef; withDefaults alone does not fix destructuring.
