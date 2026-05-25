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

For most reliable results, prefix your prompt with `use vue skill`:

```
Use vue skill, <your prompt here>
```

This explicitly triggers the skill and ensures the AI follows the documented patterns. Without the prefix, skill triggering may be inconsistent depending on how closely your prompt matches the skill's description keywords.

## Available Skills

| Skill | When to use | Description |
|-------|-------------|-------------|
| **vue-composition-api-best-practices** | Vue 3 + Composition API + TypeScript | SFC code organization (11-step order), useXxx patterns, composable design (5 patterns), Pinia store integration (Store Without pattern), cross-feature dependency management, reactivity & performance optimization |
