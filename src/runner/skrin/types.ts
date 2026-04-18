import { ExcelRowData } from '../../../globals';

export interface SkrinDatabaseEntry {
  id: string;
  data: ExcelRowData & { status: string };
  message: 'invalid' | 'success' | 'error' | 'failed';
}
