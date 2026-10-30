# acan-skills

[![skills.sh](https://skills.sh/b/acanzaima/skills)](https://skills.sh/acanzaima/skills)

acan's Agent skills.

> [中文](README.md)

## Installation

```bash
npx skills add acanzaima/skills
```

### Claude Code Marketplace

An alternative for Claude Code users:

```bash
# Add marketplace
/plugin marketplace add acanzaima/skills

# Install all skills at once
/plugin install acan-skills-bundle@acan-skills

# Install individual skills
/plugin install vue-composition-api-best-practices@acan-skills
```

### Clawhub

For Clawhub users:

```bash
openclaw skills install vue-composition-api-best-practices
```

## Usage

For the most reliable result, name the skill explicitly:

```
Use the vue-composition-api-best-practices skill to <your task>
```

A vague prefix such as `use vue skill` relies on description matching and may be less reliable.

### Adopt by project

This is a **reference library**, not a one-size-fits-all standard:

- Projects that already share the conventions can adopt everything (11-step order, in-SFC `useXxx`, `WithOut`, `useEmitt`)
- Projects without them still benefit from the universal parts (typed props/emits, cleanup, request races, `storeToRefs`, `shallowRef`)
- Prefer existing conventions; new projects, modules without conventions, or explicit user requests may adopt patterns according to their responsibilities and complexity
- Keep local fixes minimal without adding unrelated conventions; each chosen pattern must still meet its runtime and lifecycle requirements

## Available Skills

| Skill | When to use | Description |
|-------|-------------|-------------|
| **vue-composition-api-best-practices** | Vue 3 + Composition API + TypeScript | Reactivity correctness, request races and cleanup, props/model contracts, SSR and Pinia instance boundaries; optional composable design, performance guidance and team code organization conventions |

Maintenance checks: run `npm ci` and `npm test` for document structure and selected example compilation/behavior. Golden inputs intentionally contain defects; evaluate agent outputs separately using the [case checklist](skills/vue-composition-api-best-practices/examples/golden/README.md). Passing automated tests does not mean the agent evaluation has run.
