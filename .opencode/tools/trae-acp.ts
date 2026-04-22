import { tool } from "@opencode-ai/plugin"
import path from "path"

const PLUGIN_DIR = path.dirname(path.dirname(import.meta.dir))
const DIST_INDEX = path.join(PLUGIN_DIR, "dist", "index.js")

export default tool({
  description:
    "通过 ACP (Agent Communication Protocol) 与 Trae Agent 交互。启动/停止 ACP Server，发现可用 Agent，执行任务或流式获取结果。ACP Server 通过 trae-cli acp serve 启动。",
  args: {
    action: tool.schema
      .enum(["start", "stop", "status", "agents", "run", "stream"])
      .describe("操作类型"),
    prompt: tool.schema.string().optional().describe("任务描述 (run/stream 需要)"),
    yolo: tool.schema.boolean().optional().describe("YOLO 模式 (start/run)"),
    allowed_tools: tool.schema
      .array(tool.schema.string())
      .optional()
      .describe("允许的工具 (start)"),
    disabled_tools: tool.schema
      .array(tool.schema.string())
      .optional()
      .describe("禁用的工具 (start)"),
  },
  async execute(args, context) {
    const { $ } = await import("bun")
    const cliArgs: string[] = ["node", DIST_INDEX, "acp", args.action]

    if (args.prompt && (args.action === "run" || args.action === "stream"))
      cliArgs.push(args.prompt)
    if (args.yolo) cliArgs.push("--yolo")
    if (args.allowed_tools)
      for (const t of args.allowed_tools) cliArgs.push("--allowed-tool", t)
    if (args.disabled_tools)
      for (const t of args.disabled_tools) cliArgs.push("--disabled-tool", t)

    const result = await $`${cliArgs}`.cwd(PLUGIN_DIR).quiet()
    return {
      text: result.stdout,
    }
  },
})
