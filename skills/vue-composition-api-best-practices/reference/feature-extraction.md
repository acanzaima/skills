---
title: Feature Extraction to Composables
impact: MEDIUM
impactDescription: 未能提取可复用逻辑将导致代码重复、组件间行为不一致以及更高的维护成本
type: best-practice
tags: [vue3, composition-api, composables, reusability, dry]
---

# 将功能提取为组合式函数

**影响等级：MEDIUM** - 将通用功能提取到外部组合式函数中可以促进代码复用、保持一致性和简化测试。

## 任务清单

- [ ] 识别多个组件中使用的逻辑
- [ ] 提取到 `composables/` 目录
- [ ] 保持组合式函数专注于单一职责
- [ ] 使用参数进行配置和依赖注入
- [ ] 返回响应式引用和方法
- [ ] 考虑使用 Store 桥接模式抽象 store 访问

## 问题

当相似逻辑在多个组件中重复时，任何 bug 修复或功能增强都必须在多处应用，增加了维护负担和不一致的风险。

**BAD - 组件间重复的逻辑：**

```vue
<!-- ComponentA.vue -->
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const width = ref(window.innerWidth)
const height = ref(window.innerHeight)

function handleResize() {
  width.value = window.innerWidth
  height.value = window.innerHeight
}

onMounted(() => window.addEventListener('resize', handleResize))
onUnmounted(() => window.removeEventListener('resize', handleResize))
</script>

<!-- ComponentB.vue -->
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const width = ref(window.innerWidth)
const height = ref(window.innerHeight)

function handleResize() {
  width.value = window.innerWidth
  height.value = window.innerHeight
}

onMounted(() => window.addEventListener('resize', handleResize))
onUnmounted(() => window.removeEventListener('resize', handleResize))

// 使用 width/height 的其他逻辑...
</script>
```

**GOOD - 提取到组合式函数：**

```typescript
// composables/dom/useWindowSize.ts
import { onMounted, onUnmounted, ref } from 'vue'

export function useWindowSize() {
  // 两端首次渲染使用相同值，挂载后再读取浏览器尺寸
  const width = ref(0)
  const height = ref(0)

  function handleResize() {
    width.value = window.innerWidth
    height.value = window.innerHeight
  }

  onMounted(() => {
    handleResize()
    window.addEventListener('resize', handleResize)
  })
  onUnmounted(() => window.removeEventListener('resize', handleResize))

  return { width, height }
}
```

此版本从组件 setup 同步调用，挂载前尺寸为 `0`；测试需挂载宿主组件，而非只创建 `effectScope`。如果需要 setup 阶段的真实尺寸，应明确限定为客户端使用。

```vue
<!-- ComponentA.vue / ComponentB.vue -->
<script setup lang="ts">
import { useWindowSize } from '@/composables/dom/useWindowSize'

const { width, height } = useWindowSize()
</script>
```

## 何时提取

| 信号 | 示例 | 操作 |
|--------|---------|--------|
| 在 2+ 组件中使用 | 窗口大小、认证状态 | 提取到组合式函数 |
| 复杂逻辑 | 表单验证、分页 | 提取以提高清晰度 |
| 需要测试 | API 调用、状态机 | 提取以实现隔离 |
| 第三方集成 | 数据分析、WebSocket | 提取以实现抽象 |
| Store 访问模式 | 页面图标、侧边栏分类 | 提取为 Store 桥接组合式函数 |
| 横切关注点 | 事件总线、网络状态 | 提取以保持一致性 |

## 何时不提取

| 信号 | 更合适的做法 |
|--------|--------------|
| 只在一个组件内使用，且没有独立测试价值 | 留在组件内，按逻辑邻近组织 |
| 拆分后需要传递大量参数，只是为了“看起来模块化” | 先不拆；等职责边界真正出现 |
| 只是把几行代码换个位置，没有新增封装/复用/测试收益 | 不提取 |
| 与组件 UI 强绑定（弹窗开关、临时输入状态） | 留在组件内 |
| 提取会改变请求次数、初始化时序或清理时机 | 先明确行为契约，再决定是否提取 |

> 行数和函数数量只能作为“检查信号”，不能直接决定架构。判断依据是独立职责、复用需求、测试价值，以及拆分后是否降低理解成本。

## 提取模式

### 模式 1：简单工具组合式函数

无状态或最小状态，单一用途：

```typescript
// composables/business/useDesign.ts
import variables from '@/styles/global.module.less'

export const useDesign = () => {
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

### 模式 2：Store 桥接组合式函数

将 store 访问封装在清晰的 API 之后。这是实际项目中最具影响力的提取模式：

```typescript
// composables/business/useEngine.ts
import { useAppStore } from '@/store/modules/app'
import { SEARCH_ENGINE_INFO, SEARCH_ENGINE_ORDER } from '@/config/setting'

