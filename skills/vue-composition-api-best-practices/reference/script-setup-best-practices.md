---
title: script setup Best Practices
impact: HIGH
impactDescription: 滥用 script setup 特性会导致类型安全问题、运行时错误以及更难维护的代码
type: best-practice
tags: [vue3, composition-api, script-setup, typescript, best-practices]
---

# script setup 最佳实践

**影响程度：高** — `<script setup>` 是编写 Vue 3 组件的推荐方式。理解其模式可确保类型安全和可维护性。

## 适用前提

- 适用于 Vue 3 SFC，尤其是采用 `<script setup lang="ts">` 的项目。
- `defineOptions`、`toValue()` 需要 Vue 3.3+；`defineModel` 需要 Vue 3.4+；`useTemplateRef()`、`useId()` 需要 Vue 3.5+。
- Store 访问模式假设项目使用 Pinia；组件外访问 store 的约定详见 [Store Without 模式](store-without-pattern.md)。

## 任务清单

- [ ] 使用 `<script setup lang="ts">` 以支持 TypeScript
- [ ] 需要稳定组件名时使用 `defineOptions`（Vue 3.3+）；`<script setup>` 自 3.2.34 起可按文件名推断，不必强制
- [ ] 为 props/emits 保留类型约束和已有运行时校验，不为风格切换声明方式
- [ ] 新增双向绑定可用 `defineModel`（Vue 3.4+）；检查父子初始值契约
- [ ] 使用 `useTemplateRef()` 获取类型安全的模板引用（Vue 3.5+，静态模板可自动推断类型）
- [ ] 使用 `useId()` 生成无障碍友好的唯一 ID（Vue 3.5+）
- [ ] 输入允许 getter 时用 `MaybeRefOrGetter` + `toValue()`；函数本身是值时用 `unref()`
- [ ] 使用 `InjectionKey` 为 `provide`/`inject` 添加类型
- [ ] Vue 3.5+ 直接解构 props 后，用 getter 传给 watcher/composable；旧版本保留 `props.xxx` 或 `toRef`
- [ ] 避免将 `<script setup>` 与 Options API 混用
- [ ] 在组件内和组件外使用正确的 Store 访问模式

## 问题所在

使用 `<script setup>` 时的常见错误可能导致类型问题、响应性丢失或令人困惑的代码模式。

## defineOptions — 需要稳定组件名时声明

`defineOptions` 用于覆盖或补充组件选项。它不是所有组件的必需品：自 Vue 3.2.34 起，使用 `<script setup>` 的 SFC 会**按文件名自动推断 `name`**，即使配合 `<KeepAlive>` 也无需手动声明。

```vue
<script setup lang="ts">
// ✅ 需要稳定名称时显式声明
defineOptions({
  name: 'MiSearch'
})
</script>
```

**什么时候值得显式声明：**
- 组件库/公共组件，文件名不等于对外名称
- 需要覆盖文件名推断出的名称（例如希望 `<KeepAlive :include>` 匹配自定义名称、DevTools 显示、错误堆栈可读性）
- 递归组件希望名称更明确（SFC 也可以按文件名自引用）
- 同目录存在同名文件或构建后文件名不可控

**不建议**把 `defineOptions` 当成“每个组件都必须写”的规则；对普通业务组件，它只会增加无意义 diff。

## TypeScript 集成

### 带类型的 Props

**运行时声明也能推导类型**；`string | undefined` 来自 prop 非必填，而不是“运行时声明不支持类型”：

```vue
<script setup lang="ts">
// ✅ 运行时声明：构造器提供基础类型，复杂类型可借助 PropType
const props = defineProps({
  title: { type: String, required: true }, // string
  count: { type: Number, default: 0 } // number
})
</script>
```

**GOOD — 基于类型的声明（复杂类型、联合类型、泛型更清晰）：**

```vue
<script setup lang="ts">
interface Props {
  title: string
  count?: number
  labels?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  count: 0,
  labels: () => ['one'] // 可变对象/数组用工厂，每个实例独立
})

// props.title 的类型是 string（必填、已定义）
// props.count 的类型是 number（可选、有默认值）
</script>
```

运行时声明也可以用 `PropType` 表达复杂对象和字面量联合：

