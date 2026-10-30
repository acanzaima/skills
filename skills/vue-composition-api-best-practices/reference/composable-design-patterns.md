# 组合式函数设计模式

基于 Vue 3 Composition API 的组合式函数（composable）设计模式总结。

---

## 1. 目录结构示例

推荐使用 Vue 语境更清晰的 `src/composables/` 组织组合式函数。

```
src/composables/
├── business/               # 业务相关 composables
│   ├── useDesign.ts        # 命名空间/样式前缀
│   ├── useEmitt.ts         # 事件总线
│   ├── useEngine.ts        # 搜索引擎
│   ├── useI18n.ts          # 国际化
│   ├── useLocalForage.ts   # IndexedDB 存储
│   ├── useLocale.ts        # 语言切换
│   ├── useNetwork.ts       # 网络状态
│   ├── usePageIcon.ts      # 页面图标
│   ├── useSideCategory.ts  # 侧边栏分类
│   ├── useSuggestion.ts    # 搜索建议
│   └── useTimeAgo.ts       # 时间格式化
└── dom/                    # DOM 事件相关 composables
    └── useScrollTo.ts      # 滚动定位
```

**通用规则**：
- 按功能域划分子目录（如 `business/`、`dom/`、`infrastructure/`，或沿用项目已有的目录）
- 默认按职责组织文件；紧密相关的小函数可同文件，不把一函数一文件作为正确性要求
- 函数名以 `use` 开头

---

## 2. 五种设计模式

### 模式 1：有状态服务

封装独立的响应式状态和操作逻辑。

```typescript
// composables/business/useNetwork.ts
import { onScopeDispose, ref } from 'vue'

export function useNetwork() {
  // 避免服务端访问 navigator；这不保证两端初始渲染一致，见下方边界
  const isOnline = ref(
    typeof navigator === 'undefined' ? true : navigator.onLine
  )

  if (typeof window !== 'undefined') {
    const updateOnline = () => (isOnline.value = navigator.onLine)

    window.addEventListener('online', updateOnline)
    window.addEventListener('offline', updateOnline)

    // 信息来源是全局的，但这里的 ref 和监听器属于当前调用方
    onScopeDispose(() => {
      window.removeEventListener('online', updateOnline)
      window.removeEventListener('offline', updateOnline)
    })
  }

  return { isOnline }
}
```

**特征**：
- 每次调用创建独立状态和监听器，因此在 `setup()` 或 `effectScope` 内使用，并由该 scope 负责清理
- 如果确实需要应用级单例，应把 ref 和监听器放到模块级、只初始化一次，并提供显式销毁入口；不要靠“网络状态是全局的”来省略清理
- 在组件外调用（没有 scope）时，`onScopeDispose` 不会生效，需要调用方自行管理生命周期
- SSR 边界：服务端默认值与客户端实际网络状态可能不同。如果模板首屏依赖 `isOnline`，两端应使用相同初始值，并在 `onMounted` 后同步实际状态；或把相关 UI 限定为客户端渲染。

### 模式 2：Store 桥接

用 composable 封装 store 访问，隐藏 store 内部实现细节。

```typescript
// composables/business/usePageIcon.ts
import { computed } from 'vue'
import { useBusinessStoreWithOut } from '@/store/modules/business'

export function usePageIcon() {
  const businessStore = useBusinessStoreWithOut()

  // 当前页面的图标列表（简化示例；带分页/新增/删除的完整版见 use-function-pattern）
  const curPageIcons = computed(() => businessStore.getPageIcons)

  function addPageIcon(icon: IconItem) {
    businessStore.addPageIcon(icon)
  }

  function removePageIcon(id: string) {
    businessStore.removePageIcon(id)
  }

  return { curPageIcons, addPageIcon, removePageIcon }
}
```

```typescript
// 需要测试隔离时，提供接受 pinia 的工厂版本
import { computed } from 'vue'
import type { Pinia } from 'pinia'
import { useBusinessStore } from '@/store/modules/business'

export function createPageIcon(pinia: Pinia) {
  const businessStore = useBusinessStore(pinia)
  const curPageIcons = computed(() => businessStore.getPageIcons)

  function addPageIcon(icon: IconItem) {
    businessStore.addPageIcon(icon)
  }

  return { curPageIcons, addPageIcon }
}
```

**特征**：
- 根据项目约定访问 store：组件内可用 `useXxxStore()`，组件外可传入 `pinia` 或沿用 `useXxxStoreWithOut` 封装
- 对外暴露语义化接口，隐藏 store action 细节
- 不维护自身状态，仅转发 store 数据