export const useEngine = () => {
  // 从 setup 同步调用：有注入上下文。若要在组件外调用，改为 useAppStore(pinia) 或工厂。
  const appStore = useAppStore()

  // 当前选中搜索引擎
  const selectEngine = computed(() => appStore.selectEngine)

  // 当前设定搜索引擎列表（过滤后）
  const searchEngine = computed(() =>
    SEARCH_ENGINE_ORDER.filter((engine) => appStore.searchEngine.includes(engine))
  )

  // 当前选中搜索引擎详细信息
  const engineInfo = computed(() => SEARCH_ENGINE_INFO[selectEngine.value])

  // 更新搜索引擎
  const updateSelectEngine = (val: SearchEngine) => {
    appStore.setSelectEngine(val)
  }

  // 下一个搜索引擎
  const nextEngine = () => {
    const idx = appStore.searchEngine.indexOf(selectEngine.value)
    if (idx === appStore.searchEngine.length - 1) {
      appStore.setSelectEngine(appStore.searchEngine[0])
    } else {
      appStore.setSelectEngine(appStore.searchEngine[idx + 1])
    }
  }

  return { selectEngine, engineInfo, searchEngine, nextEngine, updateSelectEngine }
}
```

**为什么 Store 桥接很重要：**
- 组件不需要 `import { useAppStore }` 和了解 store 结构
- 业务规则（例如 `SEARCH_ENGINE_ORDER.filter`）集中在一处
- 可以轻松替换 store 实现，无需修改组件
- 组件外可通过 `useXxxStore(pinia)` 或项目封装的 `useXxxStoreWithOut` 使用

### 模式 3：基于事件的组合式函数

管理副作用并在生命周期结束时自动清理。完整实现见本文 [4. 自动清理](#4-自动清理) 的 `useNetwork`，要点：

- 在 `setup()` / `effectScope` 内注册监听，由该 scope 负责清理
- 用 `onScopeDispose` 移除监听（组件内等价于卸载时）
- 先判断 `window`/`navigator`，避免 SSR 直接访问浏览器 API
- keep-alive 场景明确 `onActivated` / `onDeactivated` 契约，不要假设停用会卸载

同一个 composable 的实现只保留一份，避免不同章节出现不同契约。

### 模式 4：参数化组合式函数

接受配置以实现灵活性：

```typescript
// composables/dom/useCoordinateArea.ts
interface Coordinate { x1: number; y1: number; x2: number; y2: number }
type DirectionX = 'ltr' | 'rtl'
type DirectionY = 'ttb' | 'btt'

export const useCoordinateArea = (
  coordinate: Coordinate,
  direction: DirectionX = 'ltr',
  directionY: DirectionY = 'ttb'
) => {
  const { width, height } = useWindowSize()
  const { x, y } = useMouse()

  const { x1, y1, x2, y2 } = coordinate

  const inCoordinateX = computed(() =>
    direction === 'ltr'
      ? x.value > x1 && x.value < x2
      : x.value > width.value - x2 && x.value < width.value - x1
  )

  const inCoordinateY = computed(() =>
    directionY === 'ttb'
      ? y.value > y1 && y.value < y2
      : y.value > height.value - y2 && y.value < height.value - y1
  )

  const inCoordinate = computed(() => inCoordinateX.value && inCoordinateY.value)

  return { inCoordinate }
}
```

### 模式 5：第三方集成组合式函数

用 Vue 友好的 API 封装第三方库：

```typescript
// composables/infrastructure/useCache.ts
import WebStorageCacheCrypto from 'web-storage-cache-crypto'
import sm4 from '@/utils/cipher/sm4'

type CacheType = 'localStorage' | 'sessionStorage'

export const CACHE_KEY = {
  LANG: 'miao-lang',
  DICT_CACHE: 'dictCache',
  MIAOWING_APP: 'miaowing-app',
  MIAOWING_BUSINESS: 'miaowing-business'
}

