
"use client";

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import type { TimeLogEntry } from '@/interfaces/TimeLogEntry';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { User, CalendarDays, ArrowRightToLine, ArrowLeftToLine, Download, Trash2, LogOut, Building, Users, Loader2 } from 'lucide-react';
import { TimeLogTable } from '@/components/TimeLogTable';
import * as XLSX from 'xlsx';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

const ALL_EMPLOYEES_OPTION = "__ALL_EMPLOYEES__";

// Placeholder Organization Setup Components
function CreateOrganizationForm({ onOrganizationCreated }: { onOrganizationCreated: () => void }) {
  const [orgName, setOrgName] = useState('');
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) {
      toast({ title: 'Error', description: 'Organization name cannot be empty.', variant: 'destructive' });
      return;
    }
    // Placeholder: In a real app, you'd save this to Firestore
    console.log("Creating organization:", orgName);
    toast({ title: 'Success', description: `Organization "${orgName}" created (simulated).` });
    onOrganizationCreated();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="orgName">Organization Name</Label>
        <Input
          id="orgName"
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          placeholder="Your Company Inc."
          className="mt-1"
        />
      </div>
      <Button type="submit" className="w-full">Create Organization</Button>
    </form>
  );
}

function JoinOrganizationForm({ onOrganizationJoined }: { onOrganizationJoined: () => void }) {
  const [inviteCode, setInviteCode] = useState('');
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) {
      toast({ title: 'Error', description: 'Invite code cannot be empty.', variant: 'destructive' });
      return;
    }
    // Placeholder: In a real app, you'd validate this code and update user's org in Firestore
    console.log("Joining organization with code:", inviteCode);
    toast({ title: 'Success', description: `Joined organization with code "${inviteCode}" (simulated).` });
    onOrganizationJoined();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="inviteCode">Invite Code</Label>
        <Input
          id="inviteCode"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
          placeholder="Enter invite code"
          className="mt-1"
        />
      </div>
      <Button type="submit" className="w-full">Join Organization</Button>
    </form>
  );
}


