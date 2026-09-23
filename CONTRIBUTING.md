# 参与贡献

感谢你帮助改进天网。提交改动前，请先创建 Issue 描述问题或目标，避免重复工作。

## 本地验证

项目使用 Node.js 22.12 或更高版本。安装依赖后运行：

```bash
npm ci
npm --prefix agents ci
npm run verify
```

客户端相关改动还应在 `agents/` 目录运行 `npm run lint` 和 `npm test -- --runInBand`。

## 提交 Pull Request

- 一个 Pull Request 聚焦一个问题。
- 说明用户可见的变化和验证方式。
- 不提交密码、令牌、`.env`、日志、构建产物或用户数据。
- 新行为应附带能够覆盖真实结果的测试。

提交即表示你同意按本项目的 MIT 许可证贡献代码。
