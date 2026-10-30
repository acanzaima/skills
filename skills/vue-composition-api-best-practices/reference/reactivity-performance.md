# 响应性与性能

Vue 3 Composition API 响应式与性能优化最佳实践。

## 适用前提

- 适用于 Vue 3 Composition API 项目；部分 API 有版本要求，请先对照主文档的版本兼容性表。
- `watch` 的 `once` 选项需要 Vue 3.4+，`onWatcherCleanup()` 需要 Vue 3.5+。
- VueUse、虚拟列表库等属于可选工具；仅在项目已引入或性能问题明确时采用。

---

## 1. ref vs shallowRef vs reactive

### 选择决策树

```
需要响应式？
├── 是 → 数据是基本类型？
│        ├── 是 → ref
│        └── 否 → 数据层级深？
│                 ├── 浅层即可 → shallowRef
│                 └── 需要深层 → ref（或 reactive）
└── 否 → 普通变量；需要防止进入响应式图后被代理时才 markRaw
```

### 对比表

| API | 响应深度 | 触发更新方式 | 适用场景 |
|-----|---------|-------------|---------|
| `ref` | 深层 | 自动 | 通用场景，对象属性变更需触发更新 |
| `shallowRef` | 浅层（.value） | 替换 .value；原地深层修改可用 `triggerRef` | 大型对象、动态组件、性能敏感场景 |
| `reactive` | 深层 | 自动 | 不需要重新赋值的对象 |

### ⚠️ reactive 的局限性

虽然 `reactive` 在某些场景下很方便，但 Vue 3 官方更推荐用 `ref` 作为主要响应式 API：

```typescript
// ❌ 1. 不能重新赋值 -- 整个替换会丢失响应式
let state = reactive({ count: 0 })
state = reactive({ count: 1 }) // 响应式连接断开！

// ✅ 用 ref 没问题
const state = ref({ count: 0 })
state.value = { count: 1 } // 正常触发更新

// ❌ 2. 解构丢失响应式
const { count } = reactive({ count: 0 }) // count 变成了普通数字

// ✅ 用 toRefs 保持响应式
const { count } = toRefs(reactive({ count: 0 }))

// ❌ 3. 不支持基本类型
const count = reactive(0) // 类型错误！

// ✅ 基本类型用 ref
const count = ref(0)
```

**经验法则：** 新代码优先使用 `ref`，仅在明确需要"对象属性级响应式且确定不会重新赋值"时使用 `reactive`。

### 实际案例：动态组件切换

```typescript
// ✅ GOOD: 使用 shallowRef 避免组件对象的深层响应式开销
function usePage() {
  const activeCom = shallowRef()
  const isPure = computed(() => appStore.pure)

  watchEffect(() => {
    // 组件对象不需要深层响应式，shallowRef 足矣
    activeCom.value = isPure.value ? PureMode : HomeMode
  })

  return { activeCom }
}
```

```typescript
// ❌ BAD: 用 ref 包组件对象会创建深层响应式代理
function usePage() {
  const activeCom = ref() // 组件定义对象不需要深层响应式
  // ...
}
```

> 更正一个常见说法：`ref()` 不会在创建时“递归遍历所有属性”；Vue 3 的 `reactive`/`ref` 使用惰性代理。对动态组件用 `shallowRef` 的真正理由是：组件定义对象不需要深层响应式，深层代理既无意义，也可能带来额外的代理开销和身份差异。

### shallowRef 手动触发更新

```typescript
const list = shallowRef<string[]>(['a', 'b', 'c'])

// ❌ 不会触发更新：修改数组内部不会被追踪
list.value.push('d')

// ✅ 触发更新：替换整个 .value
list.value = [...list.value, 'd']

// ✅ 触发更新：使用 triggerRef
list.value.push('d')
triggerRef(list)
```

> 不要把“大对象”机械地换成 `shallowRef`。先确认数据更新方式：
> - 整体替换对象/数组 → `shallowRef` 合适；
> - 需要原地修改嵌套字段（可编辑表格、树节点、复杂表单）→ 用 `ref`，或统一改成不可变更新后再替换；
> - 只是偶尔修改 → `shallowRef` + `triggerRef`，但要清楚每次手动触发的范围。
>
> 换用 `shallowRef` 后，嵌套修改不再触发界面更新，这是行为变化，不是纯性能优化。

