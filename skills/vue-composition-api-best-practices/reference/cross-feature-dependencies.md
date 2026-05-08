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

- [ ] 通过函数参数显式传递依赖
- [ ] 避免通过外层作用域闭包产生隐式依赖
- [ ] 使用回调函数进行跨功能通信
- [ ] 对于多对多通信，使用事件总线并自动清理
- [ ] 考虑依赖方向（单向，避免循环）
- [ ] 优先使用 Store 桥接组合式函数访问共享状态

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

**GOOD - 通过参数显式传递依赖：**

```vue
<script setup lang="ts">
import { ref, watch } from 'vue'

// 功能声明

const {
  searchQuery,
  searchResults,
  handleSearch
} = useSearch()

const {
  currentPage,
  changePage
} = usePagination({
  onPageChange: handleSearch
})

const {
  activeFilter,
  setFilter
} = useFilter({
  onFilterChange: () => {
    changePage(1)
    handleSearch()
  }
})

// ============ 功能实现 ============

function useSearch() {
  const searchQuery = ref('')
  const searchResults = ref<SearchResult[]>([])

  const handleSearch = async () => {
    searchResults.value = await fetchResults(searchQuery.value)
  }

  return { searchQuery, searchResults, handleSearch }
}

function usePagination(options: { onPageChange: () => void }) {
  const currentPage = ref(1)

  const changePage = (page: number) => {
    currentPage.value = page
    options.onPageChange()
  }

  return { currentPage, changePage }
}

function useFilter(options: { onFilterChange: () => void }) {
  const activeFilter = ref('all')

  const setFilter = (filter: string) => {
    activeFilter.value = filter
    options.onFilterChange()
  }

  return { activeFilter, setFilter }
}
</script>
```

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

传递响应式 ref 实现共享状态：

```typescript
function useSearch(query: Ref<string>) {
  const results = ref([])

  watch(query, async (q) => {
    results.value = await fetchResults(q)
  })

  return { results }
}

function useSearchInput() {
  const query = ref('')
  const debouncedQuery = refDebounced(query, 300)

  return { query, debouncedQuery }
}

// 用法 — 显式依赖
const { query, debouncedQuery } = useSearchInput()
const { results } = useSearch(debouncedQuery)
```

### 模式 3：组合式函数编排模式

创建更高层级的组合式函数来组合多个功能：

```typescript
function useSearchWithPagination() {
  const { searchQuery, searchResults, handleSearch } = useSearch()
  const { currentPage, pageSize, changePage } = usePagination({
    onPageChange: handleSearch
  })

  const searchWithParams = () => {
    return handleSearch({
      query: searchQuery.value,
      page: currentPage.value,
      size: pageSize.value
    })
  }

  return {
    searchQuery, searchResults,
    currentPage, pageSize,
    searchWithParams, changePage
  }
}
```

### 模式 4：事件总线模式（适用于复杂的多对多场景）

使用 `mitt` 并自动清理，实现解耦通信：

```typescript
// hooks/web/useEmitt.ts
import { onUnmounted } from 'vue'
import { mittBus } from '@/utils/mitt'

export function useEmitt() {
  const listeners: Array<{ event: string; handler: (...args: any[]) => void }> = []

  function on(event: string, handler: (...args: any[]) => void) {
    mittBus.on(event, handler)
    listeners.push({ event, handler })
  }

  function emit(event: string, ...args: any[]) {
    mittBus.emit(event, ...args)
  }

  // 组件卸载时自动解绑所有通过此 hook 注册的事件
  onUnmounted(() => {
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

> 另见：[组合式函数设计模式 - 模式 3：生命周期感知](composable-design-patterns.md#模式-3生命周期感知) 了解 `useEmitt` 作为 Lifecycle-Aware 模式的完整设计原理。

**何时使用事件总线 vs 回调：**

| 场景 | 模式 | 原因 |
|----------|---------|--------|
| 直接父子关系 | 回调/Props | 简单、显式、类型安全 |
| 同一组件内的兄弟功能 | 回调 | 依赖流清晰 |
| 不同层级树的跨组件通信 | 事件总线 | 需要解耦 |
| 一个事件多个监听器 | 事件总线 | 一对多关系 |
| 功能需要响应 store 变化 | Store 桥接 | 单一数据源 |

### 模式 5：Store 桥接用于共享状态

当多个功能需要相同的 store 数据时，使用 Store 桥接组合式函数，而不是直接访问 store：

```typescript
// ✅ Good — Store 桥接提供统一接口
// hooks/web/useSideCategory.ts
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

**影响级别：MEDIUM** — 当页面组件有 8 个以上 `useXxx` 函数时，全部走参数注入会让声明区冗长，但全部靠闭包又会回到隐式依赖的混乱。需要一个"核心链显式 + 叶子函数宽松"的混合策略。

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

