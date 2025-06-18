
"use client";

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { TimeLogEntry } from '@/interfaces/TimeLogEntry';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { User, CalendarDays, ArrowRightToLine, ArrowLeftToLine, Download, Share2, UploadCloud } from 'lucide-react';
import { TimeLogTable } from '@/components/TimeLogTable';

export default function Home() {
  const [name, setName] = useState<string>('');
  const [timeLogs, setTimeLogs] = useState<TimeLogEntry[]>([]);
  const [currentDateTime, setCurrentDateTime] = useState<string>('');
  const { toast } = useToast();

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
        localStorage.removeItem('timeLogs');
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('timeLogs', JSON.stringify(timeLogs));
  }, [timeLogs]);

  useEffect(() => {
    const updateDateTime = () => {
      setCurrentDateTime(format(new Date(), 'MM/dd/yyyy - hh:mm:ss a'));
    };
    updateDateTime();
    const timer = setInterval(updateDateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const isCurrentUserClockedIn = useMemo(() => {
    if (!name) return false;
    const todayDateStr = format(new Date(), 'yyyy-MM-dd');
    return timeLogs.some(log => log.name === name && log.clockOut === null && log.date === todayDateStr);
  }, [name, timeLogs]);

  const handleClockIn = () => {
    if (!name.trim()) {
      toast({ title: 'Error', description: 'Please enter your name.', variant: 'destructive' });
      return;
    }
    if (isCurrentUserClockedIn) {
      toast({ title: 'Error', description: `${name} is already clocked in for today.`, variant: 'destructive' });
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
  };

  const handleClockOut = () => {
    if (!name.trim()) {
      toast({ title: 'Error', description: 'Please enter your name to clock out.', variant: 'destructive' });
      return;
    }
    if (!isCurrentUserClockedIn) {
      toast({ title: 'Error', description: `${name} is not clocked in for today.`, variant: 'destructive' });
      return;
    }

    setTimeLogs(prevLogs => {
      const newLogs = [...prevLogs];
      const todayDateStr = format(new Date(), 'yyyy-MM-dd');
      const logIndex = newLogs.findLastIndex(
        (log) => log.name === name.trim() && log.clockOut === null && log.date === todayDateStr
      );

      if (logIndex !== -1) {
        newLogs[logIndex] = { ...newLogs[logIndex], clockOut: new Date() };
        return newLogs;
      }
      toast({ title: 'Error', description: 'Could not find active clock-in record for today.', variant: 'destructive' });
      return prevLogs;
    });
  };

  const todayLogs = useMemo(() => {
    const todayDateStr = format(new Date(), 'yyyy-MM-dd');
    return timeLogs
      .filter(log => log.date === todayDateStr)
      .sort((a,b) => b.clockIn.getTime() - a.clockIn.getTime());
  }, [timeLogs]);

  const handleExport = () => {
    toast({
        title: "Export Timesheet",
        description: "XLSX export functionality is coming soon!",
    });
    console.log("Exporting timesheet:", todayLogs);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-background to-secondary/10 flex flex-col items-center p-4 sm:p-8 space-y-8 selection:bg-primary/20 selection:text-primary">
      <div className="text-center space-y-4 w-full max-w-2xl">
        <Image
          src="/Stickers.png"
          alt="Big Brainbox Logo"
          width={100}
          height={100}
          className="mx-auto rounded-full shadow-lg"
        />
        <h1 className="text-4xl sm:text-5xl font-bold">
          <span className="bg-gradient-to-r from-primary to-accent text-transparent bg-clip-text">
            Big Brainbox Time Clock
          </span>
        </h1>
        <p className="text-lg sm:text-xl text-muted-foreground">
          Professional time tracking with cloud sync
        </p>
        {currentDateTime && (
          <div className="inline-flex items-center gap-2 p-3 sm:p-4 rounded-lg shadow-md bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold text-md sm:text-lg">
            <CalendarDays className="h-5 w-5 sm:h-6 sm:w-6" />
            <span>{currentDateTime}</span>
          </div>
        )}
      </div>

      <Card className="w-full max-w-md shadow-xl rounded-xl">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl font-semibold">
            <User className="h-6 w-6 text-primary" />
            Time Tracking Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="name" className="text-sm font-medium text-foreground/80">Employee Name</Label>
            <Input
              id="name"
              type="text"
              placeholder="Enter your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 text-base py-3 px-4 h-12 rounded-md focus:border-primary focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Button
              onClick={handleClockIn}
              disabled={!name.trim() || isCurrentUserClockedIn}
              size="lg"
              className="text-base py-3 h-12 rounded-md transition-colors duration-150 ease-in-out"
              aria-label="Clock In"
            >
              <ArrowRightToLine className="mr-2 h-5 w-5" /> Clock In
            </Button>
            <Button
              onClick={handleClockOut}
              disabled={!name.trim() || !isCurrentUserClockedIn}
              size="lg"
              className="bg-accent hover:bg-accent/90 text-accent-foreground text-base py-3 h-12 rounded-md transition-colors duration-150 ease-in-out"
              aria-label="Clock Out"
            >
              <ArrowLeftToLine className="mr-2 h-5 w-5" /> Clock Out
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="w-full max-w-2xl shadow-xl rounded-xl">
        <CardContent className="pt-6">
          <TimeLogTable logs={todayLogs} />
        </CardContent>
      </Card>

      <Card className="w-full max-w-2xl shadow-xl rounded-xl">
        <CardHeader>
          <CardTitle className="text-xl sm:text-2xl font-semibold">Export &amp; Integrations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleExport}
            variant="outline"
            className="w-full"
          >
            <Download className="mr-2 h-5 w-5" /> Export to XLSX
          </Button>
          <div className="text-sm text-muted-foreground text-center p-4 border border-dashed rounded-md bg-secondary/30">
              <div className="flex items-center justify-center gap-2 mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline><path d="M15.5 22.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z"></path><path d="M15.5 17.5v-1.5a2 2 0 0 0-2-2h-6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h1.5"></path></svg>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-sky-500"><path d="M10.5 10.5C12.9853 10.5 15 8.48528 15 6C15 3.51472 12.9853 1.5 10.5 1.5C8.01472 1.5 6 3.51472 6 6C6 8.48528 8.01472 10.5 10.5 10.5Z"></path><path d="M10.5 10.5V22.5"></path><path d="M6 19.5C4.01472 19.5 1.5 17.6834 1.5 15.3636C1.5 13.0437 4.01472 11.2272 6 11.2272"></path><path d="M15 19.5C16.9853 19.5 19.5 17.6834 19.5 15.3636C19.5 13.0437 16.9853 11.2272 15 11.2272"></path><path d="M19.5 10.5C21.9853 10.5 22.5 8.48528 22.5 6C22.5 3.51472 21.9853 1.5 19.5 1.5"></path></svg>
              </div>
              SharePoint and OneDrive real-time sync coming soon!
              <br />
              This feature requires additional server-side setup and configuration.
          </div>
        </CardContent>
      </Card>

    </main>
  );
}