export default function Home() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  const [name, setName] = useState<string>(''); // Employee name for clocking in/out
  const [timeLogs, setTimeLogs] = useState<TimeLogEntry[]>([]);
  const [currentDateTime, setCurrentDateTime] = useState<string>('');
  const { toast } = useToast();
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [selectedExportOption, setSelectedExportOption] = useState<string>(ALL_EMPLOYEES_OPTION);

  // Organization state: 'unknown', 'needsSetup', 'member'
  const [organizationStatus, setOrganizationStatus] = useState<'unknown' | 'needsSetup' | 'member'>('unknown');
  const [showCreateOrgForm, setShowCreateOrgForm] = useState(false);
  const [showJoinOrgForm, setShowJoinOrgForm] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    } else if (user && organizationStatus === 'unknown') {
      // Simulate checking if user belongs to an organization.
      // For now, assume every new login/signup needs setup.
      // In a real app, this would check Firestore for user.organizationId
      setOrganizationStatus('needsSetup');
    }
  }, [user, loading, router, organizationStatus]);
  
  useEffect(() => {
    if (user && organizationStatus === 'member') {
      // Load time logs if user is authenticated and part of an org
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
    }
  }, [user, organizationStatus]);

  useEffect(() => {
    if (organizationStatus === 'member') {
      localStorage.setItem('timeLogs', JSON.stringify(timeLogs));
    }
  }, [timeLogs, organizationStatus]);

  useEffect(() => {
    const updateDateTime = () => {
      setCurrentDateTime(format(new Date(), 'MM/dd/yyyy - hh:mm:ss a'));
    };
    updateDateTime();
    const timer = setInterval(updateDateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const isCurrentUserClockedIn = useMemo(() => {
    if (!name || organizationStatus !== 'member') return false;
    const todayDateStr = format(new Date(), 'yyyy-MM-dd');
    return timeLogs.some(log => log.name === name && log.clockOut === null && log.date === todayDateStr);
  }, [name, timeLogs, organizationStatus]);

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
    if (organizationStatus !== 'member') return [];
    const todayDateStr = format(new Date(), 'yyyy-MM-dd');
    return timeLogs
      .filter(log => log.date === todayDateStr)
      .sort((a,b) => b.clockIn.getTime() - a.clockIn.getTime());
  }, [timeLogs, organizationStatus]);

  const uniqueEmployeeNamesForExport = useMemo(() => {
    const names = new Set(todayLogs.map(log => log.name));
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [todayLogs]);


  const formatDurationForExport = (startTime: Date, endTime: Date | null): string => {
    if (!endTime) return 'In Progress';
    const durationMs = endTime.getTime() - startTime.getTime();
    if (durationMs < 0) return 'Invalid';
    let remainingMs = durationMs;
    const hours = Math.floor(remainingMs / (1000 * 60 * 60));
    remainingMs %= (1000 * 60 * 60);
    const minutes = Math.floor(remainingMs / (1000 * 60));
    remainingMs %= (1000 * 60);
    const seconds = Math.floor(remainingMs / 1000);
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  const handleExport = () => {
    let logsToProcess = todayLogs;
    let fileNamePart = "All_Employees";

    if (selectedExportOption !== ALL_EMPLOYEES_OPTION) {
      logsToProcess = todayLogs.filter(log => log.name === selectedExportOption);
      fileNamePart = selectedExportOption.replace(/\s+/g, '_');
    } else {
      logsToProcess = [...todayLogs].sort((a, b) => a.name.localeCompare(b.name));
    }

    if (logsToProcess.length === 0) {
      toast({
        title: "No Data",
        description: `There are no time entries for ${selectedExportOption === ALL_EMPLOYEES_OPTION ? 'today' : selectedExportOption} to export.`,
        variant: "destructive",
      });
      return;
    }

    const dataToExport = logsToProcess.map(log => ({
      'Employee Name': log.name,
      'Clock In': format(log.clockIn, 'yyyy-MM-dd HH:mm:ss'),
      'Clock Out': log.clockOut ? format(log.clockOut, 'yyyy-MM-dd HH:mm:ss') : '---',
      'Duration': formatDurationForExport(log.clockIn, log.clockOut),
      'Status': log.clockOut ? 'Completed' : 'In Progress',
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Time Logs');
    
    const todayDateFileName = format(new Date(), 'yyyy-MM-dd');
    XLSX.writeFile(workbook, `TimeLogs_${fileNamePart}_${todayDateFileName}.xlsx`);
    
    toast({
        title: "Export Successful",
        description: `Time entries for ${selectedExportOption === ALL_EMPLOYEES_OPTION ? 'all employees' : selectedExportOption} have been exported.`,
    });
  };

  const confirmClearEntries = () => {
    setTimeLogs([]);
    localStorage.removeItem('timeLogs');
    setIsClearConfirmOpen(false);
    toast({
      title: "Entries Cleared",
      description: "All time entries have been successfully cleared.",
    });
  };

  if (loading || (!user && organizationStatus === 'unknown')) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/10">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </main>
    );
  }

  if (!user) {
    // This case should ideally be handled by the useEffect redirect,
    // but as a fallback:
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p>Redirecting to login...</p>
      </main>
    );
  }
  
  const commonHeader = (
    <div className="text-center space-y-4 w-full max-w-2xl mb-8">
      <div className="flex justify-between items-center w-full">
        <Image
          src="/Stickers.png"
          alt="Big Brainbox Logo"
          width={80}
          height={80}
          className="rounded-full shadow-lg"
          data-ai-hint="logo company"
        />
        <Button onClick={logout} variant="outline" size="sm">
          <LogOut className="mr-2 h-4 w-4" /> Logout
        </Button>
      </div>
      <h1 className="text-4xl sm:text-5xl font-bold">
        <span className="bg-gradient-to-r from-primary to-accent text-transparent bg-clip-text">
          Big Brainbox Time Clock
        </span>
      </h1>
      {organizationStatus === 'member' && (
        <>
          <p className="text-lg sm:text-xl text-muted-foreground">
            Professional time tracking for your organization.
          </p>
          {currentDateTime && (
            <div className="inline-flex items-center gap-2 p-3 sm:p-4 rounded-lg shadow-md bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold text-md sm:text-lg">
              <CalendarDays className="h-5 w-5 sm:h-6 sm:w-6" />
              <span>{currentDateTime}</span>
            </div>
          )}
        </>
      )}
    </div>
  );

  if (organizationStatus === 'needsSetup') {
    return (
      <main className="min-h-screen bg-gradient-to-br from-background to-secondary/10 flex flex-col items-center p-4 sm:p-8 space-y-8 selection:bg-primary/20 selection:text-primary">
        {commonHeader}
        <Card className="w-full max-w-md shadow-xl rounded-xl">
          <CardHeader>
            <CardTitle className="text-xl sm:text-2xl font-semibold">Organization Setup</CardTitle>
            <CardDescription>
              {showCreateOrgForm || showJoinOrgForm 
                ? "Complete the form below." 
                : "You need to create or join an organization to use the time clock."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!showCreateOrgForm && !showJoinOrgForm && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Button onClick={() => { setShowCreateOrgForm(true); setShowJoinOrgForm(false); }} variant="default" size="lg">
                  <Building className="mr-2 h-5 w-5" /> Create Organization
                </Button>
                <Button onClick={() => { setShowJoinOrgForm(true); setShowCreateOrgForm(false); }} variant="outline" size="lg">
                  <Users className="mr-2 h-5 w-5" /> Join Organization
                </Button>
              </div>
            )}
            {showCreateOrgForm && (
              <>
                <CreateOrganizationForm onOrganizationCreated={() => setOrganizationStatus('member')} />
                <Button variant="link" onClick={() => { setShowCreateOrgForm(false);}} className="w-full">Back to options</Button>
              </>
            )}
            {showJoinOrgForm && (
              <>
                <JoinOrganizationForm onOrganizationJoined={() => setOrganizationStatus('member')} />
                <Button variant="link" onClick={() => { setShowJoinOrgForm(false);}} className="w-full">Back to options</Button>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    );
  }


  // organizationStatus === 'member'
  return (
    <main className="min-h-screen bg-gradient-to-br from-background to-secondary/10 flex flex-col items-center p-4 sm:p-8 space-y-8 selection:bg-primary/20 selection:text-primary">
      {commonHeader}

      <Card className="w-full max-w-md shadow-xl rounded-xl">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl font-semibold">
            <User className="h-6 w-6 text-primary" />
            Time Tracking Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="name" className="text-sm font-medium text-foreground/80">Employee Name (Your Name: {user?.displayName || user?.email})</Label>
            <Input
              id="name"
              type="text"
              placeholder="Enter your full name for this entry"
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
              className="text-base py-3 h-12 rounded-md transition-colors duration-150 ease-in-out bg-primary hover:bg-primary/90 text-primary-foreground"
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
          <CardTitle className="text-xl sm:text-2xl font-semibold">Export &amp; Data Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="export-select">Select Employee to Export</Label>
            <Select value={selectedExportOption} onValueChange={setSelectedExportOption}>
              <SelectTrigger id="export-select" className="w-full">
                <SelectValue placeholder="Select an option" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_EMPLOYEES_OPTION}>All Employees</SelectItem>
                {uniqueEmployeeNamesForExport.map(empName => (
                  <SelectItem key={empName} value={empName}>
                    {empName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleExport}
            variant="outline"
            className="w-full"
          >
            <Download className="mr-2 h-5 w-5" /> Export to XLSX
          </Button>

          <AlertDialog open={isClearConfirmOpen} onOpenChange={setIsClearConfirmOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full">
                <Trash2 className="mr-2 h-5 w-5" /> Clear All Entries (Local)
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete all
                  time log entries from your browser&apos;s local storage.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setIsClearConfirmOpen(false)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmClearEntries}>
                  Yes, clear entries
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="text-sm text-muted-foreground text-center p-4 border border-dashed rounded-md bg-secondary/30">
              <div className="flex items-center justify-center gap-2 mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline><path d="M15.5 22.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z"></path><path d="M15.5 17.5v-1.5a2 2 0 0 0-2-2h-6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h1.5"></path></svg>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-sky-500"><path d="M10.5 10.5C12.9853 10.5 15 8.48528 15 6C15 3.51472 12.9853 1.5 10.5 1.5C8.01472 1.5 6 3.51472 6 6C6 8.48528 8.01472 10.5 10.5 10.5Z"></path><path d="M10.5 10.5V22.5"></path><path d="M6 19.5C4.01472 19.5 1.5 17.6834 1.5 15.3636C1.5 13.0437 4.01472 11.2272 6 11.2272"></path><path d="M15 19.5C16.9853 19.5 19.5 17.6834 19.5 15.3636C19.5 13.0437 16.9853 11.2272 15 11.2272"></path><path d="M19.5 10.5C21.9853 10.5 22.5 8.48528 22.5 6C22.5 3.51472 21.9853 1.5 19.5 1.5"></path></svg>
              </div>
              SharePoint and OneDrive real-time sync coming soon!
              <br />
              This feature requires additional server-side setup and database integration.
          </div>
        </CardContent>
      </Card>

    </main>
  );
}
