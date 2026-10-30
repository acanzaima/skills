---
name: vue-composition-api-best-practices
description: "Vue 3 组合式 API / script setup / TypeScript 的编写、重构与评审参考。Use when writing, refactoring, or reviewing Vue 3 SFCs, composables, Pinia store access, or reactivity/performance issues. 触发词：script setup, composable, useXxx, defineProps, defineEmits, defineModel, Pinia, storeToRefs, shallowRef, 响应式, 性能, 重构, 代码评审。按项目实际约定取用；Vue 2 / 纯 Options API 不适用。"
license: MIT
metadata:
  author: github.com/acanzaima
  version: 1.2.1
  tags: [vue3, composition-api, script-setup, typescript, pinia, composables, reactivity, performance]
---

Vue 3 组合式 API 与 `<script setup>`、TypeScript 集成及代码组织模式的参考。

这是一份**参考库**，不是必须全盘套用的统一规范。不同项目可以只取用其中适用的部分：有相同约定的项目可以完整采用；没有这些约定的项目，只采用正确的 API 用法、副作用清理和测试建议，也不会引入额外负担。

## 使用方式：先识别，再应用

1. **确认运行时与版本**：读取 package.json 与 lockfile，确认实际 Vue、SFC 编译器、构建插件、vue-tsc、Pinia 版本及 peerDependencies；区分 SPA、SSR 和框架托管环境，不以版本范围代替安装版本。
2. **识别项目已有约定**，再决定是否套用本技能的目录与命名：

   ```bash
   rg -n "WithOut|useEmitt|defineOptions\(" src
   rg -n "composables/" src
   cat package.json
   ```

3. **只应用匹配的层级**（见下表）。已有项目优先保持既有约定；新项目、尚无约定的模块，或用户明确要求采用本技能模式时，可按职责和复杂度选用。局部修复不顺带引入新约定。
4. **默认最小改动**：除非用户明确要求重构，只修复正确性问题（响应式丢失、监听泄漏、请求竞态、类型不安全），不做结构性重排。重构前先说明收益。
5. **按任务阅读**：先选最相关的 reference，再沿必要链接补充，不默认通读全部材料。只请求评审时输出问题，不修改文件。

## 规则分级

| 层级 | 内容 | 应用方式 |
|------|------|----------|
| **A 通用语义** | 响应式与类型契约、副作用清理、请求竞态、store 解构、computed getter 无副作用 | 按相关 API 与版本检查正确性；不强制迁移到新 API 或改写等价写法 |
| **B 项目约定** | 11 步排序、SFC 内 `useXxx` 分组、`useXxxStoreWithOut`、`useEmitt`、`src/composables/` 分层、`useDesign`/`usePageIcon` | 优先沿用已有约定；新项目或用户要求时可按需采用，仍须满足各模式前提；示例中的项目封装不能假定已存在 |
| **C 可选优化** | `v-memo`、虚拟列表、`effectScope`、`Suspense`、`shallowRef` 微调 | 有明确测量或需求才用，且不得改变业务语义 |

> 部分采用是正常用法。只取用 A 层、或只参考某一篇 reference，都能获得价值；不必为了“完整遵守技能”而改造项目。

## 版本兼容性

本技能面向 **Vue 3.3+**，部分功能需要更高的次版本号：

