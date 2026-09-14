import { HistoryRow } from './apiClient';

const STORAGE_KEY = 'wifi-monitor-native-history';
const MAX_ROWS = 500;

function readRows(): HistoryRow[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as HistoryRow[]) : [];
  } catch (error) {
    console.warn('Failed to read local history log:', error);
    return [];
  }
}

export function appendHistoryRow(row: HistoryRow): void {
  const rows = readRows();
  rows.push(row);
  if (rows.length > MAX_ROWS) {
    rows.splice(0, rows.length - MAX_ROWS);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

export function readHistoryRows(limit = 48): HistoryRow[] {
  const rows = readRows();
  return rows.slice(-limit);
}
