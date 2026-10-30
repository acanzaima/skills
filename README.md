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

为获得最可靠的结果，显式点名技能：

```
使用 vue-composition-api-best-practices 技能，<你的提示词>
```

如果客户端支持按名称调用，也可以直接选择 `vue-composition-api-best-practices`。只写 `use vue skill` 之类的模糊前缀时，触发取决于提示词与 description 的匹配程度，可能不够稳定。

### 按项目取用

这是一份**参考库**，不是要求所有项目全盘套用的统一规范：

- 有相同约定的项目可以完整采用（11 步排序、SFC 内 `useXxx`、`WithOut`、`useEmitt` 等）
- 没有这些约定的项目，只采用通用语义（类型化 props/emits、清理、竞态、`storeToRefs`、`shallowRef`）也很有价值
- 已有项目优先沿用既有约定；新项目、尚无约定的模块，或用户明确要求时，可按职责和复杂度选用这些模式
- 局部修复默认最小改动，不顺带引入新约定；选择模式时仍需满足对应 reference 的运行时与生命周期前提

## 可用 Skills

| Skill | 适用场景 | 描述 |
|-------|---------|------|
| **vue-composition-api-best-practices** | Vue 3 + Composition API + TypeScript | 响应式正确性、请求竞态与清理、props/model 类型契约、SSR 与 Pinia 实例边界；按需参考组合式函数设计、性能优化和团队代码组织约定 |

维护验证：运行 `npm ci`、`npm test`，检查文档结构和选定示例的编译/行为。Golden 输入故意包含缺陷，需按[用例清单](skills/vue-composition-api-best-practices/examples/golden/README.md)另行评测 Agent 输出；自动测试通过不代表 golden 评测已执行。