| 特性 | 最低版本 | 参考 |
|---------|:---:|---|
| `defineOptions` | 3.3+ | [script-setup](reference/script-setup-best-practices.md) |
| 组件名按文件名推断（`<script setup>`） | 3.2.34+ | [script-setup](reference/script-setup-best-practices.md) |
| `toValue()` | 3.3+ | [script-setup](reference/script-setup-best-practices.md) |
| `defineModel` | 3.4+ | [script-setup](reference/script-setup-best-practices.md) |
| `watch` 搭配 `once` 选项 | 3.4+ | [reactivity](reference/reactivity-performance.md) |
| `useTemplateRef()` | 3.5+ | [script-setup](reference/script-setup-best-practices.md) |
| `useId()` / `app.config.idPrefix` | 3.5+ | [script-setup](reference/script-setup-best-practices.md) |
| `onWatcherCleanup()` | 3.5+ | [reactivity](reference/reactivity-performance.md) |
| 响应式 props 解构（直接解构 `defineProps()`） | 3.5+ 默认开启；旧版本默认用 `props.xxx` / `toRef`，`withDefaults` 仅设置默认值 | [script-setup](reference/script-setup-best-practices.md) |
| `useTemplateRef()` 静态模板类型推断 | 3.5+ 且 `@vue/language-tools` 2.1+ | [script-setup](reference/script-setup-best-practices.md) |
| `watch` 数值 `deep`、watch handle `pause/resume` | 3.5+ | [reactivity](reference/reactivity-performance.md) |
| `app.runWithContext()` | 3.3+，仅同步注入上下文 | [组件外上下文](reference/store-without-pattern.md#组件外-inject-与应用上下文) |

最低 API 版本不等于推荐依赖组合；发布渠道和生态依赖快照见[维护策略](reference/maintenance-strategy.md#版本核对记录)。RC/Vapor 只在目标项目采用时查对应版本文档，不默认升级或套用预发布行为。

## 快速决策表

| 问题 | 参考阅读 |
|---------|-------------|
| 我的 `<script setup>` 很乱，难以浏览 | [SFC 代码组织](reference/sfc-code-organization.md) |
| 某个功能的逻辑分散在很多行中 | [useXxx 函数模式](reference/use-function-pattern.md) |
| 相同逻辑在多个组件中重复 | [功能提取](reference/feature-extraction.md) |
| 两个功能相互影响，但不知道正确的处理模式 | [跨功能依赖](reference/cross-feature-dependencies.md) |
| Props/emits 类型安全、`defineModel` 使用 | [script setup 最佳实践](reference/script-setup-best-practices.md) |
| 在 composables/工具函数/插件中无法访问 Store | [组件外 Store 访问](reference/store-without-pattern.md) |
| 如何组织新的组合式函数文件 | [组合式函数设计模式](reference/composable-design-patterns.md) |
| 页面感觉慢，可能是响应性问题 | [响应性与性能](reference/reactivity-performance.md) |
| 如何测试组合式函数 | [组合式函数测试](reference/composable-design-patterns.md#9-测试-composable) |
| 类型安全的 `provide`/`inject` | [script setup - Provide/Inject](reference/script-setup-best-practices.md#provideinject-与-typescript) |
| 10+ 个功能的大型页面，全部参数注入太冗长 | [跨功能依赖 - 模式 6](reference/cross-feature-dependencies.md#模式-6页面级编排混合策略) |
| 想看完整 SFC 重构前后对照 | [SFC 重构示例](examples/sfc-refactor.md) |
| 想验证 skill 是否稳定引导重构 | [Golden 回归用例](examples/golden/README.md) |
| 想维护或发布新版本 | [维护与更新策略](reference/maintenance-strategy.md) |

### 代码组织
- SFC 代码缺乏清晰的组织结构 → 参见 [sfc-code-organization](reference/sfc-code-organization.md)
- 功能逻辑分散在脚本各处 → 参见 [use-function-pattern](reference/use-function-pattern.md)
- 需要将可复用逻辑提取为组合式函数 → 参见 [feature-extraction](reference/feature-extraction.md)
- 跨功能依赖导致混乱 → 参见 [cross-feature-dependencies](reference/cross-feature-dependencies.md)

### TypeScript 与 Script Setup
- 需要 script setup 的 TypeScript 最佳实践 → 参见 [script-setup-best-practices](reference/script-setup-best-practices.md)

### Store 集成
- 在 Vue 组件外部访问 Pinia store → 参见 [store-without-pattern](reference/store-without-pattern.md)

### 组合式函数设计
- 设计健壮、可复用的组合式函数 → 参见 [composable-design-patterns](reference/composable-design-patterns.md)

### 响应性与性能
- 优化响应性以获得更好性能 → 参见 [reactivity-performance](reference/reactivity-performance.md)

### 测试
- 使用 Vitest 测试组合式函数 → 参见 [composable-design-patterns](reference/composable-design-patterns.md#9-测试-composable)

---

## 速查表

### SFC 代码组织顺序（项目约定，中大型组件参考）

```
1. defineOptions     → 需要稳定组件名时（3.3+；3.2.34+ 可按文件名推断）
2. defineProps       → Props 类型声明
3. defineModel       → 双向绑定（3.4+）
4. inject            → 注入依赖（优先 InjectionKey）
5. defineEmits       → 事件类型声明
6. Store 声明         → useXxxStore()
7. 外部 composables   → useI18n()、useDesign() 等
8. 功能声明           → const { ... } = useFeature()
9. provide           → 提供依赖
10. defineExpose     → 暴露公共 API
11. 功能实现          → function useFeature() {}
```

> 这是团队约定，不是 Vue 官方要求。重排运行时声明可能改变初始化顺序、立即执行的 watcher 或引入暂时性死区；先按依赖初始化，再考虑分组。宏顺序可用 `vue/define-macros-order` 约束，其他语义 lint 见[维护策略](reference/maintenance-strategy.md#自动检查的边界)。

### 响应式 API 选择

```
基本类型            → ref
需要深层响应         → ref
大对象/动态组件      → shallowRef（先确认不依赖深层修改；需要时 triggerRef）
不需要重新赋值       → reactive（谨慎使用）
无需响应式          → 普通变量；对象需要进入响应式图但不应被代理时才用 markRaw
```

### Store 访问规则

```
组件 setup 内 / setup 中同步调用的 composable → useAppStore()
组件外且能拿到 pinia                        → useAppStore(pinia)
SSR、多应用、测试隔离                       → 显式传入对应 pinia，不要依赖全局单例
项目已有 WithOut 约定，且确认单应用/非请求隔离 → useAppStoreWithOut()
解构保持响应式                              → storeToRefs(store)
```

> 判断标准是**调用时能否拿到正确的 pinia 实例**，不是文件是 `.vue` 还是 `.ts`。

### 反模式 TOP 5

| # | 反模式 | 正确做法 |
|---|--------|---------|
| 1 | 普通解构 props 导致属性替换不再被追踪 | 直接用 `props.xxx` / `toRef`；Vue 3.5+ 可直接解构 `defineProps()`，传给 watcher/composable 时用 getter |
| 2 | 组件外没有 active pinia 时直接用 `useXxxStore()` | 传入 `pinia`；仅项目已有 `useXxxStoreWithOut()` 约定时沿用 |
| 3 | 将不需要深层响应的组件定义对象做深层代理 | 动态组件通常用 `shallowRef`；大型数据需要嵌套变更驱动 UI 时保留 `ref`，整体替换时再考虑 `shallowRef` |
| 4 | 混用 Options API + `<script setup>` | 只选一种风格（`<script>` + `inheritAttrs` 等官方例外除外） |
| 5 | 事件监听、定时器、请求不清理 | `onScopeDispose` / `onUnmounted` 中清理；请求用 `AbortController` 或 watcher cleanup |

### 依赖模式速查

| 场景 | 推荐模式 |
|------|---------|
| 父子组件通信 | Props + Emits |
| 兄弟功能交互 | 回调参数（`onXxxChange`） |
| 跨层级局部共享 | Provide + Inject（优先 `InjectionKey`） |
| 全局共享状态 | Pinia |
| 复杂一对多通知 | 事件总线（`mitt` / 项目封装的 `useEmitt`），仅作备选 |
| 共享状态 | Store 桥接组合式函数（先确认新增了什么职责） |
| 功能编排 | 组合式函数编排模式 |
| 大型页面多功能编排 | 混合策略（核心链显式 + 叶子闭包） |

## 完成前验证

- [ ] `vue-tsc --noEmit`（或项目类型检查）通过
- [ ] ESLint 通过；宏顺序类规则按项目配置执行
- [ ] 相关测试通过；新增/修改的 composable 有覆盖竞态与清理的用例
- [ ] 行为等价：请求次数、初始化时序、组件卸载/停用后的清理没有被重构改变
- [ ] B 层约定的采用符合项目现状和任务范围，没有在局部修复中附带结构改造
