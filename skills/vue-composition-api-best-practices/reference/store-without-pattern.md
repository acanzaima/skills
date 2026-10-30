# 组件外访问 Store（含 Store Without 约定）

## 适用前提

- 项目使用 Pinia，并且存在组件外访问 store 的需求（composables、utils、plugins、路由守卫、axios 拦截器）。
- 本文先讲**判断标准**，再把 `useXxxStoreWithOut` 作为一种**项目约定**介绍。
- SSR、微前端、多应用和测试隔离场景，必须显式使用对应的 pinia 实例；不要依赖全局单例。

## 问题：判断标准不是“文件位置”

Pinia 的 `useStore()` 在调用时会按顺序寻找 pinia：

1. 当前组件注入上下文（`inject`）；
2. 全局 `activePinia`。

两者都没有时才会抛错：

```
Error: "getActivePinia()" was called but there was no active Pinia.
```

因此，是否报错取决于**调用时机和实例归属**，而不是代码写在 `.vue` 还是 `.ts` 文件里：

| 调用位置 | 是否有上下文 | 结果 |
|----------|--------------|------|
| 组件 `setup()` 内 | 有 | `useStore()` 正常 |
| 从 `setup()` **同步**调用的 composable | 仍有注入上下文 | `useStore()` 正常 |
| 单应用 SPA，`app.use(pinia)` 之后 | 没有注入上下文，但有 `activePinia` | 通常也能工作，但依赖隐式全局状态 |
| SSR / 多应用 / 并行测试 | 实例可能不同或互相覆盖 | 必须显式传入对应 pinia |
| `app.use(pinia)` 之前、未设置 `activePinia` 的测试或工具脚本 | 都没有 | 抛错 |

> “能工作”不等于“应该依赖”。显式传入 pinia 仍然更适合 SSR、多实例和测试隔离。

## 场景与做法

| 场景 | 推荐做法 | 原因 |
|------|----------|------|
| 组件 `<script setup>` | `useAppStore()` | 使用当前组件注入的实例 |
| 从 setup 同步调用的 composable | `useAppStore()` | 仍在注入上下文中 |
| 组件外，调用方能拿到 pinia | `useAppStore(pinia)` 或工厂函数 | 实例归属明确，可测试、可 SSR |
| 单应用 SPA，确认不需要请求级隔离 | 可使用 `activePinia`，或项目封装的 `WithOut` | 少写样板，但接受全局单例 |
| SSR / 多应用 / 测试 | 显式 `pinia` 参数 | 避免跨请求、跨应用状态污染 |

## Store Without 约定（项目封装）

### 组件外 inject 与应用上下文

插件/工具需要读取 `app.provide()` 的依赖时，Vue 3.3+ 可在 `app.runWithContext(() => inject(KEY))` 的**同步回调**中取得依赖，再显式传给后续异步工作。它不创建组件实例，不触发组件生命周期，也不会跨 await 保留注入上下文。Pinia 的实例归属仍优先用 `useStore(pinia)` 表达；不要为了普通 store 访问增加一层上下文包装。

应用级监听器或连接需要应用级销毁入口；Vue 3.5+ 可注册 `app.onUnmount(dispose)`。这不代替 SSR 请求级资源管理，也不保证服务端渲染结束会调用应用卸载。