```typescript
import type { PropType } from 'vue'

interface User { id: string; name: string }
type Size = 'small' | 'large'

const props = defineProps({
  user: { type: Object as PropType<User>, required: true },
  size: { type: String as PropType<Size>, default: 'small' }
})
```

> 类型声明式写法通常更简洁；运行时声明便于直接配置 `validator` 等选项。两者都能表达复杂类型，不要仅为风格改写已有声明，或丢掉运行时校验。`PropType` 提供静态类型，不会自动生成完整的运行时数据校验。

同一次 `defineProps` / `defineEmits` 调用不能同时传类型参数和运行时声明。类型到运行时的转换基于 AST，不支持把需要完整类型分析的条件类型用于整个 props 对象。`withDefaults` 只设置默认值，不会让之后的普通解构获得响应式；数组/对象默认值使用工厂。3.5 直接解构默认值（如 `const { labels = ['one'] } = defineProps<Props>()`）不需要工厂。

### 带类型的 Emits

**BAD — 无类型安全：**

```vue
<script setup lang="ts">
const emit = defineEmits(['update', 'delete'])
// 没有参数类型检查
emit('update', { any: 'thing' })
</script>
```

**GOOD — 类型安全的 emits：**

```vue
<script setup lang="ts">
interface Emits {
  update: [value: { id: string; name: string }]
  delete: [id: string]
}

const emit = defineEmits<Emits>()

// 类型检查！
emit('update', { id: '1', name: 'Test' }) // ✅
emit('update', { wrong: 'type' }) // ❌ Error
emit('delete', '123') // ✅
</script>
```

## defineModel 实现双向绑定

**Vue 3.4+ 特性：**

```vue
<script setup lang="ts">
import MyForm from './MyForm.vue'

// 简单 model
const model = defineModel<string>()

// 在事件处理中更新父组件（这里省略事件）
function updateModel() {
  model.value = 'new value'
}

// 父组件应初始化 count；required 收窄类型，但不会替父组件赋初值
const count = defineModel<number>('count', {
  required: true
})

// 命名 model
const title = defineModel<string>('title')
const description = defineModel<string>('description')
</script>

<template>
  <!-- 默认 v-model 可以绑原生 input -->
  <input v-model="model" />

  <!-- 命名 model 用于组件；原生 input 不支持 v-model:title / v-model:count -->
  <MyForm
    v-model:title="title"
    v-model:description="description"
    v-model:count="count"
  />
</template>
```

> `v-model:title` 是**组件**的命名 model 语法；原生 `<input>` 不支持带参数的 `v-model`，正常 SFC 构建会报告编译错误：`v-model argument is not supported on plain elements.`
>
> `defineModel` 的选项会传给底层 prop。`defineModel<string>()` 的值可能为 `undefined`，`{ required: true }` 将其类型收窄为 `string`，但不替代运行时业务校验。

**父子初值契约：** 子组件 `defineModel({ default: 1 })` 配合父组件 `const value = ref<number>()`、`<Child v-model="value" />`，会出现父值 `undefined`、子值 `1`，默认值不会自动回写父组件。优先在父组件初始化 `ref(1)`；确需子组件默认值时，明确允许未绑定/未初始化的行为，不要用挂载时无条件 emit 掩盖契约问题。

**Vue 3.4 之前（手动实现）：**

```vue
<script setup lang="ts">
const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const inputValue = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})
</script>
```

## 其他值得知道的 3.3+ 能力

### defineSlots（3.3+）

```vue
<script setup lang="ts">
interface Item {
  id: string
}

const slots = defineSlots<{
  default?: (props: { message: string }) => any
  item?: (props: { item: Item }) => any
}>()
</script>
```

`defineSlots` 只接受类型参数，不生成运行时插槽校验；它同时返回 slots 对象，与 `useSlots()` 的返回值相同，不必重复调用 `useSlots()`。

### 泛型组件（3.3+）

```vue
<script setup lang="ts" generic="T extends string | number">
const props = defineProps<{
  items: T[]
  selected: T
}>()

const emit = defineEmits<{
  select: [item: T]
}>()
</script>
```

泛型组件适合列表、选择器、表格列等“元素类型由调用方决定”的场景；注意泛型组件的模板引用类型需要 `ComponentExposed` 等工具类型，不能直接用 `InstanceType`。

### defineModel 修饰符（3.4+）

