// Records one role's walkthrough in the real app, paced to the voiceover clips.
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const APP = 'http://localhost:5273';
const API = 'http://localhost:3100';
const PASSWORD = 'demo-ribat-2026';
const HOLD = 1.5; // seconds the picture rests after each line, so nothing feels rushed
const lines = Object.fromEntries(
  JSON.parse(fs.readFileSync(path.join(ROOT, 'src/lines.json'), 'utf8')).map((l) => [l.id, l]),
);

// A visible cursor with a ripple on press: headless Chrome draws no pointer of its own.
const CURSOR = `
addEventListener('DOMContentLoaded', () => {
  const dot = document.createElement('div');
  dot.style.cssText = 'position:fixed;z-index:2147483647;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:rgba(212,169,74,.35);border:2px solid #d4a94a;pointer-events:none;transition:transform .15s;left:-50px;top:-50px';
  document.body.append(dot);
  addEventListener('mousemove', (e) => { dot.style.left = e.clientX + 'px'; dot.style.top = e.clientY + 'px'; }, true);
  addEventListener('mousedown', () => { dot.style.transform = 'scale(.6)'; }, true);
  addEventListener('mouseup', () => { dot.style.transform = 'scale(1)'; }, true);
});`;

export const DESKTOP = { width: 1440, height: 810, scale: 4 / 3 };
export const PHONE = { width: 390, height: 844, scale: 2 };

export async function role(name, { phone, device, theme, start = '/' }, walk) {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  const dir = path.join(ROOT, 'out/rec-tmp', name);
  fs.rmSync(dir, { recursive: true, force: true });
  const size = { width: Math.round(device.width * device.scale), height: Math.round(device.height * device.scale) };
  // Chrome's own screencast, not recordVideo: it sends frames at device pixels, so text stays sharp.
  fs.mkdirSync(dir, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: device.width, height: device.height },
    deviceScaleFactor: device.scale,
    locale: 'ar',
  });
  // Vite's proxy points at the developer's API on :3000; send this browser's calls to the recording API.
  await context.route(`${APP}/api/**`, (route) => route.continue({ url: route.request().url().replace(APP, API) }));
  await context.addInitScript(CURSOR);
  await context.addInitScript(
    `try{localStorage.setItem('ribat.theme','${theme}');localStorage.setItem('ribat.pattern','on');localStorage.setItem('i18nextLng','ar')}catch{}`,
  );
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    const file = path.join(dir, `${String(frames.length).padStart(6, '0')}.jpg`);
    fs.writeFileSync(file, Buffer.from(data, 'base64'));
    frames.push({ file, t: metadata.timestamp });
    void cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: size.width, maxHeight: size.height });
  const videoStart = Date.now();
  const now = () => (Date.now() - videoStart) / 1000;

  // Sign in off camera; the edit starts at t0.
  await page.goto(`${APP}/login`);
  await page.locator('input').first().fill(phone);
  await page.locator('input[type=password]').fill(PASSWORD);
  await page.locator('button[type=submit]').click();
  await page.waitForURL(/staff|member|guardian/);
  await page.goto(APP + start);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1200);
  await page.mouse.move(device.width * 0.55, device.height * 0.45);

  const timeline = { role: name, device, size, t0: now(), lines: [], clicks: [], zooms: [] };

  const s = {
    page,
    context,
    /** One voiceover line: act, then hold until the clip has finished plus a rest. */
    async line(id, action) {
      const line = lines[id];
      if (!line) throw new Error(`No line ${id}`);
      const start = now();
      timeline.lines.push({ id, t: start });
      if (action) await action();
      const left = line.seconds + HOLD - (now() - start);
      if (left > 0) await page.waitForTimeout(left * 1000);
    },
    /** Glide to an element and press it. */
    async tap(locator) {
      await s.center(locator);
      const box = await locator.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 28 });
      await page.waitForTimeout(250);
      timeline.clicks.push(now());
      await page.mouse.down();
      await page.waitForTimeout(90);
      await page.mouse.up();
      await page.waitForTimeout(500);
    },
    /** Push the camera in on an element for `seconds`. */
    async zoom(locator, seconds = 3, scale = 1.35) {
      await s.center(locator);
      const box = await locator.boundingBox();
      if (box) timeline.zooms.push({ t: now(), seconds, scale, box });
    },
    /** Bring an element to mid-screen, clear of the sticky header and the tally bar, if it is not there already. */
    async center(locator) {
      await locator.waitFor();
      const moved = await locator.evaluate((el) => {
        const r = el.getBoundingClientRect();
        if (r.top > innerHeight * 0.2 && r.bottom < innerHeight * 0.75) return false;
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        return true;
      });
      if (moved) await page.waitForTimeout(700);
    },
    async type(locator, text) {
      await s.tap(locator);
      await locator.pressSequentially(text, { delay: 85 });
    },
    /** Scroll like a person reading: small wheel steps. */
    async scroll(pixels, seconds = 2) {
      const steps = Math.max(1, Math.round(seconds * 12));
      for (let i = 0; i < steps; i++) {
        await page.mouse.wheel(0, pixels / steps);
        await page.waitForTimeout((seconds * 1000) / steps);
      }
    },
    async wait(seconds) {
      await page.waitForTimeout(seconds * 1000);
    },
    now,
  };

  try {
    await walk(s);
    await page.waitForTimeout(800);
    timeline.end = now();
  } catch (error) {
    await page.screenshot({ path: path.join(ROOT, `out/fail-${name}.png`) }).catch(() => {});
    throw error;
  } finally {
    await cdp.send('Page.stopScreencast').catch(() => {});
    await context.close();
    await browser.close();
    const rec = path.join(ROOT, 'public/rec');
    fs.mkdirSync(rec, { recursive: true });
    // Frames arrive only when the screen changes; each one lasts until the next.
    // Times are shifted so frame zero sits at videoStart, matching every logged event.
    const shift = frames[0].t - videoStart / 1000;
    const list = frames.map((f, i) => {
      const next = frames[i + 1]?.t ?? f.t + 0.5;
      return `file '${f.file}'\nduration ${Math.max(0.001, next - f.t).toFixed(4)}`;
    });
    const concat = path.join(dir, 'frames.txt');
    fs.writeFileSync(concat, `ffconcat version 1.0\n${list.join('\n')}\nfile '${frames.at(-1).file}'\n`);
    for (const key of ['t0', 'end']) timeline[key] -= shift;
    for (const l of timeline.lines) l.t -= shift;
    for (const z of timeline.zooms) z.t -= shift;
    timeline.clicks = timeline.clicks.map((c) => c - shift);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', concat,
      '-vf', `fps=30,scale=${size.width}:${size.height}:force_original_aspect_ratio=decrease,pad=${size.width}:${size.height}:(ow-iw)/2:(oh-ih)/2`,
      '-c:v', 'libx264', '-crf', '16', '-preset', 'fast', '-pix_fmt', 'yuv420p', path.join(rec, `${name}.mp4`)]);
    fs.writeFileSync(path.join(rec, `${name}.json`), JSON.stringify(timeline, null, 1));
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(name, 'recorded', (timeline.end - timeline.t0).toFixed(1), 's from', frames.length, 'frames');
  }
}
