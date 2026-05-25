# 维护与更新策略

这个 skill 的目标是长期保持 Vue 3 Composition API 指导的准确性、可执行性和安全性。更新时优先保证 agent 不会把过时 API、项目约定或高风险示例误当成通用最佳实践。

## 更新节奏

| 时机 | 动作 |
|------|------|
| Vue、Pinia、VueUse 发布重要版本 | 检查版本兼容性表、受影响 reference、示例代码 |
| 每季度 | 复查官方文档链接、API 版本门槛、安全审计警告 |
| 新增或大改 reference | 增加或更新 golden case，覆盖期望行为 |
| 发布前 | 运行结构校验脚本和关键词扫描 |

## 发布前检查清单

- [ ] 运行 `node scripts/check-skills.mjs`
- [ ] 检查 `SKILL.md` 的版本兼容性表是否需要更新
- [ ] 检查新增示例是否包含远程脚本注入、未校验外部 URL、隐式执行第三方内容等高风险模式
- [ ] 用 golden cases 手动验证 agent 输出是否仍符合期望
- [ ] 确认 README、skills.sh badge、marketplace 配置仍指向正确仓库

## Golden Cases 使用方式

Golden cases 不是完整自动化测试，而是回归验证样例。每个 case 包含：

- `*.input.*`：故意存在问题的输入代码
- `*.expected.md`：期望 agent 满足的行为清单

升级 skill 后，用相同提示词让 agent 处理 input，再对照 expected checklist。若输出偏离，优先调整 reference 或 golden expected，让规则和预期保持一致。

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
