import { defineConfig, loadEnv } from 'vite';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { bridgeDeployPlugin } from './tools/bridge-deploy-plugin';
import { bridgeRpcPlugin } from './tools/bridge-rpc-plugin';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const hivexDevRpcUrl =
    env.HIVEX_DEV_RPC_URL || 'http://192.168.1.162:13134';

  return {
    plugins: [
      // The React and Tailwind plugins are both required for Make, even if
      // Tailwind is not being actively used – do not remove them
      react(),
      tailwindcss(),
      bridgeDeployPlugin(),
      bridgeRpcPlugin(),
    ],
    resolve: {
      alias: {
        // Alias @ to the src directory
        '@': path.resolve(__dirname, './src'),
        // Temporary read-only mode: keep SDK imports resolvable without loading
        // the local @openhive/sdk package or enabling on-chain writes.
      },
    },

    // Avoid treating standalone examples as application entry points during
    // dependency scanning.
    optimizeDeps: {
      entries: [path.resolve(__dirname, './index.html')],
    },

    // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
    assetsInclude: ['**/*.svg', '**/*.csv'],
    server: {
      fs: {
        deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/tools/bridge-lab/runtime/**'],
      },
      proxy: {
        '/api/v1': {
          target: env.HUBSQL_API_URL || 'http://127.0.0.1:8080',
          changeOrigin: true,
        },
        '/hubsql-api': {
          target: env.HUBSQL_API_URL || 'http://127.0.0.1:8080',
          changeOrigin: true,
          rewrite: (requestPath) => requestPath.replace(/^\/hubsql-api/, ''),
        },
        '/hivex-dev-rpc': {
          target: hivexDevRpcUrl,
          changeOrigin: true,
          rewrite: (requestPath) =>
            requestPath.replace(/^\/hivex-dev-rpc/, ''),
        },
      },
    },
  };
});
