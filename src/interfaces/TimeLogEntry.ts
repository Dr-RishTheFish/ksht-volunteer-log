export interface TimeLogEntry {
  id: string;
  name: string;
  clockIn: Date;
  clockOut: Date | null;
  date: string; // Format: YYYY-MM-DD
  note?: string;
}
