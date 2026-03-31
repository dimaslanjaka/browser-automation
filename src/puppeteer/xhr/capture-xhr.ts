import fs from 'fs-extra';
import path from 'path';
import type { HTTPRequest, HTTPResponse, Page } from 'puppeteer';

export function setupXhrCapture(page: Page, opts?: { baseDir?: string }) {
  const baseDir = opts?.baseDir || path.join(process.cwd(), 'tmp/puppeteer/xhr');

  async function getPostDataSafe(request: HTTPRequest): Promise<string | undefined> {
    const _req: any = request as any;
    let rawPostData: any = undefined;
    if (typeof _req.fetchPostData === 'function') rawPostData = _req.fetchPostData();
    else if (typeof _req.postData === 'function') rawPostData = _req.postData();
    else rawPostData = undefined;

    if (rawPostData === undefined || rawPostData === null) return undefined;

    rawPostData = await Promise.resolve(rawPostData);

    if (rawPostData === undefined || rawPostData === null) return undefined;
    if (typeof rawPostData === 'string') return rawPostData;
    if (typeof rawPostData.toString === 'function') return rawPostData.toString();
    return String(rawPostData);
  }

  const sanitize = (s: string) =>
    s
      .toString()
      .trim()
      // eslint-disable-next-line no-control-regex, no-useless-escape
      .replace(/[:<>"\\\/\|\?\*\x00-\x1F]/g, '_')
      .replace(/\s+/g, '_')
      .substring(0, 255);

  const buildRawRequest = (request: HTTPRequest, postData?: string) => {
    try {
      const reqUrl = new URL(request.url());
      const pathAndQuery = reqUrl.pathname + (reqUrl.search || '');
      const requestLine = `${request.method()} ${pathAndQuery} HTTP/1.1`;

      const origHeaders = request.headers() || {};
      const headers: Record<string, any> = { ...origHeaders };

      const hasHost = Object.keys(headers).some((k) => k.toLowerCase() === 'host');
      if (!hasHost) headers['Host'] = reqUrl.host;

      const hasContentLength = Object.keys(headers).some((k) => k.toLowerCase() === 'content-length');
      if (postData && !hasContentLength) {
        headers['Content-Length'] = Buffer.byteLength(postData, 'utf8');
      }

      const headersText = Object.entries(headers)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\r\n');

      const bodyText = postData || '';
      return `${requestLine}\r\n${headersText}\r\n\r\n${bodyText}`;
    } catch (e) {
      console.error('Error building raw request for', request.url(), e);
      return undefined;
    }
  };

  const requestHandler = (request: HTTPRequest) => {
    try {
      if (request.resourceType && request.resourceType() === 'xhr') {
        // do nothing here; response handler will capture contents
      }
      request.continue();
    } catch (_e) {
      try {
        request.continue();
      } catch (_er) {
        // ignore
      }
    }
  };

  const responseHandler = async (response: HTTPResponse) => {
    try {
      const request = response.request();
      if (!request || request.resourceType() !== 'xhr') return;

      const respText = await response.text();
      const postData = await getPostDataSafe(request);

      const rawRequest = buildRawRequest(request, postData);
      if (!rawRequest) {
        console.error('No raw HTTP request available for', request.url());
        return;
      }

      const statusText = typeof (response as any).statusText === 'function' ? (response as any).statusText() : '';
      const statusLine = `HTTP/1.1 ${response.status()}${statusText ? ' ' + statusText : ''}`;

      const respOrigHeaders = response.headers() || {};
      const respHeaders: Record<string, any> = { ...respOrigHeaders };
      const hasRespContentLength = Object.keys(respHeaders).some((k) => k.toLowerCase() === 'content-length');
      if (respText && !hasRespContentLength) {
        respHeaders['Content-Length'] = Buffer.byteLength(respText, 'utf8');
      }

      const respHeadersText = Object.entries(respHeaders)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\r\n');

      const combined = `${rawRequest}\r\n\r\n${statusLine}\r\n${respHeadersText}\r\n\r\n${respText}`;

      try {
        const reqUrl = new URL(request.url());
        const host = reqUrl.hostname || 'unknown-host';
        const pathname = reqUrl.pathname || '/';

        const rawSegments = pathname.split('/').filter(Boolean);
        const decodedSegments = rawSegments.map((seg) => {
          try {
            return decodeURIComponent(seg);
          } catch (e) {
            console.error('Failed to decode path segment', seg, e);
            return seg;
          }
        });
        const segments = decodedSegments.map(sanitize);

        let lastSegment = segments.length ? segments[segments.length - 1] : 'index';
        if (!lastSegment) lastSegment = 'index';
        let fileName = lastSegment;
        if (!fileName.toLowerCase().endsWith('.log')) fileName = `${fileName}.log`;

        const dirParts = [baseDir, host, ...segments.slice(0, -1)];
        const fileDir = path.join(...dirParts);
        await fs.ensureDir(fileDir);
        const filePath = path.join(fileDir, fileName);
        await fs.writeFile(filePath, combined, 'utf8');
        console.log(filePath);
      } catch (e) {
        console.error('Error parsing URL for request', request.url(), e);
        const fileName = `unknown-${Date.now()}.log`;
        const filePath = path.join(baseDir, fileName);
        await fs.ensureDir(baseDir);
        await fs.writeFile(filePath, combined, 'utf8');
        console.log(filePath);
      }
    } catch (err) {
      console.error('Failed to save XHR log', err);
    }
  };

  (async () => {
    try {
      await page.setRequestInterception(true);
    } catch (_e) {
      // ignore
    }
    page.on('request', requestHandler);
    page.on('response', responseHandler);
  })();

  return async function stopCapture() {
    page.off('request', requestHandler);
    page.off('response', responseHandler);
    try {
      await page.setRequestInterception(false);
    } catch (_e) {
      // ignore
    }
  };
}

export default setupXhrCapture;