```vue
<script setup lang="ts">
const [model, modifiers] = defineModel<string>({
  set(value) {
    if (modifiers.capitalize) {
      return value.charAt(0).toUpperCase() + value.slice(1)
    }
    return value
  }
})
</script>

<template>
  <!-- 修饰符由父组件传入，子组件这里只绑普通 v-model -->
  <input v-model="model" />
</template>
```

父组件写 `<MyForm v-model.capitalize="text" />` 时，子组件通过 `modifiers.capitalize` 读取修饰符；不要在子组件里假设修饰符一定存在。

## Store 访问模式


### 在 Vue 组件内 — 使用 `useXxxStore()`

```vue
<script setup lang="ts">
// ✅ Good - 在组件内，使用标准的 store 访问方式
const appStore = useAppStore()
const businessStore = useBusinessStore()

// 在组件中直接访问
const isDark = computed(() => appStore.getIsDark)
</script>
```

### 在 Vue 组件外 — 显式传入 pinia 或沿用项目封装

```typescript
// ✅ Good - 项目已有 WithOut 封装时，在 utils、composables、plugins 中沿用
import { useAppStoreWithOut } from '@/store/modules/app'

export const useEngine = () => {
  const appStore = useAppStoreWithOut() // 传入全局 pinia 实例
  // ...
}
```

```typescript
// ✅ Good - 调用方能拿到 pinia 实例时，直接传入 pinia
import type { Pinia } from 'pinia'
import { useAppStore } from '@/store/modules/app'

export const createEngine = (pinia: Pinia) => {
  const appStore = useAppStore(pinia)
  // ...
}
```

```typescript
// ✅ Good - 在 utils/migration.ts 中沿用项目 WithOut 约定
import { useAppStoreWithOut } from '@/store/modules/app'

export async function migrateOnlineIcons() {
  const appStore = useAppStoreWithOut()
  // 可以在组件上下文之外访问 store
}
```

```typescript
// ✅ Good - 在 plugins/vue-i18n/index.ts 中
import { useLocaleStoreWithOut } from '@/store/modules/locale'

export async function setupI18n(app: App) {
  const localeStore = useLocaleStoreWithOut()
  // ...
}
```

**判断标准是调用时能否拿到正确的 pinia 实例，不是文件位置：**
- 在 `setup()` 内、或从 setup **同步**调用的 composable：仍有注入上下文，`useXxxStore()` 正常
- 单应用 SPA 在 `app.use(pinia)` 之后：`activePinia` 已设置，组件外通常也能工作，但这是隐式全局状态
- SSR、多应用、测试隔离：必须显式传入对应 `pinia`，否则可能串状态
- 只有在“没有注入上下文、也没有 active pinia”时才会抛 `getActivePinia was called with no active Pinia`
- `useXxxStoreWithOut()` 是项目约定封装，适合已有全局 pinia 且不需要请求级隔离的项目；陌生项目不要主动引入

详见 [store-without-pattern](store-without-pattern.md)。

## 常见模式

### 带默认值的响应式 Props

```vue
<script setup lang="ts">
interface Props {
  items: string[]
  pageSize?: number
}

const props = withDefaults(defineProps<Props>(), {
  pageSize: 10
})

// 使用 toRefs 获取响应式 props
const { pageSize } = toRefs(props)

// 或使用 computed 获取派生值
const totalPages = computed(() =>
  Math.ceil(props.items.length / pageSize.value)
)
</script>
```

### 暴露组件方法

```vue
<script setup lang="ts">
const inputRef = ref<HTMLInputElement | null>(null)

const focus = () => {
  inputRef.value?.focus()
}

const clear = () => {
  if (inputRef.value) inputRef.value.value = ''
}

// 暴露方法供父组件调用
defineExpose({
  focus,
  clear
})
</script>
```

### 模板引用

```vue
<script setup lang="ts">
// 元素引用
const inputRef = ref<HTMLInputElement | null>(null)

// 组件引用
const componentRef = ref<InstanceType<typeof MyComponent> | null>(null)

// v-for 中的引用数组
const itemRefs = ref<HTMLDivElement[]>([])

onMounted(() => {
  inputRef.value?.focus()
})
</script>

<template>
  <input ref="inputRef" />
  <MyComponent ref="componentRef" />
  <div v-for="item in items" :key="item.id" ref="itemRefs">
    {{ item.name }}
  </div>
</template>
```

