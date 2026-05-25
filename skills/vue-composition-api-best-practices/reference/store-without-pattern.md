# Store Without 模式

## 适用前提

- 适用于使用 Pinia 且存在全局 `pinia` / `store` 导出的 Vue 项目。
- 主要解决组件外上下文（composables、utils、plugins、路由守卫、axios 拦截器）访问 store 的问题。
- SSR、微前端或测试隔离场景需要特别谨慎，避免全局 store 造成跨请求状态污染或绕过测试中的 `setActivePinia()`。

## 问题

Pinia 的 `useStore()` 默认依赖 Vue 组件上下文（inject/provide）。在组件外（composables、utils、plugins、路由守卫、axios 拦截器）直接调用会抛出错误：

```
Error: "getActivePinia()" was called but there was no active Pinia.
```

## 解决方案：Store Without 模式

`useXxxStoreWithOut` 是一种团队约定封装：每个 store 模块额外导出一个函数，内部传入全局 pinia 实例，方便组件外上下文访问 store。它不是 Pinia 官方必须采用的标准模式；如果当前项目已经直接使用 `useXxxStore(pinia)`、SSR 请求级 pinia，或其它 store 工厂封装，应优先沿用项目现有方式。

### 模式定义

```typescript
// store/modules/app.ts
import { defineStore } from 'pinia'
import { store } from '@/store'

export const useAppStore = defineStore('app', {
  // ... store 定义
})

// 在组件外使用时，传入全局 pinia 实例
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

### 何时使用哪个

| 函数 | 使用场景 | 原因 |
|------|---------|------|
| `useAppStore()` | Vue 组件 `<script setup>` 内 | 自动从组件上下文获取 pinia |
| `useAppStore(pinia)` | 组件外且调用方能拿到正确 pinia 实例 | 通用 Pinia 用法，适合 SSR、测试和多实例应用 |
| `useAppStoreWithOut()` | 项目已有全局 store 封装，且确认不需要请求级隔离 | 减少重复导入全局 pinia 的样板代码 |

### 在 Vue 组件中（始终使用标准方式）

```typescript
// ✅ GOOD：组件内使用标准方式
<script setup lang="ts">
import { useAppStore } from '@/store/modules/app'

const appStore = useAppStore()
</script>
```

```typescript
// ❌ BAD：组件内使用 WithOut 是多余的
<script setup lang="ts">
import { useAppStoreWithOut } from '@/store/modules/app'

const appStore = useAppStoreWithOut() // 可以工作但不必要
</script>
```

> ⚠️ **常见误用警告**：在 `<script setup>` 内使用 `useXxxStoreWithOut()` **不会报错**（因为 pinia 实例确实存在），所以这种误用非常隐蔽。但它绕过了 Vue 的 `inject`/`provide` 依赖注入体系，会导致以下问题：
>
> - **SSR 场景下状态污染**：`useAppStoreWithOut()` 始终返回同一个全局 pinia 实例，而 `useAppStore()` 会通过 `inject` 获取当前请求级别的实例，避免服务端渲染时的跨请求状态泄露
> - **测试时无法隔离**：单元测试中无法通过 `setActivePinia(createPinia())` 替换 store——`WithOut` 版本硬编码了全局实例，绕过了测试隔离机制
> - **组件复用性降低**：如果组件被嵌入到另一个 pinia 实例的应用中（如微前端场景），`WithOut` 会连接到错误的 store
>
> **记住**：`WithOut` 的后缀字面意思就是"在没有组件上下文的地方使用"。如果你在 `<script setup>` 里——你有上下文，就别用 `WithOut`。

### 在 Composables / Utils / Plugins 中（按项目约定选择）

```typescript
// ✅ GOOD：项目已有 WithOut 封装时，在 composables 中沿用
// composables/business/useSideCategory.ts
import { useBusinessStoreWithOut } from '@/store/modules/business'

export function useSideCategory() {
  const businessStore = useBusinessStoreWithOut()
  const categories = computed(() => businessStore.getSideCategory)
  return { categories }
}
```

```typescript
// ✅ GOOD：调用方能拿到 pinia 实例时，直接传入 pinia
import type { Pinia } from 'pinia'
import { useBusinessStore } from '@/store/modules/business'

export function createSideCategory(pinia: Pinia) {
  const businessStore = useBusinessStore(pinia)
  const categories = computed(() => businessStore.getSideCategory)
  return { categories }
}
```

```typescript
// ✅ GOOD：utils 中使用 WithOut
// utils/migration.ts
import { useBusinessStoreWithOut } from '@/store/modules/business'

export async function migrateOnlineIcons() {
  const businessStore = useBusinessStoreWithOut()
  // ...
}
```

```typescript
// ❌ BAD：组件外直接使用标准方式会报错
// utils/migration.ts
import { useBusinessStore } from '@/store/modules/business'

export async function migrateOnlineIcons() {
  const businessStore = useBusinessStore() // Error: no active Pinia
}
```

## 命名规范

如果项目采用 Store Without 封装，建议所有模块遵循统一命名规范：

| Store 模块 | 标准函数 | WithOut 函数 |
|-----------|---------|-------------|
| `app.ts` | `useAppStore` | `useAppStoreWithOut` |
| `business.ts` | `useBusinessStore` | `useBusinessStoreWithOut` |
| `dict.ts` | `useDictStore` | `useDictStoreWithOut` |
| `locale.ts` | `useLocaleStore` | `useLocaleStoreWithOut` |

**规则**：`use{ModuleName}StoreWithOut` — 模块名首字母大写 + Store + WithOut（注意大小写）。

## 实现清单

采用 Store Without 封装时，每个 store 模块建议：

- [ ] 导出标准 `useXxxStore` 函数（`defineStore` 的返回值）
- [ ] 导出 `useXxxStoreWithOut` 函数，内部调用 `useXxxStore(store)`
- [ ] 从 `@/store` 导入全局 `store` 实例
- [ ] WithOut 函数放在文件底部，紧跟标准函数之后

## 为什么不直接使用 `useXxxStore(pinia)`？

可以直接调用 `useAppStore(pinia)`，这是更通用、也更适合 SSR / 测试隔离的方式。`WithOut` 函数适合作为项目约定封装，提供：

1. **语义明确** — 函数名直接表达"在组件外使用"的意图
2. **统一入口** — 不需要每个调用方都 import `store`，减少依赖
3. **集中管理** — 如果 pinia 实例获取方式变更，只需改 WithOut 函数
4. **可搜索** — 搜索 `WithOut` 即可找到所有组件外使用 store 的地方

## 替代方案：`storeToRefs` 注意事项

注意 `useXxxStoreWithOut()` 返回的是 store 实例，如需解构响应式属性，仍需使用 `storeToRefs`：

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
| 解决组件外访问 | 让 store 可在缺少组件上下文但存在全局 pinia 的地方使用 |
| 命名约定清晰 | `WithOut` 后缀一目了然 |
| 减少样板代码 | 调用方无需 import store |
| 易于维护 | pinia 实例变更只需改一处 |
| 可追溯 | 搜索 `WithOut` 可定位所有组件外使用 |
