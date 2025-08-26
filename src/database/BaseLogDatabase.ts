export interface LogEntry<T> {
  id: string | number;
  data: T;
  message: string;
  timestamp?: string;
}

export interface BaseLogDatabase {
  addLog<T = any>(log: LogEntry<T>, options?: { timeout?: number }): Promise<void>;

  removeLog(id: LogEntry<any>['id']): Promise<boolean>;

  getLogById<T = any>(id: LogEntry<any>['id']): Promise<LogEntry<T> | undefined>;

  getLogs<T = any>(
    filterFn?: (log: LogEntry<T>) => boolean | Promise<boolean>,
    options?: { limit?: number; offset?: number }
  ): Promise<LogEntry<T>[]>;

  waitReady(): Promise<void>;

  close(): Promise<void> | void;
}
