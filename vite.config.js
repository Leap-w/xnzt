import { defineConfig } from 'vite';

/**
 * Vite 配置 — 支持 GitHub Pages 部署
 *
 * base 路径规则：
 *   - 本地开发：自动使用 '/' （根路径）
 *   - 生产构建：默认为 GitHub Pages 仓库名
 *   - 可通过环境变量 VITE_BASE 覆盖，例如：
 *     VITE_BASE=/my-custom-path/ npm run build
 *
 * 常见场景：
 *   - 用户站点: https://<user>.github.io/<repo>/ → base = '/<repo>/'
 *   - 自定义域名: https://example.com/ → base = '/'
 */

// 仓库名（与 GitHub 仓库名一致；如需修改请同步更新）
const REPO_NAME = 'xnzt';

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';

  // 生产模式使用仓库名作为 base，开发模式使用 '/'
  const base = isProd
    ? (process.env.VITE_BASE || `/${REPO_NAME}/`)
    : '/';

  return {
    base,
    root: '.',
    publicDir: 'public',
    server: {
      host: '0.0.0.0',
      port: 3000,
      open: true,
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      // 生成 sourcemap 便于调试（部署后可关闭以减小体积）
      sourcemap: false,
    },
  };
});
