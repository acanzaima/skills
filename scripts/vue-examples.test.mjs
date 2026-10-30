import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'
import * as vue from 'vue'
import { parse, compileScript } from '@vue/compiler-sfc'

const root = new URL('../skills/vue-composition-api-best-practices/', import.meta.url)
const read = file => readFileSync(new URL(file, root), 'utf8')
const vueBindings = Object.fromEntries(
  ['ref', 'computed', 'watch', 'watchEffect', 'shallowRef', 'onScopeDispose', 'toValue'].map(name => [name, vue[name]]),
)

// Test the actual documentation code; project APIs are injected at the boundary.
// Transpilation is not a substitute for full project vue-tsc checking.
function block(file, heading) {
  const text = read(file)
  const start = text.indexOf(heading)
  assert.ok(start >= 0, `Missing heading: ${heading}`)
  const match = text.slice(start).match(/```(?:typescript|ts|vue)\r?\n([\s\S]*?)```/)
  assert.ok(match, `Missing code block: ${heading}`)
  return match[1].replace(/<\/?script[^>]*>/g, '')
}

function evaluate(source, bindings, result) {
  const js = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText
  return new Function('exports', 'require', ...Object.keys(bindings), `${js}\nreturn ${result}`)(
    {}, name => {
      assert.equal(name, 'vue', `Unexpected uninjected import: ${name}`)
      return vue
    }, ...Object.values(bindings),
  )
}

function exampleFunction(file, heading, name, bindings = {}) {
  const source = block(file, heading)
  const ast = ts.createSourceFile('example.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const declaration = ast.statements.find(node =>
    (ts.isFunctionDeclaration(node) && node.name?.text === name) ||
    (ts.isVariableStatement(node) && node.declarationList.declarations.some(d => d.name.getText(ast) === name)),
  )
  assert.ok(declaration, `Missing function: ${name}`)
  return evaluate(declaration.getText(ast), { ...vueBindings, ...bindings }, name)
}

