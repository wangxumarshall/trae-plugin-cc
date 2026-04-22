import { tool } from "@opencode-ai/plugin"
import path from "path"

const PLUGIN_DIR = path.dirname(path.dirname(import.meta.dir))
const DIST_INDEX = path.join(PLUGIN_DIR, "dist", "index.js")

export default tool({
  description:
    "检查 trae-cli 安装和认证状态。第一次使用前强烈建议运行。验证 trae-cli 是否安装、认证状态、当前模型、已允许的工具和已安装的插件。",
  args: {},
  async execute(args, context) {
    const { $ } = await import("bun")
    const result = await $`node ${DIST_INDEX} setup`.cwd(PLUGIN_DIR)
    if (result.exitCode !== 0 && result.stderr) {
      process.stderr.write(result.stderr)
    }
    return { text: result.stdout }
  },
})
