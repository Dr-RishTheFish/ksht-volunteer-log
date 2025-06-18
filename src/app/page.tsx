
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
import { User, CalendarDays, ArrowRightToLine, ArrowLeftToLine } from 'lucide-react';

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

  return (
    <main className="min-h-screen bg-gradient-to-br from-background to-secondary/10 flex flex-col items-center justify-center p-4 sm:p-8 space-y-8 selection:bg-primary/20 selection:text-primary">
      <div className="text-center space-y-4 w-full max-w-2xl">
        <Image 
          src="/logo.png"
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
          <div className="inline-flex items-center gap-2 p-3 sm:p-4 rounded-lg shadow-md bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--accent))] text-primary-foreground font-semibold text-md sm:text-lg">
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
              className="bg-green-500 hover:bg-green-600 text-white text-base py-3 h-12 rounded-md transition-colors duration-150 ease-in-out"
              aria-label="Clock In"
            >
              <ArrowRightToLine className="mr-2 h-5 w-5" /> Clock In
            </Button>
            <Button
              onClick={handleClockOut}
              disabled={!name.trim() || !isCurrentUserClockedIn}
              size="lg"
              className="bg-pink-500 hover:bg-pink-600 text-white text-base py-3 h-12 rounded-md transition-colors duration-150 ease-in-out"
              aria-label="Clock Out"
            >
              <ArrowLeftToLine className="mr-2 h-5 w-5" /> Clock Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
