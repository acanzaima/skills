# acan-skills

[![skills.sh](https://skills.sh/b/acanzaima/skills)](https://skills.sh/acanzaima/skills)

acan 的 Agent skills。

> [English](README.en.md)

## 安装

```bash
npx skills add acanzaima/skills
```

### Claude Code Marketplace

Claude Code 用户的替代安装方式：

```bash
# Add marketplace
/plugin marketplace add acanzaima/skills

# Install all skills at once
/plugin install acan-skills-bundle@acan-skills

# Install individual skills
/plugin install vue-composition-api-best-practices@acan-skills
```

### Clawhub

Clawhub 用户的安装方式：

```bash
openclaw skills install vue-composition-api-best-practices
```

## 使用方式

为获得最可靠的结果，在提示词前加上 `use vue skill`：

```
Use vue skill, <你的提示词>
```

这会显式触发 skill，确保 AI 遵循文档中的模式。不加前缀时，skill 的触发取决于你的提示词与 skill 描述关键词的匹配程度，可能不够稳定。

## 可用 Skills

| Skill | 适用场景 | 描述 |
|-------|---------|------|
| **vue-composition-api-best-practices** | Vue 3 + Composition API + TypeScript | SFC 代码组织（11 步顺序）、useXxx 模式、组合式函数设计（5 种模式）、Pinia Store 集成（Store Without 模式）、跨功能依赖管理、响应式与性能优化 |
