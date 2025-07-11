
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
import { useState, useEffect } from 'react';
import type { UserProfile } from '@/interfaces/User';

interface TimeLogTableProps {
  logs: TimeLogEntry[];
  currentUserName?: string; // Optional: only relevant for highlighting or specific messages
  userRole?: UserProfile['role']; // Optional: for role-specific display variations
}

function formatDuration(startTime: Date, endTime: Date | null): string {
  if (!endTime) {
    return '--';
  }
  const durationMs = endTime.getTime() - startTime.getTime();
  if (durationMs < 0) return 'Invalid';

  let remainingMs = durationMs;

  const hours = Math.floor(remainingMs / (1000 * 60 * 60));
  remainingMs %= (1000 * 60 * 60);

  const minutes = Math.floor(remainingMs / (1000 * 60));
  remainingMs %= (1000 * 60);

  const seconds = Math.floor(remainingMs / 1000);

  return `${hours}h ${minutes}m ${seconds}s`;
}

export function TimeLogTable({ logs, userRole, currentUserName }: TimeLogTableProps) {
  const [todayDateFormatted, setTodayDateFormatted] = useState<string | null>(null);
  const entryCount = logs.length;

  useEffect(() => {
    setTodayDateFormatted(format(new Date(), 'M/d/yyyy'));
  }, []);

  const captionText = userRole === 'member' ? 
    `A list of your time logs for today.` :
    `A list of today's time logs for the organization.`;

  return (
    <div className="w-full">
      {/* Title is now in page.tsx CardHeader */}
      {/* <div className="mb-4">
        <h2 className="text-xl sm:text-2xl font-semibold">Today's Time Entries</h2>
      </div> */}
      {todayDateFormatted ? (
        <p className="text-sm text-muted-foreground mb-4">
          {entryCount} {entryCount === 1 ? "entry" : "entries"} for {todayDateFormatted}
          {userRole === 'member' && currentUserName ? ` (showing only for ${currentUserName})` : ''}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground mb-4">
          {entryCount} {entryCount === 1 ? "entry" : "entries"}
        </p>
      )}
      {logs.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          {userRole === 'member' ? 'You have no time logs for today yet.' : 'No time logs for today yet.'}
        </p>
      ) : (
        <ScrollArea className="h-[300px] rounded-md border">
          <Table>
            <TableCaption>{captionText}</TableCaption>
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
                <TableRow key={log.id} className={log.name === currentUserName ? 'bg-accent/10' : ''}>
                  <TableCell className="font-medium">{log.name}</TableCell>
                  <TableCell>{format(log.clockIn, 'pp')}</TableCell>
                  <TableCell>
                    {log.clockOut ? format(log.clockOut, 'pp') : '---'}
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
