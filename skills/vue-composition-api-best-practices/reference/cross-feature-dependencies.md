---
title: Handling Cross-Feature Dependencies
impact: MEDIUM
impactDescription: 跨功能依赖管理不当会导致紧密耦合、不可预测的行为，以及功能交互时难以调试
type: best-practice
tags: [vue3, composition-api, dependencies, coupling, architecture, event-bus]
---

# 处理跨功能依赖

**影响级别：MEDIUM** - 当功能需要交互时，合理的依赖管理可确保行为可预测、代码可维护。

## 任务清单

本页的编排方式属于 B 层项目约定，按已有架构选择；仅修 bug 时不要求抽函数、桥接或改变闭包结构。各小节是独立示例，项目类型/API 需接入实际实现。

- [ ] 通过函数参数显式传递依赖
- [ ] 避免通过外层作用域闭包产生隐式依赖
- [ ] 使用回调函数进行跨功能通信
- [ ] 对于复杂一对多通知，可使用事件总线并自动清理
- [ ] 考虑依赖方向（单向，避免循环）
- [ ] 简单读写直接用 store；新增跨 store 协作或页面派生职责时才增加桥接

## 问题所在

功能之间经常需要交互，但隐式依赖会使代码难以理解和测试。

**BAD - 通过外层作用域产生隐式依赖：**

```vue
<script setup lang="ts">
import { ref, watch } from 'vue'

// 功能 1：搜索
const searchQuery = ref('')
const searchResults = ref([])

async function handleSearch() {
  searchResults.value = await fetchResults(searchQuery.value)
}

// 功能 2：分页 — 隐式依赖 handleSearch
const currentPage = ref(1)

watch(currentPage, () => {
  handleSearch() // 这属于哪个功能？
})

// 功能 3：筛选 — 也依赖搜索
const activeFilter = ref('all')

watch(activeFilter, () => {
  handleSearch() // 又一个隐式依赖
})

// 问题：更改筛选条件会重置页码，但顺序很重要！
// 哪个 watch 先触发？不清楚！
</script>
```

**推荐：页面持有完整查询参数，再组合筛选、分页与请求。**

可运行的数据流与请求保护见 [SFC 重构示例](../examples/sfc-refactor.md)：先初始化分页，再把 getter 传给列表功能；页面事件一次完成“更新参数 → 请求”。不要同时由 watcher 和事件回调为同一次变更重复请求。

## 依赖模式

### 模式 1：回调模式（推荐用于简单通信）

通过回调进行直接的跨功能通信：

```typescript
function usePagination(options: {
  onPageChange?: (page: number) => void
}) {
  const currentPage = ref(1)

  const goToPage = (page: number) => {
    currentPage.value = page
    options.onPageChange?.(page)
  }

  return { currentPage, goToPage }
}

// 用法
const { handleSearch } = useSearch()
const { currentPage, goToPage } = usePagination({
  onPageChange: () => handleSearch()
})
```

### 模式 2：Ref 注入模式

传入 ref/getter 保持依赖；接收方以 `MaybeRefOrGetter` 声明并在 watcher 内调用 `toValue`。完整代码见[接受 Ref 以保持响应性](feature-extraction.md#2-接受-ref-以保持响应性)。普通值只能提供快照，不能在调用后自动跟随原来源。

### 模式 3：组合式函数编排模式

创建更高层级的组合式函数来组合多个功能。以下显式注入请求入口，统一参数构建；`load` 负责错误、竞态和清理，完整列表实现见 [SFC 重构示例](../examples/sfc-refactor.md)。

```typescript
import { ref } from 'vue'

interface SearchParams { query: string; page: number; size: number }

function useSearchWithPagination(load: (params: SearchParams) => Promise<void>) {
  const searchQuery = ref('')
  const currentPage = ref(1)
  const pageSize = ref(20)

  const searchWithParams = () => {
    return load({
      query: searchQuery.value,
      page: currentPage.value,
      size: pageSize.value
    })
  }

  function changePage(page: number) {
    currentPage.value = page
    return searchWithParams()
  }

  function search() {
    currentPage.value = 1
    return searchWithParams()
  }

  return {
    searchQuery,
    currentPage, pageSize,
    searchWithParams, search, changePage
  }
}
```

### 模式 4：事件总线模式（复杂通知的备选方案）

事件总线适合复杂的一对多通知，且这些通知不适合作为 Pinia 状态、Provide/Inject 上下文或路由状态表达时使用。它应是备选方案，不要替代简单的 Props/Emits 或显式回调。

使用 `mitt` 并自动清理，实现解耦通信。`useEmitt` 是项目封装命名；通用项目也可以直接封装 `mitt`，或使用 VueUse 的 `useEventBus`：

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

  // 当前 scope 销毁时自动解绑；组件内等价于卸载时清理
  onScopeDispose(() => {
    listeners.forEach(({ event, handler }) => {
      mittBus.off(event, handler)
    })
    listeners.length = 0
  })

  return { on, emit }
}
```

**用法 — 发送方：**

```typescript
// Layout.vue - 发送事件
const { emit } = useEmitt()
emit('open-contextmenu', { event: e })
```

**用法 — 接收方（自动清理）：**

```typescript
// MiContextMenu.vue - 监听事件
const { on } = useEmitt()

