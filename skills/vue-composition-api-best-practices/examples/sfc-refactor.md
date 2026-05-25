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

```vue
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useUserStore } from '@/store/modules/user'

defineOptions({
  name: 'ProjectList'
})

const props = defineProps<{
  projectId: string
}>()

const emit = defineEmits<{
  select: [id: string]
}>()

const userStore = useUserStore()

const { canCreate } = usePermission()

const {
  keyword,
  rows,
  loading,
  total,
  hasRows,
  fetchList
} = useProjectList()

const {
  page,
  pageSize,
  resetPage,
  onPageChange
} = usePagination({
  onPageChange: fetchList
})

const { selectedId, selectRow } = useSelection()

watch(() => props.projectId, () => {
  resetPage()
  fetchList()
}, { immediate: true })

function onSearch() {
  resetPage()
  fetchList()
}

// ============ 功能实现 ============

function usePermission() {
  const canCreate = computed(() => userStore.permissions.includes('project:create'))

  return {
    canCreate
  }
}

function useProjectList() {
  const keyword = ref('')
  const rows = ref<ProjectItem[]>([])
  const loading = ref(false)
  const total = ref(0)

  const hasRows = computed(() => rows.value.length > 0)

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

  return {
    keyword,
    rows,
    loading,
    total,
    hasRows,
    fetchList
  }
}

function usePagination(options: { onPageChange: () => void }) {
  const page = ref(1)
  const pageSize = ref(20)

  function resetPage() {
    page.value = 1
  }

  function onPageChange(nextPage: number) {
    page.value = nextPage
    options.onPageChange()
  }

  return {
    page,
    pageSize,
    resetPage,
    onPageChange
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
| 顶部按 `defineOptions`、`defineProps`、`defineEmits`、store、功能声明排序 | 让组件接口和依赖一眼可见 |
| 搜索列表、分页、选择、权限分别放进 `useXxx` 函数 | 让每个功能的状态、计算属性和方法自包含 |
| 分页通过 `onPageChange` 回调依赖列表刷新 | 避免分页函数隐式读取外层的 `fetchList` |
| 只返回模板或其它功能需要的值 | 防止组件顶部暴露过多内部细节 |

## 何时继续提取到外部文件

如果 `useProjectList` 或 `usePagination` 被多个组件复用，或需要单独测试，再移动到 `src/composables/`。如果它只服务当前页面，保留在 SFC 底部通常更容易阅读。
