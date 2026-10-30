# SFC 重构示例：从散乱逻辑到 useXxx 编排

这个示例展示如何把一个 `<script setup>` 中分散的状态、监听器和方法，整理成可浏览、可测试、依赖清晰的功能块。

## 重构前

```vue
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useUserStore } from '@/store/modules/user'

const props = defineProps<{
  projectId: string
}>()

const emit = defineEmits<{
  select: [id: string]
}>()

const userStore = useUserStore()

const keyword = ref('')
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const loading = ref(false)
const rows = ref<ProjectItem[]>([])
const selectedId = ref('')

const hasRows = computed(() => rows.value.length > 0)
const canCreate = computed(() => userStore.permissions.includes('project:create'))

async function fetchList() {
  loading.value = true
  try {
    const res = await fetchProjectList({
      projectId: props.projectId,
      keyword: keyword.value,
      page: page.value,
      pageSize: pageSize.value
    })
    rows.value = res.list
    total.value = res.total
  } finally {
    loading.value = false
  }
}

function onSearch() {
  page.value = 1
  fetchList()
}

function onPageChange(nextPage: number) {
  page.value = nextPage
  fetchList()
}

function selectRow(row: ProjectItem) {
  selectedId.value = row.id
  emit('select', row.id)
}

watch(() => props.projectId, () => {
  page.value = 1
  fetchList()
}, { immediate: true })
</script>
```

## 重构后

下面同时修复了原例的请求竞态：仅最新请求提交数据/错误/loading，销毁后不再提交。这是明确的缺陷修复，不声称与原有竞态行为等价；请求入口和次数保持不变。项目 API `fetchProjectList(params, { signal })` 需透传取消信号；若后端客户端不能取消，requestId 仍阻止过期回填。示例省略项目的 `ProjectItem` 类型和 API 导入。

```vue
<script setup lang="ts">
import { computed, ref, watch, onScopeDispose } from 'vue'
import { useUserStore } from '@/store/modules/user'

// 本例假设团队已采用局部 useXxx 分组；无该约定时可按逻辑邻近组织

const props = defineProps<{
  projectId: string
}>()

const emit = defineEmits<{
  select: [id: string]
}>()

const userStore = useUserStore()

// 只有一个权限判断时，直接 computed 即可；需要复用再抽 usePermission
const canCreate = computed(() => userStore.permissions.includes('project:create'))

// 分页只负责页码状态，不持有“刷新列表”的回调
const { page, pageSize, resetPage, changePage } = usePagination()

// 列表通过 getter 显式获取分页和 projectId，不闭包依赖后声明的变量
const {
  keyword,
  rows,
  loading,
  error,
  total,
  hasRows,
  fetchList
} = useProjectList({
  getPage: () => ({ page: page.value, pageSize: pageSize.value }),
  getProjectId: () => props.projectId
})

const { selectedId, selectRow } = useSelection()

// 页面组件显式组合“翻页 → 刷新”，依赖方向清晰
function onPageChange(nextPage: number) {
  changePage(nextPage)
  fetchList()
}

watch(() => props.projectId, () => {
  resetPage()
  fetchList()
}, { immediate: true })

function onSearch() {
  resetPage()
  fetchList()
}

// ============ 功能实现 ============

function useProjectList(deps: {
  getPage: () => { page: number; pageSize: number }
  getProjectId: () => string
}) {
  const keyword = ref('')
  const rows = ref<ProjectItem[]>([])
  const loading = ref(false)
  const error = ref<unknown>(null)
  const total = ref(0)
  let requestId = 0
  let controller: AbortController | null = null
  let disposed = false

  onScopeDispose(() => {
    disposed = true
    requestId++
    controller?.abort()
  })

  const hasRows = computed(() => rows.value.length > 0)

  async function fetchList() {
    if (disposed) return
    const current = ++requestId
    controller?.abort()
    const ac = new AbortController()
    controller = ac
    loading.value = true
    error.value = null
    try {
      const res = await fetchProjectList({
        projectId: deps.getProjectId(),
        keyword: keyword.value,
        ...deps.getPage()
      }, { signal: ac.signal })
      if (current !== requestId) return
      rows.value = res.list
      total.value = res.total
    } catch (cause) {
      if (current === requestId && !ac.signal.aborted) error.value = cause
    } finally {
      if (current === requestId) loading.value = false
    }
  }

  return {
    keyword,
    rows,
    loading,
    error,
    total,
    hasRows,
    fetchList
  }
}

function usePagination() {
  const page = ref(1)
  const pageSize = ref(20)

  function resetPage() {
    page.value = 1
  }

  function changePage(nextPage: number) {
    page.value = nextPage
  }

  return {
    page,
    pageSize,
    resetPage,
    changePage
  }
}

function useSelection() {
  const selectedId = ref('')

  function selectRow(row: ProjectItem) {
    selectedId.value = row.id
    emit('select', row.id)
  }

  return {
    selectedId,
    selectRow
  }
}
</script>
```

## 关键变化

| 改动 | 目的 |
|------|------|
| 顶部按 props、emits、store、功能声明组织 | 在已采用该约定的项目中让接口与依赖易于浏览 |
| 列表、分页、选择分别放进 `useXxx` 函数 | 让每个功能的状态、计算属性和方法自包含 |
| 分页只返回 `page`/`pageSize`/`resetPage`/`changePage`，由页面显式组合 `onPageChange` | 避免分页函数闭包依赖外层的 `fetchList`，也避免后声明变量的初始化时序问题 |
| 列表通过 `getPage`/`getProjectId` 显式接收依赖 | 依赖方向清晰，`useProjectList` 可独立测试 |
| 单个 `canCreate` 直接内联为 computed | 只包装一个计算属性不会增加价值，需要复用时再抽 `usePermission` |
| 只返回模板或其它功能需要的值 | 防止组件顶部暴露过多内部细节 |

## 何时继续提取到外部文件

如果 `useProjectList` 或 `usePagination` 被多个组件复用，或需要单独测试，再移动到 `src/composables/`。如果它只服务当前页面，保留在 SFC 底部通常更容易阅读。