on('open-contextmenu', (data) => {
  // 在事件位置处理上下文菜单
})
// 无需手动 off，组件卸载时自动清理
// 多次调用 on() 注册多个监听器，全部会在卸载时清理
```

> **keep-alive 场景**：被缓存的组件停用（`deactivated`）不会触发 `onScopeDispose`/`onUnmounted`。如果监听只应在页面可见时生效（滚动、快捷键、轮询），需要额外在 `onDeactivated` 暂停、`onActivated` 恢复；如果业务要求停用期间也接收数据更新，可以保留监听。不要统一要求“停用即解绑”。

> 另见：[组合式函数设计模式 - 模式 3：生命周期感知](composable-design-patterns.md#模式-3生命周期感知) 了解 `useEmitt` 作为 Lifecycle-Aware 模式的完整设计原理。

**何时使用事件总线 vs 回调：**

| 场景 | 模式 | 原因 |
|----------|---------|--------|
| 直接父子关系 | Props / Emits | 简单、显式、类型安全 |
| 同一组件内的兄弟功能 | 回调 | 依赖流清晰 |
| 跨层级局部共享 | Provide / Inject | 作用域清晰，不需要全局通道 |
| 全局共享状态 | Pinia | 单一数据源，可调试 |
| 路由驱动状态 | Router query / params | 可分享、可刷新恢复 |
| 一个瞬时事件多个监听器 | 事件总线 | 一对多通知，不适合持久化为状态 |
| 功能需要响应 store 变化 | Store 桥接 | 单一数据源 |

### 模式 5：Store 桥接用于共享状态

多个功能读写同一 store 不构成必须增加桥接的理由。业务不变量可放在 store action；页面专属派生、跨 store 协作才按需用 composable。下面展示有额外职责的桥接，沿用项目 `WithOut` 约定；陌生项目用 `useAppStore()`（setup 同步调用）或显式 pinia 工厂。

```typescript
// ✅ Good — Store 桥接提供统一接口
// composables/business/useSideCategory.ts
export const useSideCategory = () => {
  const appStore = useAppStoreWithOut()

  const selectCategory = computed(() => appStore.selectCategory)
  const sidebarCategories = computed(() => appStore.sidebarCategories)

  const removeCategory = (val: string) => {
    // 复杂的业务逻辑集中在这里
    const idx = sidebarCategories.value.findIndex((s) => s.key === val)
    if (idx !== -1) {
      const newCategories = [...sidebarCategories.value]
      newCategories.splice(idx, 1)
      appStore.deletePageIconInfo(val) // 同时清理相关数据
      // 处理选中状态...
      appStore.setSidebarCategories(newCategories)
    }
  }

  return { selectCategory, sidebarCategories, removeCategory }
}

// ❌ Bad — 组件中分散的直接 store 访问
// ComponentA.vue
const appStore = useAppStore()
const idx = appStore.sidebarCategories.findIndex(...)
appStore.deletePageIconInfo(val)
appStore.setSidebarCategories(...)

// ComponentB.vue - 重复的逻辑！
const appStore = useAppStore()
const idx = appStore.sidebarCategories.findIndex(...)
appStore.deletePageIconInfo(val)
appStore.setSidebarCategories(...)
```

## 依赖方向规则

### ✅ Good — 单向依赖

```
┌─────────────┐
│   父组件     │
│  Component  │
└──────┬──────┘
       │ 传递依赖
       ▼
┌─────────────┐     ┌─────────────┐
│  功能 A     │────▶│  功能 B     │
│  (搜索)     │     │  (分页)     │
└─────────────┘     └─────────────┘
```

### ✅ Good — 跨树通信使用事件总线

```
┌──────────┐     emit      ┌──────────────┐
│  Layout  │───────────────▶│ ContextMenu  │
└──────────┘                └──────────────┘