export const useCache = (type: CacheType = 'localStorage', crypt: boolean = true) => {
  const wsCache = new WebStorageCacheCrypto({
    storage: type,
    crypt: Boolean(crypt),
    encrypt: sm4.encrypt,
    decrypt: sm4.decrypt
  })

  return { wsCache }
}
```

## 目录结构示例

推荐使用 Vue 语境更清晰的 `src/composables/` 组织组合式函数。

```
src/
├── composables/               # 组合式函数目录
│   ├── dom/                   # DOM 事件相关的组合式函数
│   │   └── useScrollTo.ts     # 平滑滚动
│   └── business/              # Web API 与业务逻辑组合式函数
│       ├── useCache.ts        # 加密存储
│       ├── useCoordinateArea.ts  # 鼠标位置检测
│       ├── useDesign.ts       # CSS 命名空间
│       ├── useEmitt.ts        # 事件总线
│       ├── useEngine.ts       # 搜索引擎（Store 桥接）
│       ├── useI18n.ts         # i18n 命名空间封装
│       ├── useLocale.ts       # 语言切换
│       ├── useLocalForage.ts  # IndexedDB 存储
│       ├── useNetwork.ts      # 网络状态
│       ├── usePageIcon.ts     # 页面图标（Store 桥接）
│       ├── useSideCategory.ts # 侧边栏分类（Store 桥接）
│       ├── useSuggestion.ts   # 搜索建议
│       └── useTimeAgo.ts      # 相对时间
```

**命名规范：**
- 文件名与函数名一致：`useEngine.ts` → `export const useEngine = () => {}`
- 按领域分组：例如 `dom/` 用于 DOM 事件，`business/` 用于 Web API 和业务逻辑
- 按职责组织文件，紧密相关的小函数可同文件

## 最佳实践

### 1. 单一职责

存储与认证分开：存储封装负责序列化、读取/写入错误和写入时机，认证模块负责会话语义。项目已有 VueUse 时优先评估 `useStorage`；仍需明确错误处理、SSR 初值、是否深层监听及写入频率。不要将 `JSON.parse` 类型断言当成数据校验，也不要把客户端加密存储当成对 XSS 的保护。

### 2. 接受 Ref 以保持响应性

```typescript
// ✅ 好 — 接受值、ref 或 getter；生命周期由当前 setup/effectScope 持有
import { ref, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

export function useSearch(query: MaybeRefOrGetter<string>) {
  const results = ref<string[]>([])
  const error = ref<unknown>(null)

  watch(
    () => toValue(query),
    async (q, _old, onCleanup) => {
      const controller = new AbortController()
      onCleanup(() => controller.abort())
      error.value = null
      if (!q.trim()) {
        results.value = []
        return
      }
      try {
        // searchAPI 是项目 API，需接收 signal；即使它忽略 abort，也不提交过期结果
        const data = await searchAPI(q, { signal: controller.signal })
        if (!controller.signal.aborted) results.value = data
      } catch (cause) {
        if (!controller.signal.aborted) error.value = cause
      }
    },
    // 静态值不会自己变化，必须 immediate 才会发出首次请求
    { immediate: true }
  )

  return { results, error }
}

// 用法
const query = ref('')
const { results } = useSearch(query) // 空输入清空结果；非空时请求
const { results: staticResults } = useSearch('static') // 立即请求一次
const { results: getterResults } = useSearch(() => query.value) // getter 也会被追踪
```

### 3. 返回响应式引用

```typescript
// ✅ 好 — 这个例子只演示状态接口，没有计时副作用
export function useCounter() {
  const count = ref(0)
  const increment = () => { count.value++ }
  return { count, increment }
}

// ❌ 差 — 返回普通值，丢失响应性
export function useCounter() {
  let count = 0
  const increment = () => { count++ }
  return { count, increment } // count 是快照，之后 increment 不更新调用方的 count
}
```

### 4. 自动清理

Composable 里优先用 `onScopeDispose` 清理副作用：组件内等价于卸载时执行，也能被 `effectScope` 测试隔离。`onUnmounted` 也可以，但它只在组件卸载时触发，keep-alive 停用不会触发。

```typescript
// ✅ 好 — 生命周期结束时清理，并避免服务端浏览器 API 报错
import { onScopeDispose, ref } from 'vue'

export const useNetwork = () => {
  const online = ref(
    typeof navigator === 'undefined' ? true : navigator.onLine
  )

  if (typeof window !== 'undefined') {
    const update = () => { online.value = navigator.onLine }

    window.addEventListener('online', update)
    window.addEventListener('offline', update)

    onScopeDispose(() => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    })
  }

  return { online }
}
```

> 如果这个 composable 在 keep-alive 页面中使用，而监听只应在页面可见时生效，需要额外在 `onDeactivated` 暂停、`onActivated` 恢复；不要假设“停用会触发卸载”。

> 环境判断只避免服务端 API 报错，不保证 hydration 一致。若首屏模板依赖 `online`，两端使用相同初始值，挂载后再同步实际网络状态；或将相关 UI 限定为客户端渲染。

## 参考

- [Vue.js Composables](https://vuejs.org/guide/reusability/composables.html)
- [VueUse - Collection of Vue Composition Utilities](https://vueuse.org/)
- [Vue.js Composition API FAQ](https://vuejs.org/guide/extras/composition-api-faq.html)
