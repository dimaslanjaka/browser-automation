import type { LaunchOptions } from 'puppeteer';
import type { ClusterOptions } from 'puppeteer-cluster';

export interface getPuppeteerOptions extends LaunchOptions {
  /**
   * Options passed to puppeteer-cluster's launch. If provided, `getPuppeteer`
   * will create and return a `cluster` instead of a single browser/page.
   */
  clusterOptions?: Partial<ClusterOptions> | Record<string, any>;
}

export interface GetPuppeteerSingleReturn {
  page: import('puppeteer').Page;
  browser: import('puppeteer').Browser;
  puppeteer: typeof import('puppeteer-extra');
}

export interface GetPuppeteerClusterReturn {
  cluster: import('puppeteer-cluster').Cluster;
  puppeteer: typeof import('puppeteer-extra');
}

/**
 * Return shape for `getPuppeteer()`.
 * - Single browser mode returns `{ page, browser, puppeteer }`.
 * - Cluster mode returns `{ cluster, puppeteer }` when `clusterOptions` provided.
 */
export type GetPuppeteerReturn = GetPuppeteerSingleReturn | GetPuppeteerClusterReturn;
