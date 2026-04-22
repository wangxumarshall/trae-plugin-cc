import { tool } from "@opencode-ai/plugin"
import path from "path"

const PLUGIN_DIR = path.dirname(path.dirname(import.meta.dir))
const DIST_INDEX = path.join(PLUGIN_DIR, "dist", "index.js")

export default tool({
  description:
    "列出或查询 trae-cli 的历史会话。可查看会话详情、对话历史、工具调用记录、完整上下文摘要。数据来源于 trae-cli 会话目录。",
  args: {
    action: tool.schema
      .enum([
        "list",
        "detail",
        "conversation",
        "tools",
        "context",
        "recent",
        "find",
        "delete",
      ])
      .describe("操作类型"),
    session_id: tool.schema
      .string()
      .optional()
      .describe("会话 ID (detail/conversation/tools/context/delete 需要)"),
    cwd: tool.schema
      .string()
      .optional()
      .describe("按工作目录筛选 (list/recent)"),
    limit: tool.schema.number().optional().describe("返回数量限制").default(20),
    topic: tool.schema
      .string()
      .optional()
      .describe("搜索主题关键词 (find)"),
  },
  async execute(args, context) {
    const { $ } = await import("bun")
    const cliArgs: string[] = ["node", DIST_INDEX, "sessions", args.action]

    if (args.session_id) cliArgs.push(args.session_id)
    if (args.cwd) cliArgs.push("--cwd", args.cwd)
    if (args.limit) cliArgs.push("--limit", String(args.limit))
    if (args.topic && args.action === "find") cliArgs.push(args.topic)

    const result = await $`${cliArgs}`.cwd(PLUGIN_DIR).quiet()
    return {
      text: result.stdout,
    }
  },
})
