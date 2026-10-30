---
title: SFC Code Organization Order
impact: HIGH
impactDescription: 代码组织混乱会导致维护困难、难以理解组件结构，以及团队成员之间代码风格不一致
type: best-practice
tags: [vue3, composition-api, script-setup, code-organization, maintainability]
---

# SFC 代码组织顺序

**影响等级：高** - 良好组织的 SFC（单文件组件）对可维护性和团队协作至关重要。遵循一致的顺序使代码可预测且易于导航。

## 任务清单

**B 层项目约定**：以下顺序仅在项目采用该约定或用户要求结构重构时适用。无约定时按逻辑邻近组织同样正确；优先保证初始化依赖，再考虑排列。

- [ ] 遵循标准的 SFC 代码组织顺序
- [ ] 使用 useXxx 函数按功能分组相关代码
- [ ] 将 Vue 公共项（options、props、emits 等）放在顶部
- [ ] 将功能实现放在底部，IDE 中默认折叠
- [ ] 使用清晰的区块注释进行分隔

## 问题所在

`<script setup>` 带来了自由和灵活性，但如果没有约定，每个 SFC 文件可能看起来完全不同，使得维护和重构变得困难。

**BAD - 组织混乱的代码：**

```vue
<script setup lang="ts">
import { ref, computed, watch, onMounted, provide, inject } from 'vue'

// 分散的状态
const count = ref(0)
const user = ref(null)
const loading = ref(false)

// 函数随意穿插在中间
function fetchUser() {
  loading.value = true
  // ...
}

// 计算属性混在其中
const doubleCount = computed(() => count.value * 2)

// 又一个状态
const theme = ref('dark')

// props 定义在很后面
const props = defineProps<{
  id: string
}>()

// watch 散落在某处
watch(() => props.id, fetchUser)

// 生命周期钩子
onMounted(() => {
  fetchUser()
})

// 更多函数...
function increment() {
  count.value++
}

// emits 放在底部
const emit = defineEmits(['update'])

// provide 分散在各处
provide('theme', theme)
</script>
```

**GOOD - 组织良好的代码：**

```vue
<script setup lang="ts">
import { ref, computed, watch, provide, inject, onScopeDispose } from 'vue'
import { THEME_KEY, CONFIG_KEY } from '@/types/injection-keys'

// 组件名
defineOptions({
  name: 'UserComponent'
})

// props
const props = defineProps<{
  id: string
}>()

// model
const model = defineModel<string>()

// inject（使用 InjectionKey；字符串 key 会失去类型）
const config = inject(CONFIG_KEY, { apiUrl: '/api' })

// emits
const emit = defineEmits<{
  update: [value: string]
}>()

// store
const appStore = useAppStore()

// 外部 composables
const { user, loading, fetchUser } = useUser()
const { theme, toggleTheme } = useTheme()

// 功能声明
const { count, doubleCount, increment } = useCounter()

// provide
provide(THEME_KEY, theme)

// expose
defineExpose({
  increment,
  fetchUser
})

// ============ 功能实现 ============

// 用户管理功能
function useUser() {
  const user = ref<User | null>(null)
  const loading = ref(false)

  const error = ref<unknown>(null)
  let requestId = 0
  let disposed = false
  onScopeDispose(() => { disposed = true; requestId++ })

  const fetchUser = async () => {
    if (disposed) return
    const current = ++requestId
    loading.value = true
    error.value = null
    try {
      const result = await fetchUserData(props.id)
      if (current === requestId) user.value = result
    } catch (cause) {
      if (current === requestId) error.value = cause
    } finally {
      if (current === requestId) loading.value = false
    }
  }

  // 只保留一个初始加载路径，避免 watch immediate + onMounted 各拉一次
  watch(() => props.id, fetchUser, { immediate: true })

  return {
    user,
    loading,
    fetchUser,
    error
  }
}

// 主题功能
function useTheme() {
  const theme = ref<'light' | 'dark'>('dark')

  const toggleTheme = () => {
    theme.value = theme.value === 'light' ? 'dark' : 'light'
  }

  return {
    theme,
    toggleTheme
  }
}

// 计数器功能
function useCounter() {
  const count = ref(0)

  const doubleCount = computed(() => count.value * 2)

  const increment = () => {
    count.value++
    emit('update', count.value.toString())
  }

  return {
    count,
    doubleCount,
    increment
  }
}
</script>
```

## 标准组织顺序

| 顺序 | 区块 | 是否必须 | 描述 |
|-------|---------|----------|-------------|
| 1 | `defineOptions` | 可选 | 需要稳定组件名时（3.3+；3.2.34+ 可按文件名推断） |
| 2 | `defineProps` | 可选 | 带类型声明的组件 props |
| 3 | `defineModel` | 可选 | 双向绑定 model（Vue 3.4+） |
| 4 | `inject` | 可选 | 注入的依赖 |
| 5 | `defineEmits` | 可选 | 带类型声明的组件事件 |
| 6 | Store 声明 | 可选 | Pinia store 实例（`useXxxStore()`） |
| 7 | 外部 composables | 可选 | 导入的组合式函数 |
| 8 | 功能声明 | 可选 | `const { ... } = useFeature()` |
| 9 | `provide` | 可选 | 提供的依赖 |
| 10 | `defineExpose` | 可选 | 暴露的公共 API |
| 11 | 功能实现 | 按需 | `function useFeature() {}` |

## 区块注释风格

使用清晰、简洁的区块注释。两种常见风格：

### 风格一：简洁中文注释（推荐中文团队使用）

