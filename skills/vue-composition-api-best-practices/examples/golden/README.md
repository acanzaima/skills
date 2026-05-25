# Golden 回归用例

这些用例用于验证 skill 是否能稳定引导 agent 输出符合预期的 Vue 3 Composition API 代码。它们不是完整标准答案，而是输入代码与行为清单。

## 用例列表

| 用例 | 覆盖重点 |
|------|----------|
| [messy-user-list](messy-user-list.expected.md) | 混乱 SFC 重构、useXxx 功能分组、声明顺序 |
| [store-access-composable](store-access-composable.expected.md) | 组件外 Pinia store 访问、显式 pinia、Store Without 边界 |
| [reactivity-cleanup](reactivity-cleanup.expected.md) | 响应式 API 选择、副作用清理、异步请求取消 |

## 使用方式

1. 选择一个 `*.input.*` 文件。
2. 使用对应 expected 文件中的 Task Prompt 让 agent 处理输入。
3. 对照 Expected Behavior Checklist 检查输出。
4. 如果输出偏离预期，更新 reference 或 expected checklist。