**何时使用**：当多个组件需要以相同方式访问同一 store 数据，且这层封装确实新增了职责（组合多个 action、维护一致性、做数据转换）时。仅仅转发 getter/action 的包装，未必优于直接使用 store。

> 如果桥接内部使用 `WithOut`（绑定全局 pinia），测试中的 `setActivePinia(createPinia())` 不会提供隔离；需要可测试时，优先让桥接接受 `pinia` 参数或提供工厂版本。

### 模式 3：生命周期感知

自动在组件卸载时清理副作用。

```typescript
// composables/events/useEmitt.ts
import { onScopeDispose } from 'vue'
import { mittBus } from '@/utils/mitt'

export function useEmitt() {
  const listeners: Array<{ event: string; handler: (...args: any[]) => void }> = []

  function on(event: string, handler: (...args: any[]) => void) {
    mittBus.on(event, handler)
    listeners.push({ event, handler })
  }

  function emit(event: string, payload?: unknown) {
    mittBus.emit(event, payload)
  }

  // 当前 scope 销毁时自动解绑（组件内等价于卸载时）
  onScopeDispose(() => {
    listeners.forEach(({ event, handler }) => {
      mittBus.off(event, handler)
    })
    listeners.length = 0
  })

  return { on, emit }
}
```

**特征**：
- 使用 `onScopeDispose` 自动清理（组件内等价于卸载时）
- 内部维护清理队列
- 防止内存泄漏
- keep-alive 页面停用不会触发清理；如果监听只应在可见时生效，需配合 `onDeactivated`/`onActivated`

**何时使用**：涉及事件监听、定时器、DOM 事件等需要清理的副作用。

