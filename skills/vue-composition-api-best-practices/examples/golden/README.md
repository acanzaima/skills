# Golden 回归用例

这些用例用于验证 skill 是否能稳定引导 agent 输出符合预期的 Vue 3 Composition API 代码。它们不是完整标准答案，而是输入代码与行为清单。

## 用例列表

| 用例 | 覆盖重点 |
|------|----------|
| [messy-user-list](messy-user-list.expected.md) | 混乱 SFC 重构、useXxx 功能分组、声明顺序、请求次数 |
| [store-access-composable](store-access-composable.expected.md) | 组件外 Pinia store 访问、显式 pinia、Store Without 边界 |
| [reactivity-cleanup](reactivity-cleanup.expected.md) | 响应式 API 选择、副作用清理、异步请求取消 |
| [search-race](search-race.expected.md) | 搜索清空输入、连续请求竞态、loading 归属、销毁清理 |
| [simple-clean-component](simple-clean-component.expected.md) | **负向用例**：小组件不应被过度重构 |
| [props-getter](props-getter.expected.md) | Vue 3.5 解构 props 跨函数传参与旧版本变体 |
| [model-default](model-default.expected.md) | model 父子初值、数组默认值实例隔离 |

> 负向用例和正向用例同样重要：技能不仅要能改好复杂代码，也要能判断“这段代码不需要改”。

## 使用方式

1. 选择一个 `*.input.*` 文件。
2. 使用对应 expected 文件中的 Task Prompt 让 agent 处理输入。
3. 对照 Expected Behavior Checklist 检查输出；每项按 pass/fail 记录。
4. 如果输出偏离预期，先判断是 reference 缺规则、示例给了错误示范，还是 expected 本身过时，再更新。
