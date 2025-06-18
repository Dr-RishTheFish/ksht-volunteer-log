
"use client";

import type { TimeLogEntry } from '@/interfaces/TimeLogEntry';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface TimeLogTableProps {
  logs: TimeLogEntry[];
}

function formatDuration(startTime: Date, endTime: Date | null): string {
  if (!endTime) {
    return '--'; // Duration is not applicable if not clocked out
  }
  const durationMs = endTime.getTime() - startTime.getTime();
  if (durationMs < 0) return 'Invalid';

  const totalMinutes = Math.floor(durationMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${minutes}m`;
}

export function TimeLogTable({ logs }: TimeLogTableProps) {
  const todayDateFormatted = format(new Date(), 'M/d/yyyy');
  const entryCount = logs.length;

  return (
    <div className="w-full">
      <div className="mb-4">
        <h2 className="text-xl sm:text-2xl font-semibold">Today's Time Entries</h2>
        <p className="text-sm text-muted-foreground">
          {entryCount} {entryCount === 1 ? "entry" : "entries"} for {todayDateFormatted}
        </p>
      </div>
      {logs.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">No time logs for today yet.</p>
      ) : (
        <ScrollArea className="h-[300px] rounded-md border">
          <Table>
            <TableCaption>A list of today's time logs.</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Clock In</TableHead>
                <TableHead>Clock Out</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-medium">{log.name}</TableCell>
                  <TableCell>{format(log.clockIn, 'p')}</TableCell>
                  <TableCell>
                    {log.clockOut ? format(log.clockOut, 'p') : '---'}
                  </TableCell>
                  <TableCell>{formatDuration(log.clockIn, log.clockOut)}</TableCell>
                  <TableCell>
                    {log.clockOut ? (
                      <Badge variant="default" className="bg-green-500 hover:bg-green-600">Completed</Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-yellow-500 hover:bg-yellow-600">In Progress</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      )}
    </div>
  );
}
