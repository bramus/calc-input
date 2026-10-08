import fs from 'node:fs';
import fsp from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');
const assetsDir = path.join(srcDir, 'assets');
const outputPath = path.join(assetsDir, 'og-image.jpg');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

function startStaticServer(dir) {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      try {
        const reqUrl = new URL(req.url, 'http://127.0.0.1');
        let pathname = decodeURIComponent(reqUrl.pathname);
        if (pathname === '/') pathname = '/index.html';

        const resolvedRoot = path.resolve(dir);
        const filePath = path.resolve(resolvedRoot, '.' + pathname);
        if (!filePath.startsWith(resolvedRoot + path.sep) && filePath !== resolvedRoot) {
          res.writeHead(403);
          res.end('Forbidden');
          return;
        }

        const data = await fsp.readFile(filePath);
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, {
          'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

async function generateScreenshot() {
  fs.mkdirSync(assetsDir, { recursive: true });

  const { server, url } = await startStaticServer(srcDir);
  const browser = await puppeteer.launch({
    protocol: 'webDriverBiDi',
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({
      width: 1200,
      height: 630,
      deviceScaleFactor: 1,
    });

    await page.goto(url, { waitUntil: 'networkidle0' });

    // Customize visibility and layout so the real demo page fits cleanly in a 1200x630 OpenGraph card
    await page.evaluate(() => {
      const style = document.createElement('style');
      style.textContent = `
        /* Hide navigation and sections that don't need to be in the OG preview */
        .sidebar,
        .header-actions,
        main.main-content > section:not(#playground),
        #playground > h2,
        #playground > .section-desc,
        #playground .playground-layout {
          display: none !important;
        }

        body {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .container {
          width: 100%;
          max-width: 1080px !important;
          padding: 2rem 2.5rem !important;
          margin: 0 auto !important;
        }

        header {
          margin-bottom: 1.75rem !important;
          padding-bottom: 1.5rem !important;
        }

        .description {
          max-width: 100% !important;
        }

        .page-layout {
          grid-template-columns: 1fr !important;
          gap: 0 !important;
        }

        #playground,
        #playground .card {
          margin-bottom: 0 !important;
        }
      `;
      document.head.appendChild(style);
    });

    await page.screenshot({
      path: outputPath,
      type: 'jpeg',
      quality: 95,
    });

    console.log(`Generated OpenGraph screenshot at ${outputPath}`);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

generateScreenshot();