### useTemplateRef（Vue 3.5+）

`useTemplateRef()` 返回一个浅层 ref，其值与模板中匹配的 `ref` attribute 同步。它的类型是：

```ts
function useTemplateRef<T>(key: string): Readonly<ShallowRef<T | null>>
```

在 Vue 3.5 + `@vue/language-tools` 2.1+ 的 SFC 中，**静态模板引用**的类型可以根据 `ref` 所在的元素/组件自动推断；动态组件、非 SFC 场景或推断失败时，再显式传泛型。`v-for` 上的 `ref` 类型推断目前仍不完整，数组场景建议显式标注。

```vue
<script setup lang="ts">
// 静态模板引用：3.5 + language-tools 2.1 可自动推断
const inputRef = useTemplateRef('inputRef')

// 动态组件/推断失败时显式标注
const componentRef = useTemplateRef<InstanceType<typeof MyComponent>>('componentRef')

onMounted(() => {
  inputRef.value?.focus() // value 仍是 T | null
})
</script>

<template>
  <input ref="inputRef" />
  <MyComponent ref="componentRef" />
</template>
```

**与 `ref<T | null>` 的关键区别：**

| 特性 | `ref<T \| null>` | `useTemplateRef<T>()` |
|---------|-------------------|-----------------------|
| 初始值 | 手动写 `null` | 由 API 创建，无需手写初始值 |
| 值的类型 | `T \| null` | `T \| null`（不是 `undefined`） |
| 名称匹配 | 靠约定 | 名称作为参数传入，但**字符串本身不做类型检查** |
| 类型来源 | 手动泛型 | 3.5 + language-tools 2.1 可对静态 ref 自动推断；否则手动泛型 |
| v-for | `ref<T[]>([])` | 可写 `useTemplateRef<T[]>('list')`，但类型推断可能仍需手动标注 |

> `useTemplateRef` 不会自动保证“不会拿到 null”：挂载前、`v-if` 卸载后都是 `null`，访问时仍需可选链或类型守卫。

### useId（Vue 3.5+）

**Vue 3.5 引入了 `useId()`**，用于生成唯一的、SSR 安全的 ID。对于无障碍访问（`aria-labelledby`、`for`/`id` 关联）和避免 ID 冲突至关重要：

```vue
<script setup lang="ts">
const inputId = useId()
const labelId = useId()
</script>

<template>
  <label :for="inputId" :id="labelId">Email</label>
  <input :id="inputId" :aria-labelledby="labelId" />
</template>
```

**为什么不使用 `Math.random()` 或计数器？**
- `useId()` 是 SSR 安全的 — 服务端和客户端生成匹配的 ID
- 同一个组件的多个实例、同一实例内的多次调用都会得到不同 ID
- 官方只保证“每个应用内唯一”，**不保证路由切换后重置**；不要把“会清除”当成行为契约
- 同一页面有多个 Vue 应用时，用 `app.config.idPrefix` 给每个应用加前缀，避免 ID 冲突
- 不要在 `computed()` 内部调用 `useId()`；在 computed 外部声明 ID，再在计算函数里引用

### Provide/Inject 与 TypeScript

`provide`/`inject` 是避免 props 逐层传递的强大工具，但类型安全需要明确的模式：

**步骤 1：定义 `InjectionKey`**

```typescript
// types/injection-keys.ts
import type { InjectionKey, Ref } from 'vue'

// 类型化的 injection key
export const THEME_KEY: InjectionKey<Ref<'light' | 'dark'>> = Symbol('theme')
export const CONFIG_KEY: InjectionKey<AppConfig> = Symbol('config')
```

**步骤 2：带类型安全地 provide**

```vue
<script setup lang="ts">
import { provide } from 'vue'
import { THEME_KEY, CONFIG_KEY } from '@/types/injection-keys'

const theme = ref<'light' | 'dark'>('light')
const appConfig = { apiUrl: 'https://api.example.com', timeout: 5000 }

provide(THEME_KEY, theme)  // ✅ 类型检查通过
provide(CONFIG_KEY, appConfig)  // ✅ 类型检查通过

// ❌ Error：类型错误
provide(THEME_KEY, 'blue')
</script>
```

**步骤 3：带类型安全地 inject**

