import { tool } from "@opencode-ai/plugin"
import path from "path"

const PLUGIN_DIR = path.dirname(path.dirname(import.meta.dir))
const DIST_INDEX = path.join(PLUGIN_DIR, "dist", "index.js")

export default tool({
  description:
    "查看当前或历史的后台 Traе 任务的状态。后台任务通过 --background 参数启动，存储在 .claude-trae-plugin/ 目录。",
  args: {},
  async execute(args, context) {
    const { $ } = await import("bun")
    const result = await $`node ${DIST_INDEX} status`.cwd(PLUGIN_DIR)
    if (result.exitCode !== 0 && result.stderr) {
      process.stderr.write(result.stderr)
    }
    return { text: result.stdout }
  },
})
