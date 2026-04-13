---
description: 进行对抗性代码审查，专门挑刺找问题
allowed-tools: Bash(git:*), Bash(trae-cli:*)
---

# /trae:adversarial-review

**Description:**
进行对抗性代码审查。Trae Agent 会专门挑刺、质疑假设、找出潜在的安全漏洞、性能瓶颈、逻辑错误等。

**Usage:**
```bash
/trae:adversarial-review [--base main] [--background] [--json]
```

**Options:**
- `--base <branch>`: 指定对比的基准分支，默认自动检测
- `--background`: 将审查任务放到后台运行
- `--yolo` / `-y`: YOLO 模式
- `--json`: 返回结构化 JSON 输出
- `--session-id <id>`: 指定会话 ID

**Internal Execution:**
```bash
npx --yes trae-plugin-cc adversarial-review [options]
```