```vue
<script setup lang="ts">
import { inject } from 'vue'
import { THEME_KEY, CONFIG_KEY } from '@/types/injection-keys'

// ✅ 使用 InjectionKey — 类型化，但 provider 缺失时仍可能是 undefined
const theme = inject(THEME_KEY) // Ref<'light' | 'dark'> | undefined

if (!theme) {
  throw new Error('THEME_KEY provider is missing')
}

// ✅ 带默认值 — 类型推导，不会是 undefined
const config = inject(CONFIG_KEY, { apiUrl: '/fallback', timeout: 3000 })

// ⚠️ 不使用 key 或默认值 — 返回 T | undefined
const maybeConfig = inject<AppConfig>('config') // AppConfig | undefined
</script>
```

| 模式 | 返回类型 | 使用场景 |
|---------|------------|-------------|
| `inject(key)` 配合 `InjectionKey` | `T \| undefined` | provider 必须由调用方校验或由封装函数保证 |
| `inject(key, default)` | `T`（是否含 null/undefined 取决于 T） | provider 可能不存在 |
| `inject<string>('key')` | `T \| undefined` | 旧的字符串 key 模式 |

优先使用 `InjectionKey<T>`，把提供端和消费端的类型关联起来。字符串 key 配合显式泛型仍能约束消费端类型，但不能校验双方是否约定了同一类型。

### toValue() vs unref()

**Vue 3.3 引入了 `toValue()`**，用于接受值、ref 或 getter 的输入契约；它不是 `unref()` 的无条件替代品：

```typescript
import { ref, toValue, unref } from 'vue'

// 两者都可以标准化 ref 和普通值
const a = ref(42)
const b = 100

toValue(a) // 42 — 解包 ref，透传普通值
toValue(b) // 100

unref(a)  // 42 — 行为相同
unref(b)  // 100

// 但 toValue() 有一个关键区别：
// toValue() 还可以解包 getter（返回值的函数）
const getter = () => 42
toValue(getter) // 42 ✅
unref(getter)   // () => 42（保留函数本身；函数属于数据时这正是需要的行为）
```

**经验法则：**
- 接受值/ref/getter：声明 `MaybeRefOrGetter<T>`，在 `watch(() => toValue(source), ...)` 或 effect 内读取，才能追踪 getter 的依赖。
- 接受 `MaybeRef<T>`，且函数本身是回调或数据：使用 `unref()`，避免意外执行函数。
- 不需要响应输入变化时可只读取一次，但应把“初始化快照”写入接口契约。

## 应避免的反模式

### ❌ 不要将 Options API 状态混入 `<script setup>`

```vue
<!-- BAD - 混合风格 -->
<script>
export default {
  data() {
    return {
      count: 0
    }
  }
}
</script>

<script setup lang="ts">
// 无法在这里访问 Options API 的 data！
const double = computed(() => this.count * 2) // Error!
</script>
```

> 官方允许普通 `<script>` 与 `<script setup>` 共存，用于 `inheritAttrs`、命名导出等少量场景；但不要把 Options API 的 `data`/`methods`/生命周期混进来，再在 setup 中依赖它们。

### ⚠️ 解构 Props 的版本边界

**任何版本都不建议先取 `props` 对象再解构**，因为这一步会丢失响应式：

```vue
<script setup lang="ts">
const props = defineProps<{ count: number }>()
const { count } = props // ❌ 得到普通 number
</script>
```

**Vue 3.4 及以下**：用 `toRefs(props)`，或直接访问 `props.xxx`：

```vue
<script setup lang="ts">
const props = defineProps<{ count: number }>()
const { count } = toRefs(props) // ✅ 保持响应式
const double = computed(() => props.count * 2)
</script>
```

**Vue 3.5+**：可以直接解构 `defineProps()`，并使用 JS 默认值：

```vue
<script setup lang="ts">
const { count = 0, label = 'total' } = defineProps<{
  count?: number
  label?: string
}>()
</script>
```

> 3.5 的响应式 props 解构依赖编译器转换，只对**直接解构 `defineProps()` 返回值**生效；`const props = defineProps(); const { count } = props` 仍然是普通解构，不会自动变响应式。

解构绑定不是 Ref。`watch(count, ...)` 会编译报错，传给普通函数的 `count` 只是当时的值。保持追踪需传 getter，接收方也必须支持 getter：

