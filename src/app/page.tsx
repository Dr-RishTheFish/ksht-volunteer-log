"use client";

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TimeLogTable } from '@/components/TimeLogTable';
import type { TimeLogEntry } from '@/interfaces/TimeLogEntry';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Clock, LogIn, LogOut, FileDown, Brain } from 'lucide-react';

export default function Home() {
  const [name, setName] = useState<string>('');
  const [timeLogs, setTimeLogs] = useState<TimeLogEntry[]>([]);
  const { toast } = useToast();

  // Load logs from localStorage on initial render
  useEffect(() => {
    const storedLogs = localStorage.getItem('timeLogs');
    if (storedLogs) {
      try {
        const parsedLogs = JSON.parse(storedLogs, (key, value) => {
          if (key === 'clockIn' || key === 'clockOut') {
            return value ? new Date(value) : null;
          }
          return value;
        }) as TimeLogEntry[];
        setTimeLogs(parsedLogs);
      } catch (error) {
        console.error("Failed to parse logs from localStorage", error);
        localStorage.removeItem('timeLogs'); // Clear corrupted data
      }
    }
  }, []);

  // Save logs to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('timeLogs', JSON.stringify(timeLogs));
  }, [timeLogs]);

  const isCurrentUserClockedIn = useMemo(() => {
    if (!name) return false;
    return timeLogs.some(log => log.name === name && log.clockOut === null && log.date === format(new Date(), 'yyyy-MM-dd'));
  }, [name, timeLogs]);

  const handleClockIn = () => {
    if (!name.trim()) {
      toast({ title: 'Error', description: 'Please enter your name.', variant: 'destructive' });
      return;
    }
    if (isCurrentUserClockedIn) {
      toast({ title: 'Error', description: `${name} is already clocked in.`, variant: 'destructive' });
      return;
    }

    const newLog: TimeLogEntry = {
      id: crypto.randomUUID(),
      name: name.trim(),
      clockIn: new Date(),
      clockOut: null,
      date: format(new Date(), 'yyyy-MM-dd'),
    };
    setTimeLogs(prevLogs => [...prevLogs, newLog]);
    toast({ title: 'Success', description: `Clocked in as ${name.trim()} at ${format(newLog.clockIn, 'hh:mm:ss a')}.` });
  };

  const handleClockOut = () => {
    if (!name.trim()) {
      toast({ title: 'Error', description: 'Please enter your name to clock out.', variant: 'destructive' });
      return;
    }
    if (!isCurrentUserClockedIn) {
      toast({ title: 'Error', description: `${name} is not clocked in.`, variant: 'destructive' });
      return;
    }

    setTimeLogs(prevLogs => {
      const newLogs = [...prevLogs];
      const logIndex = newLogs.findLastIndex(
        (log) => log.name === name.trim() && log.clockOut === null && log.date === format(new Date(), 'yyyy-MM-dd')
      );

      if (logIndex !== -1) {
        newLogs[logIndex] = { ...newLogs[logIndex], clockOut: new Date() };
        toast({ title: 'Success', description: `Clocked out ${name.trim()} at ${format(newLogs[logIndex].clockOut!, 'hh:mm:ss a')}.` });
        return newLogs;
      }
      // Should not happen if isCurrentUserClockedIn is true, but as a fallback:
      toast({ title: 'Error', description: 'Could not find active clock-in record.', variant: 'destructive' });
      return prevLogs;
    });
  };

  const handleExportToCSV = () => {
    if (todayLogs.length === 0) {
      toast({ title: 'Info', description: 'No logs to export for today.' });
      return;
    }

    const headers = ['Name', 'Date', 'Clock In Time', 'Clock Out Time', 'Duration (HH:mm:ss)'];
    const rows = todayLogs.map(log => [
      log.name,
      format(new Date(log.date), 'MM/dd/yyyy'),
      format(log.clockIn, 'hh:mm:ss a'),
      log.clockOut ? format(log.clockOut, 'hh:mm:ss a') : 'N/A',
      log.clockOut ? formatDuration(log.clockIn.getTime(), log.clockOut.getTime()) : 'In Progress'
    ]);

    let csvContent = "data:text/csv;charset=utf-8,"
      + headers.join(",") + "\n"
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `timesheet_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: 'Success', description: 'Timesheet exported to CSV.' });
  };
  
  function formatDuration(startTimeMs: number, endTimeMs: number | null): string {
    if (!endTimeMs) return 'In Progress';
    const durationMs = endTimeMs - startTimeMs;
    if (durationMs < 0) return 'Invalid';

    const totalSeconds = Math.floor(durationMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }


  const todayLogs = useMemo(() => {
    const todayDateStr = format(new Date(), 'yyyy-MM-dd');
    return timeLogs.filter(log => log.date === todayDateStr).sort((a,b) => b.clockIn.getTime() - a.clockIn.getTime());
  }, [timeLogs]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-background to-secondary/30 flex flex-col items-center justify-center p-4 selection:bg-primary/20 selection:text-primary">
      <Card className="w-full max-w-2xl shadow-2xl">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Brain className="h-10 w-10 text-primary" />
            <CardTitle className="text-4xl font-headline">Big Brainbox Time Clock</CardTitle>
          </div>
          <CardDescription className="text-lg">
            Track your work hours with creativity and energy!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-base">Your Name</Label>
            <Input
              id="name"
              type="text"
              placeholder="Enter your name (e.g., Albert Einstein)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-base py-6"
              aria-describedby="name-description"
            />
            <p id="name-description" className="text-sm text-muted-foreground">
              {isCurrentUserClockedIn ? `${name} is currently clocked IN.` : 'Enter your name to clock in or out.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Button
              onClick={handleClockIn}
              disabled={!name.trim() || isCurrentUserClockedIn}
              size="lg"
              className="w-full text-base py-6"
              aria-label="Clock In"
            >
              <LogIn className="mr-2 h-5 w-5" /> Clock In
            </Button>
            <Button
              onClick={handleClockOut}
              disabled={!name.trim() || !isCurrentUserClockedIn}
              variant="outline"
              size="lg"
              className="w-full text-base py-6 border-primary text-primary hover:bg-primary/10"
              aria-label="Clock Out"
            >
              <LogOut className="mr-2 h-5 w-5" /> Clock Out
            </Button>
          </div>

          <div className="space-y-4">
            <h3 className="text-2xl font-semibold flex items-center gap-2">
              <Clock className="h-6 w-6 text-primary" />
              Today's Time Logs
            </h3>
            <TimeLogTable logs={todayLogs} />
          </div>

          <div className="text-center">
            <Button
              onClick={handleExportToCSV}
              disabled={todayLogs.length === 0}
              variant="secondary"
              size="lg"
              className="text-base py-6"
              aria-label="Export Today's Timesheet to CSV"
            >
              <FileDown className="mr-2 h-5 w-5" /> Export Today's Timesheet (CSV)
            </Button>
          </div>
        </CardContent>
      </Card>
      <footer className="mt-8 text-center text-muted-foreground text-sm">
        <p>&copy; {new Date().getFullYear()} Big Brainbox Time Clock. Keep track, stay sharp!</p>
      </footer>
    </main>
  );
}
