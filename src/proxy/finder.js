import path from 'path';
import fs from 'fs-extra';
import { proxyGrabber } from 'proxies-grabber';
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';

const target = 'https://sehatindonesiaku.kemkes.go.id';
const proxyFile = path.join(process.cwd(), 'proxies.txt');
const proxyInstance = new proxyGrabber();
const __filename = fileURLToPath(import.meta.url);

/**
 * @param {unknown} entry
 */
function normalizeProxy(entry) {
  if (!entry) return null;

  if (typeof entry === 'string') {
    const text = entry.trim();
    if (!text || text === '[object Object]') return null;

    if (text.startsWith('{') && text.endsWith('}')) {
      try {
        return normalizeProxy(JSON.parse(text));
      } catch {
        return null;
      }
    }

    if (text.includes('://')) {
      try {
        const parsed = new URL(text);
        if (parsed.hostname && parsed.port) {
          return `${parsed.hostname}:${parsed.port}`;
        }
      } catch {
        return null;
      }
    }

    if (/^[^\s:]+:\d+$/.test(text)) {
      return text;
    }

    return null;
  }

  if (typeof entry === 'object') {
    const value = /** @type {Record<string, unknown>} */ (entry);
    const host = value.host || value.hostname || value.ip;
    const port = value.port;

    if (typeof host === 'string' && host && typeof port === 'number') {
      return `${host}:${port}`;
    }

    if (typeof host === 'string' && host && typeof port === 'string' && /^\d+$/.test(port)) {
      return `${host}:${port}`;
    }

    if (typeof value.proxy === 'string') {
      return normalizeProxy(value.proxy);
    }
  }

  return null;
}

/**
 * @param {unknown[]} entries
 */
function normalizeProxyList(entries) {
  const normalized = entries.map((entry) => normalizeProxy(entry)).filter(Boolean);
  return [...new Set(normalized)];
}

/**
 * @param {string[]} proxies
 */
async function writeProxyFile(proxies) {
  await fs.writeFile(proxyFile, proxies.join('\n'));
  return proxies;
}

export async function fetchProxies() {
  if (fs.existsSync(proxyFile)) {
    const currentLines = (await fs.readFile(proxyFile, 'utf-8')).split(/\r?\n/);
    const normalizedFromFile = normalizeProxyList(currentLines);

    if (normalizedFromFile.length > 0) {
      if (normalizedFromFile.length !== currentLines.filter(Boolean).length) {
        await writeProxyFile(normalizedFromFile);
      }
      return normalizedFromFile;
    }
  }

  const proxies = normalizeProxyList(await proxyInstance.get());

  if (proxies.length === 0) {
    throw new Error('No valid proxies returned by proxy provider');
  }

  await writeProxyFile(proxies);
  console.log(`Saved ${proxies.length} proxies to ${proxyFile}`);

  return proxies;

  // proxyInstance.test(1).then((results) => {
  //   console.log('Proxy test results:', results);
  // });
}

async function testProxies() {
  if (fs.existsSync(proxyFile)) {
    /** IP:PORT array */
    const proxies = normalizeProxyList(
      (await fs.readFile(proxyFile, 'utf-8'))
        .split(/\r?\n/)
        .map((proxy) => proxy.trim())
        .filter(Boolean)
    );

    const protocols = ['http', 'https', 'socks4', 'socks5'];
    const working = [];

    for (const proxy of proxies) {
      for (const protocol of protocols) {
        let browser;
        const startedAt = Date.now();
        const proxyUrl = `${protocol}://${proxy}`;

        try {
          browser = await puppeteer.launch({
            headless: true,
            args: [`--proxy-server=${proxyUrl}`]
          });

          const page = await browser.newPage();
          await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 20_000 });

          const elapsedMs = Date.now() - startedAt;
          console.log(`✅ WORKING ${proxyUrl} (${elapsedMs}ms)`);
          working.push(proxyUrl);
        } catch (error) {
          const elapsedMs = Date.now() - startedAt;
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.log(`❌ FAILED ${proxyUrl} (${elapsedMs}ms) -> ${errorMessage}`);
        } finally {
          if (browser) {
            await browser.close();
          }
        }
      }
    }

    const workingFile = path.join(process.cwd(), 'tmp', 'working-proxies.txt');
    await fs.mkdir(path.dirname(workingFile), { recursive: true });
    await fs.writeFile(workingFile, working.join('\n'));

    console.log(`\nDone. Working proxies: ${working.length}/${proxies.length}`);
    console.log(`Saved working list to ${workingFile}`);

    return working;
  }

  throw new Error(`Proxy file not found: ${proxyFile}`);
}

if (process.argv[1] === __filename) {
  // Run both functions parallelly
  fetchProxies().then((proxies) => {
    console.log(`Fetched ${proxies.length} proxies.`);
  });
  testProxies().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