### markRaw — 标记对象永不转为响应式

当确定某个对象不需要响应式时（如第三方库实例、大型静态数据），用 `markRaw` 标记它。这可以防止 Vue 的响应式系统意外地将其深层代理，避免性能浪费：

```typescript
import { markRaw, reactive, shallowRef } from 'vue'

// 普通 new Map() 本身不会创建代理；需要进入 reactive 又不希望代理时标记
const mapInstance = markRaw(new Map())
const state = reactive({
  map: mapInstance // map 本身不会被代理
})

// ✅ GOOD: 标记大型静态数据
const largeStaticConfig = markRaw({
  // 数千行配置数据...
})
const appState = shallowRef({
  config: largeStaticConfig // config 不会被 deep-track
})
```

**何时使用 `markRaw`：**
- 第三方库实例（如 Leaflet 地图、Monaco Editor、ECharts 实例）
- 大型静态数据对象（如国家/地区列表、字典数据）
- 已经冻结的数据（`Object.freeze`）通常无需再 markRaw
- 明确不会被 UI 修改、且不希望被深层代理的运行时对象

**⚠️ 注意：** `markRaw` 是永久性的，标记后无法撤销。被标记的对象在 `reactive`/`ref` 中会被视为非响应式。

标记只作用于对象自身；把它内部未标记的子对象单独放进另一个 reactive 对象，子对象仍可能被代理。不要假定整棵对象树都被永久排除。

---

## 2. computed 缓存优化

### computed 的缓存特性

- 只在依赖变化时重新计算
- 多次访问只计算一次
- 适合派生状态和昂贵计算

