
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { StickyNote } from 'lucide-react';

interface TimeLogTableProps {
  logs: TimeLogEntry[];
  currentUserName?: string; 
  userRole?: UserProfile['role']; 
  displayDate: Date; 
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

export function TimeLogTable({ logs, userRole, currentUserName, displayDate }: TimeLogTableProps) {
  const [formattedDisplayDate, setFormattedDisplayDate] = useState<string | null>(null);
  const entryCount = logs.length;

  useEffect(() => {
    setFormattedDisplayDate(format(displayDate, 'M/d/yyyy'));
  }, [displayDate]);

  const captionText = userRole === 'member' ? 
    `A list of your volunteer logs for ${formattedDisplayDate || 'the selected date'}.` :
    `A list of volunteer logs for ${formattedDisplayDate || 'the selected date'} for the organization.`;

  return (
    <div className="w-full">
      {formattedDisplayDate ? (
        <p className="text-sm text-muted-foreground mb-4">
          {entryCount} {entryCount === 1 ? "entry" : "entries"} for {formattedDisplayDate}
          {userRole === 'member' && currentUserName ? ` (showing only for ${currentUserName})` : ''}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground mb-4">
          {entryCount} {entryCount === 1 ? "entry" : "entries"}
        </p>
      )}
      {logs.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          {userRole === 'member' ? `You have no volunteer logs for ${formattedDisplayDate || 'this date'} yet.` : `No volunteer logs for ${formattedDisplayDate || 'this date'} yet.`}
        </p>
      ) : (
        <ScrollArea className="h-[300px] rounded-md border">
          <TooltipProvider>
            <Table>
              <TableCaption>{captionText}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Volunteer</TableHead>
                  <TableHead>Clock In</TableHead>
                  <TableHead>Clock Out</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id} className={log.name === currentUserName && userRole === 'member' ? 'bg-primary/10' : ''}>
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
                    <TableCell className="text-center">
                      {log.note ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <StickyNote className="h-5 w-5 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs break-words">
                            <p>{log.note}</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-muted-foreground/50">---</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TooltipProvider>
        </ScrollArea>
      )}
    </div>
  );
}