┌──────────┐     emit      ┌──────────────┐
│  Search  │───────────────▶│  Suggestion  │
└──────────┘                └──────────────┘
```

### ❌ 避免 — 循环依赖

```
┌─────────────┐     ┌─────────────┐
│  功能 A     │◀───▶│  功能 B     │
│             │     │             │
└─────────────┘     └─────────────┘
    循环依赖！
```

## 常见场景

### 搜索 + 筛选 + 分页

以下假设 useDataFetch 是手动 refetch 模式，不自行监听传入参数。若项目封装已自动监听，筛选事件只更新状态，不再显式 refetch；搜索与翻页也应按同一契约绑定。

```vue
<script setup lang="ts">
// 清晰的依赖链
const { searchQuery } = useSearchInput()
const { activeFilter } = useFilter()
const { currentPage, pageSize } = usePagination()

// 数据获取整合所有参数
const { data, loading, refetch } = useDataFetch({
  query: searchQuery,
  filter: activeFilter,
  page: currentPage,
  size: pageSize
})

// 筛选变化时重置页码
watch(activeFilter, () => {
  currentPage.value = 1
  refetch()
})
</script>
```

### 通过事件总线跨组件通信

```vue
<!-- Layout.vue - 触发 -->
<script setup lang="ts">
const { emit } = useEmitt()

const openContextmenu = (e: PointerEvent) => {
  emit('open-contextmenu', { event: e })
}
</script>

<!-- MiContextMenu.vue - 监听 -->
<script setup lang="ts">
const { on } = useEmitt()

on('open-contextmenu', ({ event }) => {
  // 在事件位置显示上下文菜单
})
</script>
```

### 表单 + 验证 + 提交

```vue
<script setup lang="ts">
const { fields, updateField } = useFormFields({
  name: '',
  email: ''
})

const { errors, validate } = useFormValidation(fields, {
  name: { required: true },
  email: { required: true, email: true }
})

const { submit, isSubmitting } = useFormSubmit({
  onSubmit: async () => {
    if (!validate()) return
    await submitForm(fields)
  }
})
</script>
```

### 模式 6：页面级编排（混合策略）

**影响级别：MEDIUM** — 当页面组件功能区块很多（典型是中大型页面），全部走参数注入会让声明区冗长，但全部靠闭包又会回到隐式依赖的混乱。需要一个“核心链显式 + 叶子函数宽松”的混合策略。

> 下文提到的“3 个以上函数调用”“8 个以上 useXxx”是**提醒信号**，不是架构规则。真正要判断的是：状态归属、变化原因、依赖方向、测试边界，以及拆分后是否降低理解成本。

**问题所在：两种极端**

**极端一：全部闭包 — 隐式依赖不可见**

```vue
<script setup lang="ts">
// ❌ 10+ 个 useXxx 全部通过闭包互相引用

// usePagination 里调了 handleSearch——handleSearch 是哪来的？
function usePagination() {
  const onPageChange = () => {
    handleSearch() // 闭包引用——来自 useSearchForm，但完全不可见
  }
  return { onPageChange }
}

// useSearchForm 里引了 pageInfo、getTableList——在哪定义的？
function useSearchForm() {
  const queryParams = computed(() => ({
    pageNo: pageInfo.pageNo,  // 闭包引用
    pageSize: pageInfo.pageSize,
  }))
  const handleSearch = () => {
    getTableList(queryParams.value) // 闭包引用
  }
  return { handleSearch }
}

// ... 还有 8 个类似的函数，依赖关系需要逐行往上翻才能搞清
</script>
```

**极端二：全部参数注入 — 声明区过于冗长**

```vue
<script setup lang="ts">
// ❌ 每个函数都传 3~4 个依赖参数，声明区变成样板代码的海洋
const { dataSource, getTableList } = useTableList()
const { pageInfo, resetPageIndex } = usePagination()
const { handleSearch } = useSearchForm({ getTableList, pageInfo, resetPageIndex })
const { openRegisModal } = useRegisModal({ handleSearch })
const { openOperationModal } = useOperationModal({ handleSearch })
const { openPreviewModal } = usePreviewModal({ handleSearch })
const { openOpsPreviewModal } = useOpsPreviewModal({ handleSearch })
const { openApprovalModal } = useApprovalModal({ handleSearch })
const { openOpsApprovalModal } = useOpsApprovalModal({ handleSearch })
const { openApprovalInfoModal } = useApprovalInfoModal()
const { openOpsApprovalInfoModal } = useOpsApprovalInfoModal()
// handleSearch 重复传了 6 次——为了规范而规范，收益递减
</script>
```

**GOOD — 混合策略：核心链显式注入 + 叶子闭包**

下例展示页面结构和弹窗引用类型；page-services 是项目依赖，需满足代码注释中的契约。列表请求实现参考[完整列表示例](../examples/sfc-refactor.md)，不在本节重复实现。

```vue
<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useTableList, submitApi } from './page-services'

