# Golden Example: Simple Clean Component

Use `simple-clean-component.input.vue` to check whether the skill avoids over-applying its restructuring conventions to code that is already clear.

## Task Prompt

```text
Use vue skill, review this component. Apply only changes that fix real defects; do not restructure for style.
```

## Expected Behavior Checklist

- Report that the component is already clear and has no correctness defect that requires restructuring.
- Do not add `defineOptions({ name: ... })` unless the project explicitly requires a stable name; filename inference is acceptable.
- Do not add the 11-step section comments or reorder declarations merely to match the convention.
- Do not wrap `doubleCount` or `step` into `useXxx()` feature functions.
- Do not introduce a store bridge, `WithOut`, event bus, or `src/composables/` extraction.
- Do not change the prop/emit contract or the template behavior.
- If a project convention is known from context (for example, the team requires `defineOptions`), it is acceptable to mention it as an optional follow-up, but do not apply it silently.
- If the response makes any change, it must be tied to a concrete defect and keep the diff minimal.

## Acceptable Variations

- The agent may return “no changes needed” in prose, or a one-line summary of why the component is fine.
- The agent may suggest optional improvements (naming, a11y) as suggestions without modifying the file.
- The agent may add a `defineOptions` only when the task prompt explicitly says the project requires it.
