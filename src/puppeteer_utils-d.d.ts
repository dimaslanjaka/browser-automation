import type { LaunchOptions } from 'puppeteer';
import type { ClusterOptions } from 'puppeteer-cluster';
import type { LaunchOptions as PlaywrightLaunchOptions } from 'playwright';

export interface getPuppeteerOptions extends LaunchOptions {
  reuse?: boolean;
  autoSwitchProfileDir?: boolean;
  devtools?: boolean;
  stealth?: {
    mode?: 'default' | 'stealth' | 'fingerprint';
    fingerprintStrategy?: 'fetch' | 'random-cached' | 'latest-cached' | 'random-or-fetch';
    fingerprintTags?: string[];
    screenSize?: {
      width?: number;
      height?: number;
      minWidth?: number;
      minHeight?: number;
      maxWidth?: number;
      maxHeight?: number;
    };
  };
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
  autoSwitchProfileDir?: boolean;
  puppeteerOptions?: LaunchOptions;
}

export type GetPuppeteerReturn = GetPuppeteerSingleReturn | GetPuppeteerClusterReturn;
