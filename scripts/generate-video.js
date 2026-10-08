import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');
const assetsDir = path.join(srcDir, 'assets');
const outputPath = path.join(assetsDir, 'demo.mp4');
const outputGifPath = path.join(assetsDir, 'demo.gif');

const VIEWPORT_WIDTH = 1200;
const VIEWPORT_HEIGHT = 630;
const FPS = 30;

let ffmpegBin = process.env.FFMPEG_BIN;
if (!ffmpegBin) {
  for (const candidate of ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg', 'ffmpeg']) {
    try {
      execFileSync(candidate, ['-version'], { stdio: 'ignore' });
      ffmpegBin = candidate;
      break;
    } catch {}
  }
}
if (!ffmpegBin) ffmpegBin = 'ffmpeg';

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

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

async function generateVideo() {
  fs.mkdirSync(assetsDir, { recursive: true });
  const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'calc-input-video-'));
  const framesDir = path.join(tmpDir, 'frames');
  await fsp.mkdir(framesDir, { recursive: true });

  const { server, url } = await startStaticServer(srcDir);
  const browser = await puppeteer.launch({
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({
      width: VIEWPORT_WIDTH,
      height: VIEWPORT_HEIGHT,
      deviceScaleFactor: 1,
    });

    await page.goto(url, { waitUntil: 'networkidle0' });
    await page.bringToFront();

    // Customize layout to match the clean 1200x630 presentation and inject a visual mouse cursor
    await page.evaluate(() => {
      const style = document.createElement('style');
      style.textContent = `
        /* Hide navigation and sections that don't need to be in the video preview */
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
          overflow: hidden;
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

        /* Virtual mouse cursor */
        #virtual-cursor {
          position: fixed;
          top: 0;
          left: 0;
          width: 28px;
          height: 28px;
          pointer-events: none;
          z-index: 999999;
          transform: translate3d(600px, 500px, 0);
          transform-origin: 4px 2px;
        }

        #virtual-cursor svg {
          width: 28px;
          height: 28px;
          filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.35));
          transition: transform 0.08s ease;
          transform-origin: 4px 2px;
        }

        #virtual-cursor.is-clicking svg {
          transform: scale(0.84);
        }

        #virtual-cursor-ring {
          position: absolute;
          top: 2px;
          left: 4px;
          width: 28px;
          height: 28px;
          margin-left: -14px;
          margin-top: -14px;
          border-radius: 50%;
          border: 2px solid rgba(37, 99, 235, 0.75);
          background: rgba(37, 99, 235, 0.18);
          transform: scale(0.2);
          opacity: 0;
          pointer-events: none;
        }

        #virtual-cursor.is-clicking #virtual-cursor-ring {
          transform: scale(1.15);
          opacity: 1;
        }
      `;
      document.head.appendChild(style);

      const cursor = document.createElement('div');
      cursor.id = 'virtual-cursor';
      cursor.innerHTML = `
        <div id="virtual-cursor-ring"></div>
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M4.2 2.4L19.4 13.1C20.1 13.6 19.7 14.7 18.9 14.8L12.5 15.4L15.6 21.1C15.9 21.7 15.6 22.5 15.0 22.8L13.5 23.5C12.9 23.8 12.1 23.5 11.8 22.9L8.8 17.1L4.6 20.6C3.9 21.1 2.9 20.6 2.9 19.8V3.2C2.9 2.3 3.5 1.9 4.2 2.4Z"
            fill="#111827"
            stroke="#ffffff"
            stroke-width="1.6"
            stroke-linejoin="round"
          />
        </svg>
      `;
      document.body.appendChild(cursor);

      window.__setCursor = (x, y, clicking = false) => {
        cursor.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        cursor.classList.toggle('is-clicking', clicking);
      };
    });

    // Measure coordinates of the playground input and a neutral area to click for blurring
    const coords = await page.evaluate(() => {
      const card = document.querySelector('#playground .card');
      const cardHeader = document.querySelector('#playground .card-header');
      const calcInput = document.getElementById('playground-input');
      const visibleInput = calcInput.querySelector('input:not([hidden])');
      const inputRect = visibleInput.getBoundingClientRect();
      const headerRect = cardHeader.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();

      return {
        start: {
          x: Math.round(cardRect.right - 90),
          y: Math.round(cardRect.bottom - 35),
        },
        inputClick: {
          x: Math.round(inputRect.left + 190),
          y: Math.round(inputRect.top + inputRect.height / 2),
        },
        typingRest: {
          x: Math.round(inputRect.left + 210),
          y: Math.round(inputRect.bottom + 18),
        },
        blurClick: {
          x: Math.round(headerRect.left + 260),
          y: Math.round(headerRect.top + headerRect.height / 2),
        },
      };
    });

    let frameIndex = 0;
    let cursorPos = { ...coords.start };

    const setCursor = async (x, y, clicking = false) => {
      cursorPos = { x, y };
      await page.evaluate(
        (cx, cy, isClicking) => {
          window.__setCursor(cx, cy, isClicking);
        },
        x,
        y,
        clicking
      );
    };

    const captureFrames = async (count) => {
      for (let i = 0; i < count; i++) {
        const filePath = path.join(framesDir, `frame_${String(frameIndex).padStart(5, '0')}.png`);
        await page.screenshot({ path: filePath, type: 'png' });
        frameIndex++;
      }
    };

    const moveCursor = async (toX, toY, durationFrames) => {
      const fromX = cursorPos.x;
      const fromY = cursorPos.y;
      for (let i = 1; i <= durationFrames; i++) {
        const t = easeInOutCubic(i / durationFrames);
        const x = Math.round(fromX + (toX - fromX) * t);
        const y = Math.round(fromY + (toY - fromY) * t);
        await setCursor(x, y, false);
        await captureFrames(1);
      }
    };

    const clickAtCurrentPos = async (onMouseDown) => {
      await setCursor(cursorPos.x, cursorPos.y, true);
      if (onMouseDown) {
        await onMouseDown();
      } else {
        await page.mouse.click(cursorPos.x, cursorPos.y);
      }
      await captureFrames(4);
      await setCursor(cursorPos.x, cursorPos.y, false);
      await captureFrames(2);
    };

    // 1. Initial blurred state showing "20"
    await setCursor(coords.start.x, coords.start.y, false);
    await captureFrames(Math.round(FPS * 0.7)); // 21 frames

    // 2. Move cursor to the input field and click to focus -> reveals "(2 + 3) * 4"
    await moveCursor(coords.inputClick.x, coords.inputClick.y, Math.round(FPS * 0.65));
    await clickAtCurrentPos(async () => {
      await page.mouse.click(coords.inputClick.x, coords.inputClick.y);
      // Place caret at the end of "(2 + 3) * 4"
      await page.evaluate(() => {
        const el = document.getElementById('playground-input');
        const fi = el.formulaInput;
        fi.setSelectionRange(fi.value.length, fi.value.length);
      });
    });

    // Hold briefly so viewer sees the revealed formula "(2 + 3) * 4"
    await captureFrames(Math.round(FPS * 0.65));

    // Move cursor slightly below the input while editing so it doesn't obscure text
    await moveCursor(coords.typingRest.x, coords.typingRest.y, Math.round(FPS * 0.35));

    // 3. Edit the formula: change "(2 + 3) * 4" -> "(2 + 3) * 10"
    await page.keyboard.press('Backspace');
    await captureFrames(Math.round(FPS * 0.25));

    await page.keyboard.type('1');
    await captureFrames(Math.round(FPS * 0.22));

    await page.keyboard.type('0');
    await captureFrames(Math.round(FPS * 0.7));

    // 4. Move cursor outside the field and click to blur -> evaluates and shows "50"
    await moveCursor(coords.blurClick.x, coords.blurClick.y, Math.round(FPS * 0.6));
    await clickAtCurrentPos(async () => {
      await page.mouse.click(coords.blurClick.x, coords.blurClick.y);
      await page.evaluate(() => {
        const el = document.getElementById('playground-input');
        el.blur();
      });
    });

    // Hold on the blurred state so viewer clearly sees "50"
    await captureFrames(Math.round(FPS * 1.0));

    // 5. Move cursor back to the input field and click to focus again -> reveals "(2 + 3) * 10"
    await moveCursor(coords.inputClick.x, coords.inputClick.y, Math.round(FPS * 0.6));
    await clickAtCurrentPos(async () => {
      await page.mouse.click(coords.inputClick.x, coords.inputClick.y);
      await page.evaluate(() => {
        const el = document.getElementById('playground-input');
        el.focus();
        const fi = el.formulaInput;
        fi.setSelectionRange(fi.value.length, fi.value.length);
      });
    });

    // Hold on the re-focused state showing "(2 + 3) * 10"
    await captureFrames(Math.round(FPS * 1.1));

    console.log(`Captured ${frameIndex} frames. Encoding MP4 to ${outputPath}...`);
    execFileSync(ffmpegBin, [
      '-y',
      '-framerate',
      String(FPS),
      '-i',
      path.join(framesDir, 'frame_%05d.png'),
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-crf',
      '18',
      '-preset',
      'slow',
      '-movflags',
      '+faststart',
      '-an',
      outputPath,
    ]);

    console.log(`Generated demo video at ${outputPath}`);

    console.log(`Encoding GIF to ${outputGifPath}...`);
    execFileSync(ffmpegBin, [
      '-y',
      '-framerate',
      String(FPS),
      '-i',
      path.join(framesDir, 'frame_%05d.png'),
      '-vf',
      'split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle',
      '-loop',
      '0',
      outputGifPath,
    ]);

    console.log(`Generated demo GIF at ${outputGifPath}`);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
    await fsp.rm(tmpDir, { recursive: true, force: true });
  }
}

generateVideo();