```typescript
// 组件名
defineOptions({ name: 'Layout' })

// props
const props = defineProps<{ id: string }>()

// emits
const emit = defineEmits<{ update: [value: string] }>()

// store
const appStore = useAppStore()

// 外部 composables
const { t } = useI18n()

// 功能声明
const { imageBgUrl, videoBgUrl } = useBackground()

// ============ 功能实现 ============

function useBackground() { /* ... */ }
```

### 风格二：分隔线风格（适用于大型组件）

```typescript
// ============ Vue 公共项 ============

defineOptions({ name: 'UserComponent' })

// ============ Store ============

const appStore = useAppStore()

// ============ 外部 Composables ============

const { t } = useI18n()

// ============ 功能声明 ============

const { search, results } = useSearch()

// ============ 功能实现 ============

function useSearch() { /* ... */ }
```

## 收益与代价

**收益：**

1. **结构可预测**：团队成员知道在哪里找到特定代码
2. **快速概览**：顶部区域让组件接口一目了然
3. **IDE 导航**：点击声明中的函数名即可跳转到实现
4. **默认折叠**：功能实现保持折叠状态，减少视觉干扰
5. **依赖清晰**：一眼看清每个功能返回和消费了什么
6. **Store 聚合**：所有 store 实例集中声明，便于识别

**代价：**

1. 额外的函数调用和返回值，简单功能可能变得更绕
2. 顶部声明与底部实现分离，阅读时需要跳转
3. 如果 feature 函数依赖闭包而不是参数，依赖关系仍然隐式
4. 对小组件来说，11 个区块的注释成本可能高于收益

## 适用场景与边界

- **中大型组件/复杂页面**：按此顺序组织，收益最大
- **小型组件（单一职责、区块很少）**：按逻辑邻近组织即可，不必为了凑满 11 步增加包装
- **团队项目**：可以用评审和规则保持一致性，但不要用“文件行数”或“函数数量”直接决定拆分
- **陌生项目**：先确认团队已有约定并优先沿用；新项目、尚无约定的模块，或用户明确要求时，可按职责和复杂度选用。局部修复不顺带重排结构

> 这条 11 步顺序是**项目约定**。重排运行时声明会影响立即执行的 watcher、初始化依赖和暂时性死区，不能机械排序。宏顺序可用 `vue/define-macros-order` 约束；业务区块分类仍需评审，其他语义 lint 见[维护策略](maintenance-strategy.md#自动检查的边界)。

**拆分的判断依据**（比数字可靠）：
- 是否形成独立职责（状态、派生、副作用能否自包含）
- 是否被多个组件复用，或需要独立测试
- 拆分后是否降低理解成本、减少跨块跳转
- 是否改变请求次数、初始化时序或清理时机

行数、`useXxx` 数量只能作为“触发检查”的信号，不能直接作为架构规则。

**按场景的默认做法：**

| 场景 | 更合适的默认做法 |
|------|------------------|
| 小型组件、单一功能 | 直接按逻辑邻近组织，不为排序或分组增加包装 |
| 中型业务页面 | 职责边界清楚时使用局部 `useXxx` |
| 大型业务页面 | 综合拆分子组件、领域 composable 和页面编排，而不只是增加函数数量 |
| 多组件复用或需要独立测试 | 提取到外部文件，明确输入、输出和副作用 |
| 简单 store 读写 | 直接使用 store，不默认增加桥接层 |
| 跨 store 协作、页面专属组合逻辑 | 再考虑 composable 编排或 Store 桥接 |

## 真实案例

```vue
<script setup lang="ts">
import { useAppStore } from '@/store/modules/app'

// 组件名
defineOptions({
  name: 'MiSearch'
})

// store
const appStore = useAppStore()
const businessStore = useBusinessStore()

// 多语言
const { t } = useI18n()

// 简单前缀
const { getPrefixCls } = useDesign()

// useEngine
const { engineInfo, nextEngine } = useEngine()

// useSearchInput
const {
  searchContent,
  handleChange,
  handleSearch,
  isComposing,
  searchHistoryRef,
  searchSuggestionRef,
  operaHistoryOrSuggestion,
  searchInputRef
} = useSearchInput()

// 输入框
function useSearchInput() {
  const searchContent = ref('')
  const isComposing = ref(false)

  const handleSearch = (val) => {
    if (isComposing.value) return
    const useContent = encodeURIComponent(val)
    if (!useContent) return
    businessStore.updateHistoryList(val)
    businessStore.submitSearch({
      engine: engineInfo.value.key,
      keyword: useContent,
      openType: appStore.openType
    })
  }

  // ... 更多逻辑

  return {
    searchContent,
    isComposing,
    handleSearch,
    handleChange,
    searchHistoryRef,
    searchSuggestionRef,
    operaHistoryOrSuggestion,
    searchInputRef
  }
}
</script>
```

> **大型组件提示**：当 `useXxx` 较多时，声明区的依赖传参会变得冗长。参考[跨功能依赖 - 模式 6](cross-feature-dependencies.md#模式-6页面级编排混合策略)的混合策略：核心数据链走显式参数注入，叶子函数可容忍闭包，避免声明区沦为样板代码的海洋。数量只是提醒信号，不是拆分依据。

## 参考

- [Vue.js Composition API FAQ](https://vuejs.org/guide/extras/composition-api-faq.html)
- [Vue.js script setup](https://vuejs.org/api/sfc-script-setup.html)
- [官方示例：FileExplorer.vue](https://github.com/vuejs-translations/docs-zh-cn/blob/main/assets/FileExplorer.vue)
