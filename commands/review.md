---
description: 对当前 Git 变更或指定 branch 进行标准的代码审查
allowed-tools: Bash(git:*), Bash(trae-cli:*)
---

# /trae:review

**Description:**
对当前 Git 变更或指定 branch 进行标准的代码审查。它会自动抓取 `git diff` 并交给 Trae Agent 审查。支持对抗性审查模式、结构化输出。

**Usage:**
```bash
/trae:review [options]
```

**Options:**
- `--base <branch>`: 指定对比的基准分支，默认自动检测
- `--background`: 将审查任务放到后台运行，适用于大型审查
- `--yolo` / `-y`: YOLO 模式
- `--json`: 返回结构化 JSON 输出
- `--session-id <id>`: 指定会话 ID

**Examples:**
```bash
/trae:review
/trae:review --base develop
/trae:review --background
/trae:review --json
/trae:review --yolo
```

**Internal Execution:**
```bash
npx --yes trae-plugin-cc review [options]
```
