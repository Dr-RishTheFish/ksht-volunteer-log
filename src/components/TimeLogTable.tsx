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
import { format } from 'date-fns';

interface TimeLogTableProps {
  logs: TimeLogEntry[];
}

function formatDuration(startTime: Date, endTime: Date | null): string {
  if (!endTime) return 'In Progress';
  const durationMs = endTime.getTime() - startTime.getTime();
  if (durationMs < 0) return 'Invalid';

  const totalSeconds = Math.floor(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function TimeLogTable({ logs }: TimeLogTableProps) {
  if (!logs.length) {
    return <p className="text-center text-muted-foreground">No time logs for today yet.</p>;
  }

  return (
    <ScrollArea className="h-[300px] rounded-md border">
      <Table>
        <TableCaption>A list of today's time logs.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Clock In</TableHead>
            <TableHead>Clock Out</TableHead>
            <TableHead>Duration</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <TableRow key={log.id}>
              <TableCell className="font-medium">{log.name}</TableCell>
              <TableCell>{format(new Date(log.date), 'MM/dd/yyyy')}</TableCell>
              <TableCell>{format(log.clockIn, 'hh:mm:ss a')}</TableCell>
              <TableCell>
                {log.clockOut ? format(log.clockOut, 'hh:mm:ss a') : '---'}
              </TableCell>
              <TableCell>{formatDuration(log.clockIn, log.clockOut)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}