// 项目边界：useTableList 提供 { dataSource, loading, error, getTableList }；
// getTableList(params) 接收完整查询，内部处理最新请求、错误状态和销毁清理。
interface Row { id: string }
interface Query { pageNo: number; pageSize: number; keyword: string }
interface ModalHandle { openModal: (row: Row) => void }

const { dataSource, loading, error, getTableList } = useTableList()
const pageInfo = reactive({ pageNo: 1, pageSize: 10 })
const { searchForm, handleSearch } = useSearchForm({
  getPageInfo: () => ({ ...pageInfo }),
  resetPage: () => { pageInfo.pageNo = 1 },
  load: getTableList,
})
const { modalRef, openModal, submit, submitError } = useRegistration()

function onPageChange(page: number) {
  pageInfo.pageNo = page
  return handleSearch()
}
void handleSearch() // 唯一初始请求入口；load 将错误存入 error

function useSearchForm(deps: {
  getPageInfo: () => { pageNo: number; pageSize: number }
  resetPage: () => void
  load: (query: Query) => Promise<void>
}) {
  const searchForm = ref({ keyword: '' })
  function handleSearch(resetPage = false) {
    if (resetPage) deps.resetPage()
    return deps.load({ ...deps.getPageInfo(), keyword: searchForm.value.keyword })
  }
  return { searchForm, handleSearch }
}

// 叶子功能通过局部闭包复用刷新入口，初始化时不执行该闭包
function useRegistration() {
  const modalRef = ref<ModalHandle | null>(null)
  const submitError = ref<unknown>(null)
  const openModal = (row: Row) => modalRef.value?.openModal(row)
  async function submit(row: Row) {
    submitError.value = null
    try {
      await submitApi(row)
      await handleSearch()
    } catch (cause) {
      submitError.value = cause
    }
  }
  return { modalRef, openModal, submit, submitError }
}
</script>
```

**核心决策：哪些走显式注入，哪些可容忍闭包？**

| 依赖关系特征 | 策略 | 原因 |
|-------------|------|------|
| 被 3 个以上函数调用（如 `handleSearch`、`getTableList`）| ✅ 显式注入 | 构成核心数据流，断了整个页面崩溃 |
| 多个函数同时依赖同一个状态对象（如 `pageInfo`）| ✅ 显式注入 | 闭包引用链复杂时难以排查问题 |
| 改变了页面全局状态（列表刷新、分页跳转）| ✅ 显式注入 | 高影响力操作，必须可追踪 |
| 一对一关系：按钮 → 打开弹窗 | ⚠️ 可容忍闭包 | 不会出现循环依赖 |
| 同一种模式重复 N 次（Modal 提交 → 刷新列表）| ⚠️ 可容忍闭包 | 语义统一，全传参数反而冗长 |

> 表中的数量是经验信号，不是硬性规则。一个只被调用一次、但改变了页面核心状态的操作，仍应显式注入；一个被多次调用、但完全局部于单一 feature 的 helper，也可以保留在 feature 内部。

**识别核心链的方法：**

1. 画出函数调用图：谁调用了谁
2. 被 3 个以上函数调用的 → 标记为核心
3. 核心函数所依赖的状态（如 `pageInfo`）→ 也标记为核心
4. 其余一对一的调用关系 → 可以走闭包

**验证清单：**

- [ ] 核心链上的函数可通过参数独立测试
- [ ] 叶子函数的闭包依赖局部、可追踪，不按变量数量机械拆分
- [ ] 没有循环依赖（A 闭包引用 B，B 也闭包引用 A）
- [ ] 核心链的依赖方向清晰（单向，从上到下）

## 参考资料

- [Vue.js Composables](https://vuejs.org/guide/reusability/composables.html)
- [Vue.js Reactivity in Depth](https://vuejs.org/guide/extras/reactivity-in-depth.html)
- [mitt - Tiny Event Emitter](https://github.com/developit/mitt)