Vue 3.4+ 的 computed 结果未变化时，不再触发依赖它的 effect；但每次返回新对象会改变引用，无法获得这项收益。只有测量发现热点时再考虑稳定结果引用，不为此到处添加深比较。参见[官方 computed 稳定性说明](https://vuejs.org/guide/best-practices/performance.html#computed-stability)。

### 何时用 computed vs 方法

```typescript
// ✅ GOOD: 派生状态用 computed，有缓存
const filteredList = computed(() =>
  list.value.filter(item => item.active)
)

// ❌ BAD: 用方法返回派生值，每次调用都重新计算
function getFilteredList() {
  return list.value.filter(item => item.active)
}
```

### computed 写入（双向绑定）

```typescript
const keyword = computed({
  get: () => searchStore.keyword,
  set: (val: string) => { searchStore.keyword = val }
})
```

### 避免在 computed 中产生副作用

```typescript
// ❌ BAD: computed 中有副作用
const userInfo = computed(() => {
  fetchUserInfo()  // 每次依赖变化都会请求
  return userStore.info
})

// ✅ GOOD: 用 watch 处理副作用
const userInfo = computed(() => userStore.info)
watch(userId, (newId) => {
  fetchUserInfo(newId)
}, { immediate: true })
```

---

## 3. watch 优化

### watch vs watchEffect

| API | 依赖追踪 | 访问旧值 | 精确控制 | 适用场景 |
|-----|---------|---------|---------|---------|
| `watch` | 显式指定 | ✅ | ✅ | 需要旧值对比、精确监听 |
| `watchEffect` | 自动追踪 | ❌ | ❌ | 副作用与响应式源直接关联 |

### watch 的精确控制

```typescript
// ✅ GOOD: 精确监听特定属性
watch(
  () => appStore.theme,
  (newTheme) => { applyTheme(newTheme) }
)

// ❌ BAD: 监听整个 store，任何变化都触发
watch(
  () => appStore,
  () => { applyTheme(appStore.theme) },
  { deep: true }  // 深层监听开销大
)
```

### 常用选项

直接监听 reactive 对象会隐式深层监听；getter 返回对象通常只追踪替换，除非显式 deep。Vue 3.5+ 可用 `deep: 1` 等数值限制遍历深度，深度应按目标结构选择。`immediate: true` 与 `once: true` 同用时，立即调用会消耗这一次执行。

```typescript
watch(source, callback, {
  immediate: true,  // 创建时立即执行一次
  deep: false,      // 避免深层监听（默认 false）
  once: true,       // 只触发一次后自动停止（Vue 3.4+）
  flush: 'post',    // DOM 更新后执行（需要访问更新后的 DOM 时使用）
})
```

### watch 中清理副作用

以下是清理注册片段，省略 loading；完整的“最新请求生效”状态管理见[异步基准](composable-design-patterns.md#8-完整示例带并发处理的-composable)。

```typescript
watch(id, (newId, oldId, onCleanup) => {
  const controller = new AbortController()

  fetch(`/api/user/${newId}`, { signal: controller.signal })
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    })
    .then(data => { if (!controller.signal.aborted) user.value = data })
    .catch(error => { if (!controller.signal.aborted) requestError.value = error })

  // id 变化时取消上一次请求
  onCleanup(() => controller.abort())
})
```

### onWatcherCleanup (Vue 3.5+)

**Vue 3.5 引入了 `onWatcherCleanup()`** — 可以在 `watch` 或 `watchEffect` 内部直接调用的清理注册函数。Vue 3.0+ 已经支持通过回调参数注册清理；`onWatcherCleanup()` 的价值是让清理逻辑不必依赖回调参数传递，在抽取辅助函数时更方便。

```typescript
import { watchEffect, onWatcherCleanup } from 'vue'

// ✅ Vue 3.5+: 不依赖回调参数，直接注册 watcher 清理函数
watchEffect(() => {
  const controller = new AbortController()

  fetch(`/api/user/${userId.value}`, { signal: controller.signal })
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    })
    .then(data => { if (!controller.signal.aborted) user.value = data })
    .catch(error => { if (!controller.signal.aborted) requestError.value = error })

  // userId 变化或组件卸载时自动取消请求
  onWatcherCleanup(() => controller.abort())
})
```

**对比回调参数里的 `onCleanup`：**

| 特性 | `onCleanup` 回调参数 | `onWatcherCleanup()` |
|------|----------------------|----------------------|
| 可用性 | Vue 3.0+ | Vue 3.5+ |
| 清理触发时机 | 下次执行前 + 卸载时 | 下次执行前 + 卸载时 |
| 使用方式 | 从 `watch` / `watchEffect` 回调参数接收 | 从 `vue` 导入后在当前 watcher 内调用 |
| await 边界 | 绑定 watcher，不受同样的同步调用限制；仍应尽早注册 | 必须在 watcher 同步执行期间注册，不能放在 await 后 |
| 适用场景 | 简单 watcher 内联清理 | 清理逻辑需要抽取到辅助函数或减少参数传递 |

**什么时候使用 `onWatcherCleanup`：** 当清理逻辑需要放进内部辅助函数、组合式函数或更深的调用栈时，它比层层传递 `onCleanup` 参数更清晰。对于简单的内联 watcher，继续使用 `onCleanup` 参数也完全可以。

辅助函数也必须在当前 watcher 的同步调用链中执行。`watchEffect(async () => ...)` 只追踪第一个 await 前读取的依赖；普通异步回调中新建的 watcher 不能假定由组件自动清理，应保存 stop 或使用明确的 scope。

Vue 3.5+ 的 watch handle 支持 `pause()` / `resume()` / `stop()`。暂停只控制 watcher 的响应，不会取消已启动的请求、定时器或事件监听。KeepAlive 页面如需暂停轮询，仍应在 `onDeactivated` 停止计时/取消请求，在 `onActivated` 按契约恢复，不能用 `pause()` 代替资源清理。

---

## 4. 事件监听清理

### 组件级自动清理

```typescript
// ✅ GOOD: 在 composable 中使用 scope 清理
import { onScopeDispose } from 'vue'
import { mittBus } from '@/utils/mitt'

export function useEmitt() {
  const listeners: Array<{ event: string; handler: (...args: any[]) => void }> = []

  function on(event: string, handler: (...args: any[]) => void) {
    mittBus.on(event, handler)
    listeners.push({ event, handler })
  }

  onScopeDispose(() => {
    listeners.forEach(({ event, handler }) => {
      mittBus.off(event, handler)
    })
    listeners.length = 0
  })

  return { on, emit: mittBus.emit }
}
```

> 另见：[组合式函数设计模式 - 模式 3](composable-design-patterns.md#模式-3生命周期感知) 和 [跨功能依赖 - 模式 4](cross-feature-dependencies.md#模式-4事件总线模式复杂通知的备选方案) 了解 `useEmitt` 的更多使用场景。

### DOM 事件清理

```typescript
// ✅ 使用 VueUse 的 useEventListener 自动清理
import { useEventListener } from '@vueuse/core'
import { onMounted, ref } from 'vue'

export function useNetwork() {
  const isOnline = ref(true)
  onMounted(() => {
    isOnline.value = navigator.onLine
  })
  // 在组件 setup 内同步注册，服务端目标为 undefined；首屏值两端一致
  const target = typeof window === 'undefined' ? undefined : window
  useEventListener(target, 'online', () => (isOnline.value = true))
  useEventListener(target, 'offline', () => (isOnline.value = false))
  return { isOnline }
}
```

### 手动清理模式

```typescript
// 对于不支持生命周期钩子的场景，提供 stop 函数
import { getCurrentScope, onScopeDispose } from 'vue'

export function useInterval(fn: () => void, delay: number) {
  let timer: ReturnType<typeof setInterval> | null = null

  function start() {
    stop()
    timer = setInterval(fn, delay)
  }

  function stop() {
    if (timer !== null) {
      clearInterval(timer)
      timer = null
    }
  }

  // 组件卸载 / effectScope 销毁时清理；组件内也可用 onUnmounted
  if (getCurrentScope()) onScopeDispose(stop)

  return { start, stop }
}
```

组件外调用者必须显式 `stop()`。3.5+ 的 `onScopeDispose(fn, true)` 只抑制“无 active scope”警告，不会凭空创建清理归属。

---

## 5. 组件懒加载

### defineAsyncComponent

```typescript
import { defineAsyncComponent } from 'vue'

// ✅ GOOD: 懒加载重型组件
const HeavyChart = defineAsyncComponent(() =>
  import('@/components/Chart/src/HeavyChart.vue')
)
```

### 动态 import + shallowRef

```typescript
// ✅ GOOD: 过期加载不得覆盖最新选择；组件外需由调用方停止 watcher
const activeCom = shallowRef<Component>()
const loadError = shallowRef<unknown>(null)

watchEffect(async (onCleanup) => {
  let stale = false
  onCleanup(() => { stale = true })
  loadError.value = null
  if (!condition.value) {
    activeCom.value = LightComponent
    return
  }
  try {
    const mod = await import('./HeavyComponent.vue')
    if (!stale) activeCom.value = mod.default
  } catch (error) {
    if (!stale) {
      loadError.value = error
      activeCom.value = LightComponent
    }
  }
})
```

### Suspense 配合

```vue
<template>
  <Suspense>
    <template #default>
      <AsyncComponent />
    </template>
    <template #fallback>
      <LoadingSpinner />
    </template>
  </Suspense>
</template>
```

> `Suspense` 在 Vue 3.5 仍是实验性 API，行为可能在次版本中调整。生产环境优先用 `defineAsyncComponent` + 显式 loading/error 状态；只有确认团队接受实验性 API 时再使用 Suspense。

---

## 6. v-once 与 v-memo

### v-once：只渲染一次

```vue
<template>
  <!-- 只在首次渲染时求值，后续更新跳过 -->
  <div v-once>{{ staticContent }}</div>
</template>
```

> 只对真正静态、永不变化的内容使用。依赖响应式数据时，后续修改不会更新，容易造成“数据变了页面不变”的 bug。

### v-memo：条件记忆

```vue
<template>
  <!-- 仅当 item.id 变化时重新渲染 -->
  <div v-memo="[item.id]">
    <ExpensiveComponent :item="item" />
  </div>
</template>
```

> memo 的依赖数组必须覆盖**所有影响渲染的值**。如果同 `id` 的对象内容可能被替换（列表刷新、服务端返回值更新），`[item.id]` 会跳过必要更新；此时应把 `item` 版本号、更新时间等加入依赖，或不要使用 v-memo。

---

## 7. 列表渲染优化

### key 的正确使用

```vue
<!-- ✅ GOOD: 使用唯一 ID -->
<div v-for="item in list" :key="item.id">

<!-- ❌ BAD: 使用 index -->
<div v-for="(item, index) in list" :key="index">
```

### 虚拟列表

当长列表渲染成为瓶颈时再引入虚拟滚动。先测量（Vue DevTools Performance / 浏览器 Performance 面板），再决定：

- 100 个简单文本节点通常不需要虚拟滚动
- 100 个复杂表单行可能已经明显卡顿
- 列表项高度不固定、需要 SEO/打印时，虚拟列表的代价更高

```typescript
// 推荐 vueuse/useVirtualList 或第三方库
import { useVirtualList } from '@vueuse/core'

const { list, containerProps, wrapperProps } = useVirtualList(
  largeList,
  { itemHeight: 48, overscan: 10 }
)
```

---

## 8. 响应式解包注意事项

### 模板自动解包

在模板中，`ref` 自动解包，不需要 `.value`：

这里指模板渲染上下文的顶层绑定。普通对象内嵌 ref 并不普遍解包；reactive 数组/Map 中的 ref 元素也需要 `.value`。不要机械删除所有模板表达式中的 `.value`。

```vue
<template>
  <!-- ✅ 自动解包 -->
  <div>{{ count }}</div>

  <!-- ❌ 不需要 .value -->
  <div>{{ count.value }}</div>
</template>
```

### reactive 内的 ref 自动解包

```typescript
const state = reactive({
  count: ref(0),
  name: 'test'
})

// ✅ reactive 对象中 ref 自动解包
console.log(state.count) // 0，不需要 state.count.value
```

### 非响应式对象中的 ref 不解包

```typescript
const map = new Map<string, Ref<number>>()
map.set('a', ref(1))

// ❌ 非 reactive 对象，不会自动解包
console.log(map.get('a')) // Ref 对象，需要 .value
console.log(map.get('a')!.value) // 1
```

---

## 9. effectScope — 管理多个 Composable 的生命周期

当多个 composable 需要同时创建和销毁时，`effectScope` 可以批量管理它们的响应式 effect：

### 基础用法

```typescript
import { effectScope, ref, watchEffect, onScopeDispose } from 'vue'

// 创建独立作用域
const scope = effectScope()

scope.run(() => {
  // 在这个作用域内创建的所有 effect、watch、computed
  // 都会关联到此 scope
  const count = ref(0)

  watchEffect(() => {
    console.log(`Count: ${count.value}`)
  })

  // 注册作用域销毁时的清理函数
  onScopeDispose(() => {
    console.log('Scope disposed')
  })
})

// 一次性停止作用域内的所有 effect
scope.stop()
// 输出: "Scope disposed"
// 所有 watchEffect 停止
```

### 实际场景：Composable 工厂

```typescript
// composables/effects/useControlledEffects.ts
import { effectScope, nextTick, onScopeDispose, ref } from 'vue'

export function useControlledEffects() {
  let scope: ReturnType<typeof effectScope> | null = effectScope()
  const isActive = ref(true)

  function run(setup: () => void) {
    scope?.run(() => {
      setup()
    })
  }

  function restart() {
    scope?.stop()
    scope = effectScope()
    isActive.value = false
    nextTick(() => (isActive.value = true))
  }

  onScopeDispose(() => {
    scope?.stop()
    scope = null
  })

  return { run, restart, isActive }
}
```

**何时使用 `effectScope`：**
- 需要在组件外手动管理多个 effect 的生命周期（如插件、指令）
- 实现"批量创建/销毁"模式（如路由切换时清理上一页所有 effect）
- 编写 composable 测试时隔离 effect

**何时不需要：**
- 直接在组件内使用 composable — 组件卸载时自动清理
- 单个 `watch` / `watchEffect` — 返回的 `stop` 函数足矣

> 另见：[组合式函数测试](composable-design-patterns.md#9-测试-composable) 了解如何在测试中使用 `effectScope` 隔离 effect。

---

## 10. Store 性能优化

### storeToRefs 避免额外响应式

```typescript
import { storeToRefs } from 'pinia'

const store = useAppStore()

// ✅ 保持响应式
const { theme } = storeToRefs(store)

// ❌ 解构丢失响应式
const { pure } = store

// ❌ 不必要：toRefs 会把 store 的 action 也一起包进来
const { layout } = toRefs(store)
```

### 按需访问 Store 属性

```typescript
// ✅ 只取当前组件需要的属性
const { theme } = storeToRefs(store)

// ⚠️ 解构很多属性本身不是性能问题：
// storeToRefs 只创建 ref，不会因为“解构了”就让组件订阅全部属性。
// 只有模板/副作用里实际读取的属性才会被追踪。
// 但如果模板/子组件根本不用，就没必要暴露。
const { pure, layout } = storeToRefs(store)
```

---

## 11. SSR 边界

SSR/Nuxt 项目里，下面这些写法会在服务端报错或产生 hydration 不一致：

```typescript
// ❌ setup 期间直接访问浏览器全局
const width = ref(window.innerWidth)
const isOnline = ref(navigator.onLine)
const token = localStorage.getItem('token')
```

```typescript
// ✅ 两端首次渲染使用相同值，挂载后再读取浏览器 API
import { onMounted, ref } from 'vue'

const width = ref(0)
onMounted(() => {
  width.value = window.innerWidth
})
```

```typescript
// ✅ 网络状态也先保持两端初始值一致
import { onMounted, ref } from 'vue'

const isOnline = ref(true)
onMounted(() => {
  isOnline.value = navigator.onLine
})
```

仅判断 `typeof window` / `typeof navigator` 可以避免服务端报错，但客户端 setup 立即读取真实值时，仍可能与服务端默认值不同。模板依赖这些值时，应在挂载后更新，或将相关 UI 限定为客户端渲染。以上代码只展示首次同步；持续监听还需注册事件并清理。

检查清单：

- [ ] `window`、`document`、`navigator`、`localStorage` 访问有环境判断或放在 `onMounted`
- [ ] 首屏渲染不依赖随机数、时间戳、浏览器宽度等不稳定值，避免 hydration mismatch
- [ ] Pinia 使用请求级实例，不用全局单例
- [ ] 第三方库（ECharts、Monaco、地图）只在客户端初始化，并用 `markRaw`/`shallowRef`

## 12. 性能检查清单


### 组件级

- [ ] 确认不需要深层修改时，大型数据使用 `shallowRef` 而非 `ref`
- [ ] 动态组件使用 `shallowRef`
- [ ] 需要响应式派生与缓存时用 `computed`；普通事件计算可用方法
- [ ] 避免在 `computed` 中产生副作用
- [ ] 列表使用唯一 `key`
- [ ] 重型组件懒加载
- [ ] 只对可能进入响应式图且不应被代理的对象使用 `markRaw`
- [ ] `v-memo` 的依赖覆盖所有影响渲染的值，不滥用

### 副作用清理

- [ ] 事件监听器在 `onScopeDispose`（或 `onUnmounted`）中移除
- [ ] 定时器在 `onScopeDispose`（或 `onUnmounted`）中清除
- [ ] 异步请求使用 `AbortController` 或 watcher cleanup 取消过期请求
- [ ] `watch` 返回的 `stop` 函数在适当时机调用
- [ ] 清理在资源创建时尽早注册；`onWatcherCleanup()` 必须在 watcher 同步执行期调用
- [ ] keep-alive 页面明确 `onActivated` / `onDeactivated` 的暂停/恢复契约

### Store 使用

- [ ] 组件内用 `useXxxStore()`；组件外显式传入 `pinia`；仅项目已有约定时用 `useXxxStoreWithOut()`
- [ ] 解构 store 用 `storeToRefs`
- [ ] 避免深层 `watch` store
- [ ] 返回接口符合调用方职责，不为简单 store 读写强行增加桥接

### 响应式选择

- [ ] 基本类型用 `ref`
- [ ] 不需要深层响应的大型对象用 `shallowRef`
- [ ] 需要显式限定依赖或旧值时用 `watch`；依赖适合自动收集时用 `watchEffect`
- [ ] 区分模板顶层 ref 解包与嵌套对象/集合中的 ref
- [ ] 多个 composable 需统一生命周期管理时考虑 `effectScope`