function deferred() {
  let resolve, reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

// A real Vue component instance without a browser DOM, for props/model lifecycle tests.
const renderer = vue.createRenderer({
  insert() {}, remove() {}, patchProp() {}, setText() {}, setElementText() {},
  createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
  parentNode: () => null, nextSibling: () => null,
})

function component(script, exposed, bindings = {}) {
  const source = `<script setup lang="ts">${script}\ndefineExpose(${exposed})</script>`
  const compiled = compileScript(parse(source).descriptor, { id: 'fixture', genDefaultAs: 'Component' })
  const result = evaluate(`${compiled.content}\nexport default Component`, bindings, 'exports.default')
  result.render = () => null
  return result
}

test('getter search clears pending results, ignores stale errors and stops on disposal', async t => {
  const requests = []
  const useSearch = exampleFunction('reference/feature-extraction.md', '### 2. 接受 Ref', 'useSearch', {
    searchAPI: (query, options) => {
      const task = { ...deferred(), query, signal: options.signal }
      requests.push(task)
      return task.promise // deliberately ignores abort
    },
  })
  const scope = vue.effectScope()
  t.after(() => scope.stop())
  const query = vue.ref('a')
  const state = scope.run(() => useSearch(() => query.value))
  query.value = ''
  await vue.nextTick()
  assert.equal(requests[0].signal.aborted, true)
  requests[0].resolve(['stale'])
  await vue.nextTick()
  assert.deepEqual(state.results.value, [])
  query.value = 'b'
  await vue.nextTick()
  query.value = 'c'
  await vue.nextTick()
  requests[2].resolve(['current'])
  await vue.nextTick()
  requests[1].reject(new Error('stale error'))
  await vue.nextTick()
  assert.deepEqual(state.results.value, ['current'])
  assert.equal(state.error.value, null)
  query.value = 'd'
  await vue.nextTick()
  scope.stop()
  assert.equal(requests[3].signal.aborted, true)
  requests[3].resolve(['disposed'])
  await vue.nextTick()
  assert.deepEqual(state.results.value, ['current'])
})

test('parallel storage stays loading until success and failure both settle', async () => {
  const first = deferred(), second = deferred()
  const useStorage = exampleFunction('reference/composable-design-patterns.md', '### 模式 4：异步资源', 'useLocalForage', {
    localforage: { createInstance: () => ({ getItem: () => first.promise, setItem: () => second.promise }) },
  })
  const storage = useStorage('test')
  const get = storage.getItem('a'), set = storage.setItem('b', 2)
  const rejected = assert.rejects(set, /write failed/)
  assert.equal(storage.loading.value, true)
  first.resolve(1)
  assert.equal(await get, 1)
  assert.equal(storage.loading.value, true)
  second.reject(new Error('write failed'))
  await rejected
  assert.equal(storage.loading.value, false)
})

test('dynamic component example ignores an import that completes after selection changes', async t => {
  const loading = deferred()
  const condition = vue.ref(true), LightComponent = { name: 'light' }
  const scope = vue.effectScope()
  t.after(() => scope.stop())
  const source = block('reference/reactivity-performance.md', '### 动态 import + shallowRef')
    .replace("import('./HeavyComponent.vue')", 'loadComponent()')
  const state = scope.run(() => evaluate(source, {
    ...vueBindings, condition, LightComponent, loadComponent: () => loading.promise,
  }, '({ activeCom, loadError })'))
  condition.value = false
  await vue.nextTick()
  assert.equal(state.activeCom.value, LightComponent)
  loading.resolve({ default: { name: 'heavy' } })
  await vue.nextTick()
  assert.equal(state.activeCom.value, LightComponent)
  assert.equal(state.loadError.value, null)
})

test('list request identity owns data, errors and loading across overlap and disposal', async t => {
  const requests = []
  const useList = exampleFunction('examples/sfc-refactor.md', '## 重构后', 'useProjectList', {
    fetchProjectList: (params, { signal }) => {
      const task = { ...deferred(), params, signal }
      requests.push(task)
      return task.promise
    },
  })
  const scope = vue.effectScope()
  t.after(() => scope.stop())
  const state = scope.run(() => useList({ getPage: () => ({ page: 2, pageSize: 20 }), getProjectId: () => 'p' }))
  const a = state.fetchList(), b = state.fetchList()
  assert.equal(requests[0].signal.aborted, true)
  requests[0].resolve({ list: ['old'], total: 1 })
  await a
  assert.equal(state.loading.value, true)
  assert.deepEqual(state.rows.value, [])
  requests[1].resolve({ list: ['new'], total: 2 })
  await b
  assert.equal(state.loading.value, false)
  assert.deepEqual(state.rows.value, ['new'])
  assert.deepEqual(requests[1].params, { projectId: 'p', keyword: '', page: 2, pageSize: 20 })
  const c = state.fetchList()
  requests[2].reject(new Error('current error'))
  await c
  assert.equal(state.error.value.message, 'current error')
  const d = state.fetchList()
  scope.stop()
  assert.equal(requests[3].signal.aborted, true)
  requests[3].resolve({ list: ['disposed'], total: 3 })
  await d
  await state.fetchList()
  assert.equal(requests.length, 4)
  assert.deepEqual(state.rows.value, ['new'])
})

test('page icons preserve input, handle missing pages and reject duplicate keys', () => {
  const store = {
    selectCategory: { key: 'p' }, pageIconMap: {},
    addPageIconInfo(page) { this.pageIconMap[page] = [] },
    updatePageIconInfo(page, icons) { this.pageIconMap[page] = icons },
  }
  const useIcons = exampleFunction('reference/use-function-pattern.md', '### 4. Store 桥接模式', 'usePageIcon', {
    useAppStore: () => store,
  })
  let id = 0
  const icons = useIcons(() => `id-${id++}`)
  const input = Object.freeze({ type: 'link', label: 'test' })
  icons.addPageIcon(input)
  icons.addPageIcon(input)
  icons.addPageIcon(input)
  icons.removePageIcon({ key: 'id-1' })
  icons.addPageIcon(input)
  assert.deepEqual(store.pageIconMap.p.map(x => x.key), ['id-0', 'id-2', 'id-3'])
  assert.equal(input.key, undefined)
  assert.doesNotThrow(() => icons.updatePageIcon({ key: 'x' }, 'missing'))
  assert.throws(() => icons.addPageIcon({ key: 'id-2' }), /Duplicate/)
  const previous = store.pageIconMap.p
  icons.updatePageIcon({ key: 'id-2', label: 'updated' }, 'p')
  assert.equal(previous[1].label, 'test')
  assert.equal(store.pageIconMap.p[1].label, 'updated')
})

test('search orchestration builds identical parameters for searches and page changes', async () => {
  const calls = []
  const useSearch = exampleFunction('reference/cross-feature-dependencies.md', '### 模式 3：组合式函数编排模式', 'useSearchWithPagination')
  const state = useSearch(async params => { calls.push(params) })
  state.searchQuery.value = 'vue'
  await state.changePage(3)
  await state.search()
  assert.deepEqual(calls, [{ query: 'vue', page: 3, size: 20 }, { query: 'vue', page: 1, size: 20 }])
})

test('Vue compiler rejects watching or assigning a destructured prop; getter works', () => {
  const compile = script => compileScript(parse(`<script setup lang="ts">${script}</script>`).descriptor, { id: 'test' })
  assert.throws(() => compile('const { count } = defineProps<{count:number}>(); watch(count, () => {})'), /getter/)
  assert.throws(() => compile('let { count } = defineProps<{count:number}>(); count = 1'), /readonly/)
  assert.doesNotThrow(() => compile('const { count } = defineProps<{count:number}>(); watch(() => count, () => {})'))
})

test('toValue calls getters while unref preserves function-valued input', () => {
  let calls = 0
  const callback = () => ++calls
  assert.equal(vue.unref(callback), callback)
  assert.equal(calls, 0)
  assert.equal(vue.toValue(callback), 1)
})

test('documented withDefaults factories give component instances independent arrays', t => {
  const script = block('reference/script-setup-best-practices.md', '**GOOD — 基于类型的声明')
  const Child = component(script, '{ labels: props.labels }')
  const first = renderer.createApp(Child, { title: 'first' })
  const second = renderer.createApp(Child, { title: 'second' })
  t.after(() => { first.unmount(); second.unmount() })
  const a = first.mount({}), b = second.mount({})
  a.labels.push('extra')
  assert.deepEqual(b.labels, ['one'])
})

test('required named model matches initialized parent and propagates changes both ways', async t => {
  const script = block('reference/script-setup-best-practices.md', '## defineModel 实现双向绑定')
  const ast = ts.createSourceFile('model.ts', script, ts.ScriptTarget.Latest, true)
  const countDeclaration = ast.statements.find(node => ts.isVariableStatement(node) &&
    node.declarationList.declarations.some(d => d.name.getText(ast) === 'count'))
  assert.ok(countDeclaration)
  const Child = component(countDeclaration.getText(ast), '{ count }')
  const count = vue.ref(1), child = vue.ref()
  const app = renderer.createApp({
    setup: () => () => vue.h(Child, { count: count.value, 'onUpdate:count': value => { count.value = value }, ref: child }),
  })
  t.after(() => app.unmount())
  app.mount({})
  assert.equal(child.value.count, 1)
  count.value = 2
  await vue.nextTick()
  assert.equal(child.value.count, 2)
  child.value.count = 3
  await vue.nextTick()
  assert.equal(count.value, 3)
})

test('full refactored SFC requests once per mount, search, page and project change', async t => {
  const requests = []
  const script = block('examples/sfc-refactor.md', '## 重构后')
    .replace("import { useUserStore } from '@/store/modules/user'", '')
  const Child = component(script, '{ onSearch, onPageChange }', {
    useUserStore: () => ({ permissions: [] }),
    fetchProjectList: async params => {
      requests.push(params)
      return { list: [], total: 0 }
    },
  })
  const projectId = vue.ref('first'), child = vue.ref()
  const app = renderer.createApp({ setup: () => () => vue.h(Child, { projectId: projectId.value, ref: child }) })
  t.after(() => app.unmount())
  app.mount({})
  await vue.nextTick()
  assert.equal(requests.length, 1)
  child.value.onPageChange(4)
  await vue.nextTick()
  assert.equal(requests.length, 2)
  assert.equal(requests[1].page, 4)
  child.value.onSearch()
  await vue.nextTick()
  assert.equal(requests.length, 3)
  assert.equal(requests[2].page, 1)
  projectId.value = 'second'
  await vue.nextTick()
  assert.equal(requests.length, 4)
  assert.equal(requests[3].projectId, 'second')
})
