---
description: 检查并引导初始化本地的 Trae Agent (trae-cli)
---

# /trae:setup

**Description:**
检查并引导初始化本地的 Trae Agent (`trae-cli`)。在第一次使用插件前强烈建议运行。

**Usage:**
```bash
/trae:setup
```

**Internal Execution:**
```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" setup
```
如果提示未安装，请按照指示进行全局安装。安装后需要重新运行此命令验证。
