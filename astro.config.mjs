// @ts-check
import { defineConfig } from 'astro/config';

const isGitHubPages = Reflect.get(globalThis, 'process')?.env?.DEPLOY_TARGET === 'github-pages';

// Keep local development on one predictable URL. `strictPort` prevents Vite
// from silently opening 4332, 4333, and so on when 4331 is already occupied.
export default defineConfig({
  site: isGitHubPages ? 'https://gracevillarino.github.io' : undefined,
  base: isGitHubPages ? '/go-moalboal' : '/',
  server: {
    host: 'localhost',
    port: 4331,
  },
  vite: {
    server: {
      strictPort: true,
    },
  },
});
