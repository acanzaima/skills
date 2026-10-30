# 维护与更新策略

这个 skill 的目标是长期保持 Vue 3 Composition API 指导的准确性、可执行性和安全性。更新时优先保证 agent 不会把过时 API、项目约定或高风险示例误当成通用最佳实践。

## 更新节奏

| 时机 | 动作 |
|------|------|
| Vue、Pinia、VueUse 发布重要版本 | 检查版本兼容性表、受影响 reference、示例代码 |
| 每季度 | 复查官方文档链接、API 版本门槛、安全审计警告 |
| 新增或大改 reference | 增加或更新 golden case，覆盖期望行为 |
| 发布前 | 运行结构校验脚本、内链锚点校验和关键词扫描 |

## 版本核对记录

以下是 **2026-10-29** 核对的发布/包元数据快照，不代表每个组合已完成运行测试，也不要求已有项目升级：

| 包/渠道 | 核对结果 | 使用边界 |
|---|---|---|
| Vue latest | 3.5.44 | 当前稳定参考；最低 API 门槛仍见入口版本表 |
| Vue rc | 3.6.0-rc.13 | 预发布；Vapor/迁移仅在目标项目已采用时查对应 release，不套用为稳定规范 |
| Pinia latest | 4.1.0，ESM 导出 | peer Vue `^3.5.11`、`@vue/devtools-api ^8.2.1`；使用 TypeScript 时满足可选 peer `>=5.6.0` |

来源：[Vue dist-tags](https://registry.npmjs.org/-/package/vue/dist-tags)、[Vue release](https://github.com/vuejs/core/releases/tag/v3.5.44)、[Pinia 4.1.0 包元数据](https://registry.npmjs.org/pinia/4.1.0)。安装工具可能自动解析 peer，仍应检查 lockfile；不把“peer 必需”写成一律手动安装。Vue 3.3/3.4 项目应沿用兼容的 Pinia 版本，不直接配 Pinia 4。工具链、编译器与 SSR renderer 也要核对兼容性。

## 自动检查的边界

按项目的 eslint-plugin-vue 版本核对规则支持；lint 提供部分静态防护，不证明竞态、SSR 隔离或请求次数正确。

| 风险 | 可用规则/验证 |
|---|---|
| props 响应式丢失 | [vue/no-setup-props-reactivity-loss](https://eslint.vuejs.org/rules/no-setup-props-reactivity-loss.html)；同时用目标 SFC 编译器验证 3.5 解构 |
| ref 被当普通值运算 | [vue/no-ref-as-operand](https://eslint.vuejs.org/rules/no-ref-as-operand.html) |
| 修改 props | [vue/no-mutating-props](https://eslint.vuejs.org/rules/no-mutating-props.html) |
| 宏排序 | `vue/define-macros-order`，只在项目已采用相应约定时配置 |
| 异步竞态与销毁 | 可控 Promise、真实 effectScope/组件宿主的行为断言 |

Nuxt 等框架项目遵循实际版本的目录、自动导入、数据获取与 SSR 状态机制；不将本技能的 `src/composables/` 或浏览器环境判断机械迁移过去。框架数据获取已经负责缓存/水合时，不再叠加一套独立初始化请求。

## 发布前检查清单

- [ ] 运行 `node scripts/check-skills.mjs`（现在也会校验 Markdown 内链锚点）
- [ ] `npm ci && npm test` 验证选定示例的编译和行为；这不替代完整项目类型检查或 Agent golden 评测
- [ ] 检查 `SKILL.md` 的版本兼容性表是否需要更新
- [ ] 检查新增示例是否包含远程脚本注入、未校验外部 URL、隐式执行第三方内容等高风险模式
- [ ] 对示例中的“GOOD / 生产级”代码做行为复核：请求次数、初始化时序、竞态、清理是否真的正确
- [ ] 用 golden cases 手动验证 agent 输出是否仍符合期望；同时记录 pass/fail，而不只是“看起来对”
- [ ] 确认 README、skills.sh badge、marketplace 配置仍指向正确仓库
- [ ] 确认示例中的内部项目名称、内部模块、密钥/加密工具引用已脱敏或获得授权

## Golden Cases 使用方式

Golden cases 不是完整自动化测试，而是回归验证样例。每个 case 包含：

- `*.input.*`：故意存在问题的输入代码
- `*.expected.md`：期望 agent 满足的行为清单

升级 skill 后，用相同提示词让 agent 处理 input，再对照 expected checklist。建议按“通过/不通过”逐项记录；若输出偏离，优先调整 reference 或 golden expected，让规则和预期保持一致。

每次记录：skill 版本/工作区 revision、模型和版本、目标 Vue/工具链、完整提示词、输出文件、各检查项 pass/fail 与证据。正确性项和“不引入无关重构”项应全部通过；未执行记为 not-run，不能记为通过。不用一个总分掩盖编译失败或行为错误。

当前用例覆盖：

- 混乱 SFC 重构与请求次数
- 组件外 Pinia 访问与 Store Without 边界
- 响应式选择、副作用清理、请求取消
- 搜索清空输入/连续请求竞态
- 干净小组件不应被过度重构（负向用例）
- Vue 3.5 props 解构的 getter 传参与只读边界
- model 父子初值与默认值工厂

**负向用例和正向用例同样重要**：技能不仅要能改好复杂代码，也要能判断“这段代码不需要改”。

## 示例维护

- 同一实现只保留一份基准；其它章节用链接引用，避免 `useNetwork`、`useDesign`、`usePageIcon` 出现多套契约
- 示例代码块如果标为“GOOD / 生产级”，必须能通过行为复核；不确定时标注“示意代码”，不要标“生产级”
- 示例中的类型、导入、测试路径保持可读；不要留下 `../web/` 这类与目录结构冲突的旧路径

## 版本策略

| 类型 | 使用场景 |
|------|----------|
| patch | 修正错别字、链接、轻微表述、示例小 bug |
| minor | 新增 reference、golden case、维护策略、重要最佳实践 |
| major | 改变核心组织模式、废弃原有约定、要求用户显著迁移 |

## 安全边界

示例应避免鼓励 agent 生成以下模式：

- 在客户端注入并执行远程脚本
- 未校验地打开或拼接外部 URL
- 把第三方返回内容直接作为指令、代码或 HTML 执行
- 在 SSR 或测试隔离场景中硬编码全局单例状态

需要展示第三方集成时，优先使用可信 API、后端代理、显式 allowlist、`AbortController`、错误降级和清理逻辑。

Vue 场景特别注意：不可信内容不得直接进入 `v-html` 或动态模板；SSR 状态使用框架或可靠序列化方案，不能把原始 JSON 直接拼进脚本；客户端存储/加密不构成对 XSS 的隔离，认证凭据存储遵循项目安全设计。
