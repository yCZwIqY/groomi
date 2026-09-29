import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { app, protocol } from 'electron';

const CONTENT_TYPES: Record<string, string> = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

export function registerRendererProtocol() {
  protocol.handle('app', async (request) => {
    const rendererRoot = path.resolve(app.getAppPath(), 'build/client');
    const requestPath = decodeURIComponent(new URL(request.url).pathname).replace(/^[/\\]+/, '');
    const packagedAssetsRoot = path.resolve(app.getAppPath(), 'assets');
    const isPackagedAsset = requestPath.startsWith('assets/fonts/');
    const contentRoot = isPackagedAsset ? packagedAssetsRoot : rendererRoot;
    const contentPath = isPackagedAsset ? requestPath.slice('assets/'.length) : requestPath;
    const requestedFile = path.resolve(contentRoot, contentPath || 'index.html');
    const isWithinContentRoot =
      requestedFile === contentRoot || requestedFile.startsWith(`${contentRoot}${path.sep}`);

    try {
      const content = await readFile(isWithinContentRoot ? requestedFile : '');
      return new Response(content, {
        headers: {
          'content-type': CONTENT_TYPES[path.extname(requestedFile)] ?? 'application/octet-stream',
          'content-security-policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self' http://127.0.0.1:* http://localhost:*; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
        },
      });
    } catch {
      const content = await readFile(path.join(rendererRoot, 'index.html'));
      return new Response(content, {
        headers: {
          'content-type': 'text/html',
          'content-security-policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self' http://127.0.0.1:* http://localhost:*; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
        },
      });
    }
  });
}
