import { isTraeCliInstalled } from '../utils';
import { AuthBridge } from '../utils/auth-bridge';

export async function setup(args: string[]) {
    console.log('检查 trae-cli 状态...\n');

    const installed = await isTraeCliInstalled();

    if (!installed) {
        console.log('❌ trae-cli 未安装或未在 PATH 中找到。');
        console.log('\n请按照以下步骤安装：');
        console.log('1. 访问 https://docs.trae.cn/cli 获取安装指南');
        console.log('2. 安装完成后运行 trae-cli 完成登录认证');
        console.log('3. 再次运行 /trae:setup 验证');
        return;
    }

    console.log('✅ trae-cli 已安装并可用！\n');

    const authBridge = new AuthBridge();
    const authStatus = await authBridge.checkAuthStatus();

    console.log('## 认证状态\n');
    console.log(`  已认证: ${authStatus.authenticated ? '✅' : '❌'}`);
    console.log(`  配置文件: ${authStatus.configPath} (${authStatus.configExists ? '存在' : '不存在'})`);
    console.log(`  模型: ${authStatus.model}`);
    console.log(`  登录地址: ${authStatus.loginUrl}`);

    if (!authStatus.authenticated) {
        console.log('\n⚠️ trae-cli 尚未完成认证。请运行 trae-cli 完成登录。');
    }

    const allowedTools = authBridge.getAllowedTools();
    if (allowedTools.length > 0) {
        console.log(`\n  已允许的工具: ${allowedTools.join(', ')}`);
    }

    const plugins = authBridge.getPlugins();
    if (plugins.length > 0) {
        console.log(`\n  已安装的插件:`);
        for (const p of plugins) {
            console.log(`    - ${p.name} (${p.type}: ${p.source}) ${p.enabled ? '✅' : '❌'}`);
        }
    }

    console.log('\n## ACP/MCP 服务\n');
    console.log('  ACP Server: trae-cli acp serve');
    console.log('  MCP Server: trae-cli mcp serve');
    console.log('\n使用 /trae:acp start 启动 ACP Server');
    console.log('使用 /trae:sessions list 查看历史会话');
}
