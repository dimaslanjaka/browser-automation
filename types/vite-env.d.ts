/// <reference types="vite/client" />
import { ImportMetaEnvFallbackKey } from 'vite/types/importMeta';

// Custom typing for import.meta.env based on .env keys
interface ImportMetaEnv {
  [key: ImportMetaEnvFallbackKey]: any;
  BASE_URL: string;
  MODE: string;
  DEV: boolean;
  PROD: boolean;
  SSR: boolean;
  readonly skrin_username: string;
  readonly skrin_password: string;
  readonly SPREADSHEET_ID: string;
  readonly KEMKES_SPREADSHEET_ID: string;
  readonly index_start: string;
  readonly index_end: string;
  readonly DATABASE_FILENAME: string;
  readonly GITHUB_TOKEN: string;
  readonly GITLAB_TOKEN: string;
  readonly JSON_SECRET: string;
  readonly VITE_JSON_SECRET: string;
  readonly DOTENV_PRIVATE_KEY: string;
  readonly SIH_USERNAME: string;
  readonly SIH_PASSWORD: string;
  readonly MYSQL_USER: string;
  readonly MYSQL_PASS: string;
  readonly MYSQL_HOST: string;
  readonly MYSQL_DBNAME: string;
}

declare interface ImportMeta {
  readonly env: ImportMetaEnv;
}
