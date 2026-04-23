import { isTraeCliInstalled } from '../utils';
import { AuthBridge } from '../utils/auth-bridge';

export async function setup(args: string[]): Promise<void> {
  console.log('检查 trae-cli 状态...\n');

  const installed = await isTraeCliInstalled();

  if (!installed) {
    console.log('❌ trae-cli 未安装或未在 PATH 中找到。');
    console.log('');
    console.log('请按照以下步骤安装：');
    console.log('1. 访问 https://docs.trae.cn/cli 获取安装指南');
    console.log('2. 安装完成后运行 trae-cli 完成登录认证');
    console.log('3. 再次运行 setup 验证');
    return;
  }

  console.log('✅ trae-cli 已安装并可用！\n');

  const authBridge = new AuthBridge();
  const authStatus = await authBridge.checkAuthStatus();

  const lines: string[] = [
    '认证状态',
    `  已认证: ${authStatus.authenticated ? '✅' : '❌'}`,
    `  配置文件: ${authStatus.configPath} (${authStatus.configExists ? '存在' : '不存在'})`,
    `  模型: ${authStatus.model}`,
    `  登录地址: ${authStatus.loginUrl}`,
  ];

  if (!authStatus.authenticated) {
    lines.push('');
    lines.push('trae-cli 尚未完成认证。请运行 trae-cli 完成登录。');
  }

  const allowedTools = authBridge.getAllowedTools();
  if (allowedTools.length > 0) {
    lines.push('');
    lines.push(`  已允许的工具: ${allowedTools.join(', ')}`);
  }

  const plugins = authBridge.getPlugins();
  if (plugins.length > 0) {
    lines.push('');
    lines.push('  已安装的插件:');
    for (const p of plugins) {
      lines.push(`    - ${p.name} (${p.type}: ${p.source}) ${p.enabled ? '✅' : '❌'}`);
    }
  }

  lines.push('');
  lines.push('ACP/MCP 服务');
  lines.push('  ACP Server: trae-cli acp serve');
  lines.push('  MCP Server: trae-cli mcp serve');
  lines.push('');
  lines.push('使用 acp start 启动 ACP Server');
  lines.push('使用 sessions list 查看历史会话');

  console.log(lines.join('\n'));
}