```ts
watch(() => count, (value) => console.log(value))
useCounter(() => count) // useCounter 接受 MaybeRefOrGetter<number>
```

不要给解构绑定赋值；它仍是只读 prop。需要编辑时用本地草稿或通过 emit/model 请求父组件更新。对象 prop 的嵌套字段不会因此自动成为深只读，也不应借此修改父组件数据。

### 顶层 await 与实例上下文

`<script setup>` 顶层 `await` 会生成 `async setup()`，按 Vue 核心的用法需要父级 `Suspense` 处理；`Suspense` 仍是实验性 API，框架项目遵循其异步组件约定。编译器会恢复顶层 await 后的组件上下文，但普通 async 函数、异步回调或手写 async setup 不能假定有同样恢复机制。需要组件实例的生命周期、inject 和清理应在有效上下文中同步注册。`defineExpose` 放在顶层 await 之前。

### ❌ 不要在 script setup 中使用 `this`

```vue
<script setup lang="ts">
// ❌ Error：'this' 是 undefined
console.log(this.$router)

// ✅ 改用组合式函数
import { useRouter } from 'vue-router'
const router = useRouter()
console.log(router)
</script>
```

### ❌ 不要忘记 ref 的 `.value`

```vue
<script setup lang="ts">
const count = ref(0)

// ❌ 不会触发响应性
count = 1

// ✅ 正确方式
count.value = 1

// 模板中不需要 .value
</script>

<template>
  <!-- 模板中自动解包 -->
  <div>{{ count }}</div>
</template>
```

### ⚠️ 组件外使用 `useXxxStore()` 的前提

判断标准不是“文件是不是 `.vue`”，而是**调用时能否拿到正确的 pinia 实例**：

```typescript
import type { Pinia } from 'pinia'

// ✅ 从 setup 同步调用的 composable：仍有注入上下文
export function useThemeBridge() {
  const appStore = useAppStore() // 正常
  // ...
}

// ✅ 组件外、调用方能提供 pinia：显式传入
export function createThemeBridge(pinia: Pinia) {
  const appStore = useAppStore(pinia)
  // ...
}

// ✅ 单应用 SPA，app.use(pinia) 之后：activePinia 存在，通常也能工作
// 但这是隐式全局状态，SSR/多应用/测试隔离场景不要依赖

// ❌ 没有注入上下文，也没有 active pinia（如 app.use 之前的工具脚本）
export function someUtil() {
  const store = useAppStore() // Error: no active Pinia
}
```

> `useXxxStoreWithOut()` 是项目约定封装，只在项目已有该约定时沿用；陌生项目应优先用显式 `pinia` 参数。

## 性能提示

### 对大型对象和动态组件使用 shallowRef

```vue
<script setup lang="ts">
// 动态组件切换 — 使用 shallowRef 避免深层响应性
const activeCom = shallowRef()
watchEffect(() => {
  activeCom.value = isPure.value ? PureMode : HomeMode
})

// 大型数据对象 — 替换整个值时使用 shallowRef
const largeData = shallowRef<BigObject>({})
largeData.value = { /* 新对象 */ } // 仅在引用变化时触发更新
</script>
```

### 对派生状态使用 computed

```vue
<script setup lang="ts">
const items = ref<string[]>([])

// ✅ 高效 - 缓存直到 items 变化
const sortedItems = computed(() =>
  [...items.value].sort()
)

// ❌ 低效 - 每次渲染都重新创建
const getSortedItems = () => [...items.value].sort()
</script>
```

## 参考资料

- [Vue.js script setup](https://vuejs.org/api/sfc-script-setup.html)
- [Vue.js TypeScript with Composition API](https://vuejs.org/guide/typescript/composition-api.html)
- [Vue.js defineModel](https://vuejs.org/api/sfc-script-setup.html#definemodel)
- [Vue.js defineOptions](https://vuejs.org/api/sfc-script-setup.html#defineoptions)
- [Vue.js useTemplateRef](https://vuejs.org/api/composition-api-helpers.html#usetemplateref)
- [Vue.js useId](https://vuejs.org/api/composition-api-helpers.html#useid)
- [Vue.js provide/inject](https://vuejs.org/guide/components/provide-inject.html#working-with-reactivity)
- [Vue.js toValue](https://vuejs.org/api/reactivity-utilities.html#tovalue)
