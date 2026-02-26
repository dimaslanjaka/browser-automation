import type { LaunchOptions } from 'puppeteer';
import type { ClusterOptions } from 'puppeteer-cluster';
import type { LaunchOptions as PlaywrightLaunchOptions } from 'playwright';

export interface getPuppeteerOptions extends LaunchOptions {
  reuse?: boolean;
  autoSwitchProfileDir?: boolean;
  devtools?: boolean;
}

export interface getPlaywrightOptions extends PlaywrightLaunchOptions {
  reuse?: boolean;
  autoSwitchProfileDir?: boolean;
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

export interface GetPuppeteerClusterOptions extends Partial<ClusterOptions> {
  reuse?: boolean;
  puppeteerOptions?: LaunchOptions;
}

export type GetPuppeteerReturn = GetPuppeteerSingleReturn | GetPuppeteerClusterReturn;