```vue
<script setup lang="ts">
// ============ 功能声明 ============

// Step 1：底层能力先声明
const { dataSource, loading, columns, getTableList } = useTableList()

// Step 2：核心链上的函数——依赖通过参数显式传入
const { pageInfo, resetPageIndex, updatePageTotal } = usePagination()

const { searchForm, handleSearch, resetForm } = useSearchForm({
  getPageInfo: () => ({ pageNo: pageInfo.pageNo, pageSize: pageInfo.pageSize }),
  getTableList,
  resetPageIndex,
})

// Step 3：分页事件绑定核心函数
const { onPageChange } = usePaginationEvent({
  onPageChange: () => handleSearch(),
})

// Step 4：叶子函数——对 handleSearch 的调用可容忍闭包
// 原因：它们都是一对一的关系（按钮点击 → 刷新列表），语义统一，不会混乱
const { regisApplyModalRef, openRegisModal, submitData } = useRegisModal()
const { regisPreviewModalRef, openPreviewModal, submitRegisApply } = usePreviewModal()
const { operationApplyModalRef, openOperationModal, submitOperation } = useOperationModal()
const { opsPreviewModalRef, openOpsPreviewModal, submitOpsApply } = useOpsPreviewModal()
const { approvalModalRef, openApprovalModal, submitApproval } = useApprovalModal()
const { opsApprovalModalRef, openOpsApprovalModal, submitOpsApproval } = useOpsApprovalModal()
const { approvalInfoModalRef, openApprovalInfoModal } = useApprovalInfoModal()
const { opsApprovalInfoModalRef, openOpsApprovalInfoModal } = useOpsApprovalInfoModal()

// ============ 功能实现 ============

function useTableList() {
  const loading = ref(false)
  const dataSource = ref([])

  const getTableList = (params) => {
    loading.value = true
    fetchData(params)
      .then((res) => { dataSource.value = res.data.list || [] })
      .finally(() => { loading.value = false })
  }

  return { dataSource, loading, getTableList }
}

function usePagination() {
  const pageInfo = reactive({ pageNo: 1, pageSize: 10, total: 0 })
  const resetPageIndex = () => { pageInfo.pageNo = 1 }
  const updatePageTotal = (total) => { pageInfo.total = total }
  return { pageInfo, resetPageIndex, updatePageTotal }
}

// ✅ 核心链：依赖通过参数显式传入
function useSearchForm(deps: {
  getPageInfo: () => { pageNo: number; pageSize: number }
  getTableList: (params: any) => void
  resetPageIndex: () => void
}) {
  const searchForm = ref({ keyword: '', timeRange: [] })

  const queryParams = computed(() => ({
    ...deps.getPageInfo(),
    keyword: searchForm.value.keyword,
  }))

  const handleSearch = (resetPage = false) => {
    if (resetPage) deps.resetPageIndex()
    deps.getTableList(queryParams.value)
  }

  const resetForm = () => {
    searchForm.value = { keyword: '', timeRange: [] }
    handleSearch(true)
  }

  handleSearch()
  return { searchForm, handleSearch, resetForm }
}

function usePaginationEvent(deps: { onPageChange: () => void }) {
  const onPageChange = () => deps.onPageChange()
  return { onPageChange }
}

// ✅ 叶子函数：handleSearch 通过闭包引用——可以接受
// 6 个 Modal 函数都是"提交成功 → 刷新列表"的同一模式，
// 为它们各传一个 deps.onSearch 参数反而增加了样板代码
function useRegisModal() {
  const regisApplyModalRef = ref(null)
  const openRegisModal = (row) => regisApplyModalRef.value.openModal(row)
  const submitData = (row) => {
    submitApi(row).then(() => {
      handleSearch() // 闭包引用——可容忍
    })
  }
  return { regisApplyModalRef, openRegisModal, submitData }
}

function useApprovalModal() {
  const approvalModalRef = ref(null)
  const openApprovalModal = (row) => approvalModalRef.value.openModal(row)
  const submitApproval = (data) => {
    approveApi(data).then(() => {
      handleSearch() // 闭包引用——可容忍
    })
  }
  return { approvalModalRef, openApprovalModal, submitApproval }
}
// ... 其余 Modal 函数结构相同，省略
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

**识别核心链的方法：**

1. 画出函数调用图：谁调用了谁
2. 被 3 个以上函数调用的 → 标记为核心
3. 核心函数所依赖的状态（如 `pageInfo`）→ 也标记为核心
4. 其余一对一的调用关系 → 可以走闭包

**验证清单：**

- [ ] 核心链上的函数可通过参数独立测试
- [ ] 叶子函数的闭包依赖不超过 2 个外部变量
- [ ] 没有循环依赖（A 闭包引用 B，B 也闭包引用 A）
- [ ] 核心链的依赖方向清晰（单向，从上到下）

## 参考资料

- [Vue.js Composables](https://vuejs.org/guide/reusability/composables.html)
- [Vue.js Reactivity in Depth](https://vuejs.org/guide/extras/reactivity-in-depth.html)
- [mitt - Tiny Event Emitter](https://github.com/developit/mitt)
