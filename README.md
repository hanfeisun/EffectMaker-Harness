# EffectMaker Skill & CDP SDK

可复用的 YouTube Effect Maker 操作 skill、浏览器函数和 CDP 适配器。

- 网站：[YouTube Effect Maker](https://effects.youtube.com/home)
- 本次测试项目：[HeloWorld](https://effects.youtube.com/edit/Q0FJUXdPMWE)
- Skill：[SKILL.md](skills/effectmaker/SKILL.md)
- 使用示例与函数表：[API](skills/effectmaker/references/api.md)
- 实测范围、失败和未测项：[覆盖报告](skills/effectmaker/references/coverage.md)

## 验证结果

79 个可见视觉脚本节点均通过创建与撤销检查，并通过原生 CDP 复测。31 项高层 SDK 页面操作检查通过。独立浏览器的真实 CDP 连接、数值提交及边界校验测试通过。

这不是“全功能正确性认证”：每个节点的连线运行语义、所有参数组合、真实手机/摄像头、正式发布等没有全部验证。详细状态见覆盖报告。

## 安装 skill

将 `skills/effectmaker/` 复制到 `~/.codex/skills/effectmaker/`，在新会话中使用 `$effectmaker`，或直接提出 Effect Maker 编辑任务。已有同名 skill 时请先比较再更新。

## 使用 SDK

Codex 内置浏览器可以导入 `sdk.mjs` 的 `fromCodexTab(tab)`；原生 CDP 通道使用 `raw-cdp.mjs` 的 `fromCodexRawTab(tab)`。不需要复制登录信息。

独立 Node 脚本安装 Playwright 后，可调用 `cdp.mjs` 的 `connectCDP()`，连接已授权的本机调试端口。仓库设为 private，包也标记为 `private: true`，不会被误发到 npm。

```sh
npm install --no-save playwright
npm test
```

CDP 集成测试启动独立临时浏览器，不使用个人配置。没有 Playwright 自带 Chromium 时，通过 `CHROMIUM_EXECUTABLE` 指定本机 Chrome 路径。测试端口为 19223。