参考：[Vue Application API](https://vuejs.org/api/application.html#app-runwithcontext)。

`useXxxStoreWithOut` 是团队约定封装：每个 store 模块额外导出一个函数，内部传入项目全局 pinia 实例。**它不是 Pinia 官方必须采用的标准模式**；如果项目已经使用 `useXxxStore(pinia)`、请求级 pinia 或其它工厂封装，应优先沿用现有方式。

### 模式定义

```typescript
// store/modules/app.ts
import { defineStore } from 'pinia'
import { store } from '@/store'

export const useAppStore = defineStore('app', {
  // ... store 定义
})

// 组件外使用时，传入项目全局 pinia 实例
export const useAppStoreWithOut = () => {
  return useAppStore(store)
}
```

### 全局 Pinia 实例

```typescript
// store/index.ts
import { createPinia } from 'pinia'

const pinia = createPinia()

export default pinia

// 导出 store 供 Without 函数使用
export const store = pinia
```

## 使用规则

### 在 Vue 组件中：使用标准方式

```vue
<script setup lang="ts">
import { useAppStore } from '@/store/modules/app'

const appStore = useAppStore()
</script>
```

```vue
<!-- BAD：组件内使用 WithOut 是多余的 -->
<script setup lang="ts">
import { useAppStoreWithOut } from '@/store/modules/app'

const appStore = useAppStoreWithOut()
</script>
```

> **常见误用警告**：在 `<script setup>` 内使用 `useXxxStoreWithOut()` 不会报错，因为全局 pinia 确实存在，所以这种误用非常隐蔽。但它绕过了组件注入体系，会带来：
>
> - **SSR 状态污染**：`WithOut` 始终返回同一个全局实例，而 `useAppStore()` 会获取当前请求级别的实例；
> - **测试无法隔离**：`setActivePinia(createPinia())` 对硬编码全局实例的 `WithOut` 无效；
> - **微前端/多应用连错实例**。
>
> `WithOut` 的字面意思就是“在没有组件上下文的地方使用”。在 `<script setup>` 里，你有上下文，就不要用。

### 在 composable 中：先判断调用上下文

```typescript
// ✅ 从 setup 同步调用：有注入上下文，直接用标准方式
// composables/business/useSideCategory.ts
import { useBusinessStore } from '@/store/modules/business'

export function useSideCategory() {
  const businessStore = useBusinessStore()
  const categories = computed(() => businessStore.getSideCategory)
  return { categories }
}
```

```typescript
// ✅ 需要在组件外调用：显式接收 pinia，便于 SSR 和测试
import type { Pinia } from 'pinia'
import { useBusinessStore } from '@/store/modules/business'

export function createSideCategory(pinia: Pinia) {
  const businessStore = useBusinessStore(pinia)
  const categories = computed(() => businessStore.getSideCategory)
  return { categories }
}
```

```typescript
// ✅ 项目已有 WithOut 约定时，在 utils/plugins 中沿用
// utils/migration.ts
import { useBusinessStoreWithOut } from '@/store/modules/business'

export async function migrateOnlineIcons() {
  const businessStore = useBusinessStoreWithOut()
  // ...
}
```

```typescript
// ❌ BAD：组件外且没有 active pinia 时直接用标准方式
import { useBusinessStore } from '@/store/modules/business'

export async function migrateOnlineIcons() {
  const businessStore = useBusinessStore() // Error: no active Pinia
}
```

## 命名规范（采用约定时）

| Store 模块 | 标准函数 | WithOut 函数 |
|-----------|---------|-------------|
| `app.ts` | `useAppStore` | `useAppStoreWithOut` |
| `business.ts` | `useBusinessStore` | `useBusinessStoreWithOut` |
| `dict.ts` | `useDictStore` | `useDictStoreWithOut` |
| `locale.ts` | `useLocaleStore` | `useLocaleStoreWithOut` |

**规则**：`use{ModuleName}StoreWithOut` — 模块名首字母大写 + Store + WithOut（注意大小写）。

## 实现清单（采用约定时）

- [ ] 导出标准 `useXxxStore` 函数（`defineStore` 的返回值）
- [ ] 导出 `useXxxStoreWithOut` 函数，内部调用 `useXxxStore(store)`
- [ ] 从 `@/store` 导入全局 `store` 实例
- [ ] WithOut 函数放在文件底部，紧跟标准函数之后
- [ ] 不要在 `.vue` 组件中调用 WithOut
- [ ] SSR/多应用项目不要使用这个约定，改用显式 `pinia` 参数

## 为什么优先 `useXxxStore(pinia)`？

1. **实例归属明确**：不依赖“当前是否碰巧有 active pinia”。
2. **SSR 安全**：每个请求使用自己的 pinia。
3. **可测试**：测试可以传入 `createPinia()`，无需操作全局状态。
4. **多应用/微前端安全**：不会连接到错误的全局实例。

`WithOut` 只适合作为已有项目的兼容封装；在陌生项目里不要主动引入。

## storeToRefs 注意事项

`useXxxStoreWithOut()` 返回的是 store 实例，如需解构响应式属性，仍需使用 `storeToRefs`：

```typescript
import { storeToRefs } from 'pinia'
import { useAppStoreWithOut } from '@/store/modules/app'

export function useAppInfo() {
  const appStore = useAppStoreWithOut()
  const { pure, theme } = storeToRefs(appStore) // 保持响应式
  return { pure, theme }
}
```

## 总结

| 优势 | 说明 |
|------|------|
| 解决组件外访问 | 让 store 可在缺少注入上下文、但存在全局 pinia 的地方使用 |
| 命名约定清晰 | `WithOut` 后缀一目了然 |
| 减少样板代码 | 调用方无需 import store |
| 权衡 | 绑定全局单例；SSR、多应用、测试隔离场景应改用显式 `pinia` |