> 另见：[跨功能依赖 - 模式 4：事件总线模式](cross-feature-dependencies.md#模式-4事件总线模式复杂通知的备选方案) 了解此模式在跨组件通信中的实际应用。

### 模式 4：异步资源

封装异步资源加载，提供加载状态。

```typescript
// composables/infrastructure/useLocalForage.ts
import { computed, ref } from 'vue'
import localforage from 'localforage'

export function useLocalForage(storeName: string) {
  const store = localforage.createInstance({ name: storeName })
  const pending = ref(0)
  const loading = computed(() => pending.value > 0)

  async function getItem<T>(key: string): Promise<T | null> {
    pending.value++
    try {
      return await store.getItem<T>(key)
    } finally {
      pending.value--
    }
  }

  async function setItem<T>(key: string, value: T): Promise<void> {
    pending.value++
    try {
      await store.setItem(key, value)
    } finally {
      pending.value--
    }
  }

  return { loading, getItem, setItem }
}
```

**特征**：
- 提供 `loading` 状态
- `try/finally` 保证状态重置
- 并行操作用 pending 计数，任意任务未完成时 loading 保持 true；不使用搜索场景的“最新请求覆盖”契约
- 支持泛型返回值

**何时使用**：封装 IndexedDB、fetch、文件读取等异步操作。

### 模式 5：参数化工具

接收参数，返回计算结果或操作函数，不维护持久状态。

```typescript
// composables/business/useDesign.ts
import variables from '@/styles/global.module.less'

export function useDesign() {
  const lessVariables = variables

  const getPrefixCls = (scope: string) => {
    return `${lessVariables.namespace}-${scope}`
  }

  return {
    variables: lessVariables,
    simplePrefixCls: lessVariables.miNamespace,
    getPrefixCls
  }
}
```

```typescript
// composables/dom/useScrollTo.ts
export function useScrollTo() {
  function scrollTo(target: HTMLElement, options?: ScrollToOptions) {
    target.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
      ...options,
    })
  }

  return { scrollTo }
}
```

**特征**：
- 不维护响应式状态；DOM 滚动仍是副作用，不属于纯函数
- 参数决定返回值
- 不需要清理

**何时使用**：工具类逻辑，如样式计算、DOM 操作、格式化函数。

---

## 3. 参数设计原则

### 单一职责参数

```typescript
// ✅ GOOD: 每个参数职责明确
export function useLocalForage(storeName: string) { ... }

// ✅ GOOD: 可选参数用 Options 模式
export function useSuggestion(engine: string, options?: SuggestionOptions) { ... }
```

### Options 模式

当参数超过 2 个时，使用 Options 对象：

```typescript
interface SuggestionOptions {
  timeout?: number
  maxResults?: number
  callbackName?: string
}

export function useSuggestion(engine: string, options?: SuggestionOptions) {
  const { timeout = 5000, maxResults = 10, callbackName } = options ?? {}
  // ...
}
```

---

## 4. 返回值设计原则

### 最小暴露原则

只返回外部真正需要的：

```typescript
// ✅ GOOD: 只暴露必要的接口
export function usePageIcon() {
  const businessStore = useBusinessStoreWithOut()
  const curPageIcons = computed(() => businessStore.getPageIcons)

  function addPageIcon(icon: IconItem) { businessStore.addPageIcon(icon) }
  function removePageIcon(id: string) { businessStore.removePageIcon(id) }

  return { curPageIcons, addPageIcon, removePageIcon }
}

// ❌ BAD: 暴露了整个 store
export function usePageIconRaw() {
  const businessStore = useBusinessStoreWithOut()
  return { businessStore } // 调用方可随意修改 store
}
```

### Ref vs Computed

| 返回类型 | 使用场景 | 特征 |
|---------|---------|------|
| `computed` | 派生状态，依赖其他响应式源 | 只读，自动更新，有缓存 |
| `ref` | 独立状态 | 可读写 |
| `readonly(ref)` | 只读状态，内部可修改 | 防止外部篡改 |

```typescript
export function useSideCategory() {
  // 派生自 store → computed
  const categories = computed(() => businessStore.getSideCategory)

  // 独立状态 → ref
  const activeId = ref<string>('')

  // 只读暴露 → readonly
  const isEditing = ref(false)
  const editingState = readonly(isEditing)

  return { categories, activeId, editingState }
}
```

---

## 5. 类型设计原则

### 泛型约束

```typescript
// ✅ GOOD: 泛型支持不同数据类型
export function useLocalForage(storeName: string) {
  async function getItem<T>(key: string): Promise<T | null> { ... }
  async function setItem<T>(key: string, value: T): Promise<void> { ... }
  return { getItem, setItem }
}
```

### 输入类型严格

```typescript
// ✅ GOOD: 参数类型精确
export function useEngine(engineType: SearchEngineType) { ... }

// ❌ BAD: 参数类型过于宽泛
export function useEngine(engineType: string) { ... }
```

### 返回类型推断

让 TypeScript 自动推断返回类型，除非需要导出：

```typescript
// 一般不需要显式声明返回类型
export function usePageIcon() {
  const businessStore = useBusinessStoreWithOut()
  const curPageIcons = computed(() => businessStore.getPageIcons)

  function addPageIcon(icon: IconItem) { businessStore.addPageIcon(icon) }
  function removePageIcon(id: string) { businessStore.removePageIcon(id) }

  // TypeScript 自动推断返回 { curPageIcons: ComputedRef<...>, addPageIcon: (...) => void, ... }
  return { curPageIcons, addPageIcon, removePageIcon }
}

// 如果其他模块需要使用返回值类型，用 ReturnType 类型工具
export type PageIconReturn = ReturnType<typeof usePageIcon>
```

---

## 6. 错误处理原则

### 静默失败 vs 抛出异常

| 场景 | 策略 | 原因 |
|------|------|------|
| 非关键搜索建议等 | 可降级，保留必要的诊断渠道 | 不阻塞核心操作 |
| 业务列表/详情获取 | 暴露 error、重试与空数据的区别 | 不能把加载失败伪装为没有数据 |
| 关键操作 | 抛出异常 | 必须让调用方感知 |
| 生命周期清理 | 尽力释放所有资源并记录异常 | 不因一个清理失败跳过其余资源 |

```typescript
// 关键操作：抛出异常
export function useBackup() {
  async function exportData(): Promise<Blob> {
    const data = await collectData()
    if (!data) throw new Error('No data to export')
    return packZip(data)
  }

  return { exportData }
}
```

---

## 7. Composable 与组件的边界

### 放在 Composable 中

- 可复用的状态逻辑
- 与特定 UI 无关的数据转换
- Store 访问桥接
- 浏览器 API 封装

### 放在组件中

- 模板渲染相关计算
- 仅当前组件使用的 UI 状态（如弹窗开关）
- DOM 直接操作（通过 ref）

```typescript
// ✅ 放 composable：可复用的搜索引擎逻辑
// composables/business/useEngine.ts
export function useEngine() {
  const businessStore = useBusinessStoreWithOut()
  const currentEngine = computed(() => businessStore.getSearchEngine)
  function switchEngine() { ... }
  return { currentEngine, switchEngine }
}

// ✅ 放组件：仅当前组件使用的弹窗状态
<script setup lang="ts">
const dialogVisible = ref(false)
const openDialog = () => (dialogVisible.value = true)
</script>
```

---

## 8. 完整示例：带并发处理的 Composable

```typescript
// composables/business/useSuggestion.ts
import { onScopeDispose, ref } from 'vue'
import { useEngine } from './useEngine'
import { SUGGESTION_TIMEOUT } from '@/constants'

interface SuggestionOptions {
  timeout?: number
  maxResults?: number
}

export function useSuggestion(options?: SuggestionOptions) {
  const { currentEngine } = useEngine()
  const { timeout = SUGGESTION_TIMEOUT, maxResults = 10 } = options ?? {}

  // 状态
  const suggestions = ref<string[]>([])
  const loading = ref(false)
  let controller: AbortController | null = null
  let requestId = 0

  async function fetch(keyword: string) {
    const q = keyword.trim()
    const current = ++requestId

    // 先让旧请求失效，再处理空输入：
    // 否则清空搜索框后，旧请求仍可能回填过期建议
    controller?.abort()
    controller = null

    if (!q) {
      suggestions.value = []
      loading.value = false
      return
    }

    const ac = new AbortController()
    controller = ac
    loading.value = true

    try {
      // 通过可信 API 或后端代理获取建议，避免在客户端执行第三方脚本。
      const data = await currentEngine.value.fetchSuggestions(q, {
        signal: ac.signal,
        timeout
      })

      // 只有最新请求可以提交结果；防止请求忽略 abort 时回填旧数据
      if (current !== requestId) return
      suggestions.value = data.slice(0, maxResults)
    } catch (error) {
      if ((error as DOMException).name !== 'AbortError' && current === requestId) {
        suggestions.value = []
      }
    } finally {
      // 旧请求的 finally 不能改掉新请求的 loading
      if (current === requestId) loading.value = false
    }
  }

  // 组件卸载或 scope 销毁时取消在途请求
  onScopeDispose(() => {
    requestId++
    controller?.abort()
    controller = null
  })

  return { suggestions, loading, fetch }
}
```

这个示例综合了多种模式：
- **Options 模式**：可配置超时和最大结果数
- **异步资源**：loading 状态管理
- **并发正确性**：先失效旧请求，再用 request id 只允许最新请求提交结果和修改 loading
- **安全边界**：通过可信 API 或后端代理获取第三方建议，不在客户端注入远程脚本
- **最小暴露**：只返回 suggestions、loading、fetch
- **错误处理**：超时降级为空列表；销毁时取消在途请求

> `AbortController` + `try/finally` 本身不足以处理竞态：被取消的请求也会进入 `finally`。必须配合“当前请求标识”或“只有 controller 仍是自己时才更新状态”的判断。

---

## 9. 测试 Composable

Composable 不是“纯函数”：它可能注册生命周期、监听器和异步副作用。但它的公开接口（返回的 ref/computed/方法）通常可以独立测试。推荐使用 **Vitest + @vue/test-utils**。响应式 effect 和 `onScopeDispose` 可用 `effectScope` 隔离；含组件生命周期或注入依赖时，使用测试宿主组件实际挂载和卸载。

### 测试纯计算型 Composable

```typescript
// composables/business/__tests__/useDesign.test.ts
import { describe, it, expect } from 'vitest'
import { useDesign } from '../useDesign'

describe('useDesign', () => {
  it('should generate correct prefix class', () => {
    const { getPrefixCls } = useDesign()
    expect(getPrefixCls('layout')).toBe('mi-layout')
  })

  it('should expose namespace variables', () => {
    const { variables, simplePrefixCls } = useDesign()
    expect(variables.namespace).toBeDefined()
    expect(simplePrefixCls).toBeDefined()
  })
})
```

### 测试有状态 Composable

> 下面测试对应[功能提取中的 useEngine](feature-extraction.md#模式-2store-桥接组合式函数)，它调用标准 `useAppStore()`，可用 active pinia 隔离。若实际实现绑定 `WithOut` 全局实例，应先改成显式 pinia 参数/工厂再测试，不能照抄这个 beforeEach。

```typescript
// composables/business/__tests__/useEngine.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useEngine } from '../useEngine'

describe('useEngine', () => {
  beforeEach(() => {
    setActivePinia(createPinia()) // 每次测试前创建新的 pinia 实例
  })

  it('should return current search engine', () => {
    const { selectEngine, engineInfo } = useEngine()
    expect(selectEngine.value).toBe('baidu')
    expect(engineInfo.value.label).toBe('百度')
  })

  it('should switch to next engine', () => {
    const { selectEngine, nextEngine } = useEngine()
    nextEngine()
    expect(selectEngine.value).toBe('google')
  })

  it('should cycle back to first engine', () => {
    const { selectEngine, updateSelectEngine, nextEngine } = useEngine()
    // 切换到最后一个
    updateSelectEngine('sogou')
    nextEngine()
    expect(selectEngine.value).toBe('baidu')
  })
})
```

### 测试含生命周期的 Composable

```typescript
// composables/business/__tests__/useNetwork.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { effectScope } from 'vue'
import { useNetwork } from '../useNetwork'

describe('useNetwork', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should update when going offline', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)

    const scope = effectScope()
    const { isOnline } = scope.run(() => useNetwork())!

    expect(isOnline.value).toBe(true)

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    window.dispatchEvent(new Event('offline'))
    expect(isOnline.value).toBe(false)

    scope.stop()
  })

  it('should remove listeners when the scope is disposed', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const scope = effectScope()

    scope.run(() => useNetwork())
    scope.stop()

    expect(removeSpy).toHaveBeenCalledWith('online', expect.any(Function))
    expect(removeSpy).toHaveBeenCalledWith('offline', expect.any(Function))
  })
})
```

### 测试异步 Composable

```typescript
// composables/infrastructure/__tests__/useLocalForage.test.ts
// 需要 IndexedDB 环境：在测试 setup 中引入 fake-indexeddb/auto，
// 或把该测试放到真实浏览器（Playwright/Vitest browser mode）中运行。
import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import { useLocalForage } from '../useLocalForage'

describe('useLocalForage', () => {
  it('should get and set items', async () => {
    const { setItem, getItem, loading } = useLocalForage('test')

    await setItem('key1', { name: 'test' })
    expect(loading.value).toBe(false)

    const result = await getItem<{ name: string }>('key1')
    expect(result?.name).toBe('test')
  })

  it('should handle missing items', async () => {
    const { getItem } = useLocalForage('test')
    const result = await getItem('nonexistent')
    expect(result).toBeNull()
  })
})
```

### 测试 Store Bridge Composable

Store Bridge 的测试隔离取决于它如何拿到 pinia：

- 内部使用 `useXxxStore(pinia)` 或工厂版本 → 测试传入 `createPinia()`
- 内部使用 `useXxxStoreWithOut()`（绑定全局实例）→ `setActivePinia(createPinia())` **不会隔离**，应改为工厂/参数注入，或只测试不依赖 store 的纯逻辑

```typescript
// composables/business/__tests__/usePageIcon.test.ts
import { describe, it, expect } from 'vitest'
import { createPinia } from 'pinia'
import { createPageIcon } from '../usePageIcon'

describe('createPageIcon', () => {
  it('should add page icon', () => {
    const pinia = createPinia()
    const { addPageIcon, curPageIcons } = createPageIcon(pinia)

    addPageIcon({
      label: '测试',
      url: 'https://example.com',
      icon: 'test-icon',
      iconType: 'online',
      type: 'icon'
    })

    expect(curPageIcons.value.length).toBe(1)
    expect(curPageIcons.value[0].label).toBe('测试')
  })
})
```

### 测试原则

| 原则 | 说明 |
|------|------|
| 每个 test 独立 | 优先给 composable 传 `createPinia()` 的工厂；使用全局 store 时，`setActivePinia` 对 `WithOut` 无效 |
| 只测试公开接口 | 只测 `return` 的值和方法，不测内部实现 |
| Mock 副作用 | 网络请求、浏览器 API 用 `vi.spyOn` / `vi.mock` 隔离 |
| 覆盖边界情况 | 空输入、异常路径、极限值、请求竞态（清空输入、连续请求、卸载） |
| 测试异步行为 | 用 `async/await` + 断言 `loading` 状态变化；用可控 Promise 控制完成顺序 |
| 作用域隔离 | `watch`、`computed`、`onScopeDispose` 可用 `effectScope()` 包裹，结束时 `scope.stop()` |
| 组件生命周期与注入 | 含 `onMounted`、`onUnmounted` 或组件注入依赖时，用测试宿主组件调用 composable，提供所需依赖并实际 mount/unmount；独立 `effectScope` 不创建组件实例，也不触发这些钩子 |

**目录结构建议：**

```
src/composables/
├── business/
│   ├── __tests__/           # 测试文件目录
│   │   ├── useDesign.test.ts
│   │   ├── useEngine.test.ts
│   │   ├── useNetwork.test.ts
│   │   ├── usePageIcon.test.ts
│   │   └── useLocalForage.test.ts
│   ├── useDesign.ts
│   ├── useEngine.ts
│   └── ...
```
