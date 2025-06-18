
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
import { User, CalendarDays, ArrowRightToLine, ArrowLeftToLine, Download, Trash2, LogOut, Building, Users, Loader2, Info, Copy } from 'lucide-react';
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
import { createOrganizationWithInviteCode, joinOrganizationWithInviteCode, getUserOrganizationDetails } from '@/lib/firebase/firestoreService';
import type { Organization } from '@/interfaces/Organization';
import type { UserProfile } from '@/interfaces/User';


const ALL_EMPLOYEES_OPTION = "__ALL_EMPLOYEES__";

function CreateOrganizationForm({ 
  onOrganizationCreated, 
  onBack,
  userId 
}: { 
  onOrganizationCreated: (org: Organization, inviteCode: string) => void; 
  onBack: () => void; 
  userId: string;
}) {
  const [orgName, setOrgName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) {
      toast({ title: 'Error', description: 'Organization name cannot be empty.', variant: 'destructive' });
      return;
    }
    setIsCreating(true);
    try {
      const newOrg = await createOrganizationWithInviteCode(userId, orgName.trim());
      toast({ title: 'Success', description: `Organization "${newOrg.name}" created.` });
      onOrganizationCreated(newOrg, newOrg.inviteCode);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to create organization.', variant: 'destructive' });
    } finally {
      setIsCreating(false);
    }
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
          disabled={isCreating}
        />
      </div>
      <div className="flex flex-col space-y-2">
        <Button type="submit" className="w-full" disabled={isCreating}>
          {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {isCreating ? 'Creating...' : 'Create Organization'}
        </Button>
        <Button type="button" variant="link" onClick={onBack} className="w-full" disabled={isCreating}>
          Back to options
        </Button>
      </div>
    </form>
  );
}

function JoinOrganizationForm({ 
  onOrganizationJoined, 
  onBack,
  userId
}: { 
  onOrganizationJoined: (org: Organization) => void; 
  onBack: () => void; 
  userId: string;
}) {
  const [inviteCode, setInviteCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) {
      toast({ title: 'Error', description: 'Invite code cannot be empty.', variant: 'destructive' });
      return;
    }
    setIsJoining(true);
    try {
      const joinedOrg = await joinOrganizationWithInviteCode(userId, inviteCode.trim());
      if (joinedOrg) {
        toast({ title: 'Success', description: `Successfully joined "${joinedOrg.name}".` });
        onOrganizationJoined(joinedOrg);
      } else {
        toast({ title: 'Error', description: 'Invalid invite code or organization not found.', variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to join organization.', variant: 'destructive' });
    } finally {
      setIsJoining(false);
    }
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
          disabled={isJoining}
        />
      </div>
      <div className="flex flex-col space-y-2">
        <Button type="submit" className="w-full" disabled={isJoining}>
          {isJoining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {isJoining ? 'Joining...' : 'Join Organization'}
        </Button>
        <Button type="button" variant="link" onClick={onBack} className="w-full" disabled={isJoining}>
          Back to options
        </Button>
      </div>
    </form>
  );
}


export default function Home() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [name, setName] = useState<string>(''); 
  const [timeLogs, setTimeLogs] = useState<TimeLogEntry[]>([]);
  const [currentDateTime, setCurrentDateTime] = useState<string>('');
  const { toast } = useToast();
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [selectedExportOption, setSelectedExportOption] = useState<string>(ALL_EMPLOYEES_OPTION);

  const [organizationStatus, setOrganizationStatus] = useState<'unknown' | 'needsSetup' | 'member' | 'loading'>('loading');
  const [organizationDetails, setOrganizationDetails] = useState<Organization | null>(null);
  const [userRole, setUserRole] = useState<UserProfile['role']>(null);
  
  const [showCreateOrgForm, setShowCreateOrgForm] = useState(false);
  const [showJoinOrgForm, setShowJoinOrgForm] = useState(false);
  
  // This state is for the *initial prominent display* after creation.
  // The actual invite code for an owner will always be available in organizationDetails.inviteCode
  const [showInviteCodeCreatedCard, setShowInviteCodeCreatedCard] = useState(false);


  useEffect(() => {
    if (authLoading) {
      setOrganizationStatus('loading');
      return;
    }
    if (!user) {
      router.push('/login');
      return;
    }

    setOrganizationStatus('loading');
    getUserOrganizationDetails(user.uid)
      .then(orgData => {
        if (orgData) {
          setOrganizationDetails(orgData.organization);
          setUserRole(orgData.userRole);
          setOrganizationStatus('member');
          // If they are an owner, the invite code card logic will handle display using organizationDetails
        } else {
          setOrganizationStatus('needsSetup');
          setShowCreateOrgForm(false); // Ensure forms are reset if user has no org
          setShowJoinOrgForm(false);
        }
      })
      .catch(error => {
        console.error("Error fetching organization details:", error);
        toast({ title: 'Error', description: 'Could not fetch organization details. Please try refreshing.', variant: 'destructive'});
        setOrganizationStatus('needsSetup'); 
      });

  }, [user, authLoading, router, toast]);
  
  useEffect(() => {
    if (user && organizationStatus === 'member') {
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
      setName(user.displayName || user.email || '');
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

  const handleCopyInviteCode = () => {
    if (organizationDetails?.inviteCode) {
      navigator.clipboard.writeText(organizationDetails.inviteCode)
        .then(() => toast({ title: "Copied!", description: "Invite code copied to clipboard." }))
        .catch(() => toast({ title: "Error", description: "Could not copy invite code.", variant: "destructive" }));
    }
  };

  if (organizationStatus === 'loading' || authLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/10">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </main>
    );
  }

  if (!user) {
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
          src="https://placehold.co/80x80.png"
          alt="Big Brainbox Logo"
          width={80}
          height={80}
          className="rounded-full shadow-lg"
          data-ai-hint="logo sticker"
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
      {organizationStatus === 'member' && organizationDetails && (
        <>
          <p className="text-lg sm:text-xl text-muted-foreground">
            Organization: {organizationDetails.name} {userRole === 'owner' ? '(Owner)' : userRole === 'member' ? '(Member)' : ''}
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
                <Button onClick={() => { setShowCreateOrgForm(true); setShowJoinOrgForm(false); setShowInviteCodeCreatedCard(false);}} variant="default" size="lg">
                  <Building className="mr-2 h-5 w-5" /> Create Organization
                </Button>
                <Button onClick={() => { setShowJoinOrgForm(true); setShowCreateOrgForm(false); setShowInviteCodeCreatedCard(false);}} variant="outline" size="lg">
                  <Users className="mr-2 h-5 w-5" /> Join Organization
                </Button>
              </div>
            )}
            {showCreateOrgForm && user && (
              <CreateOrganizationForm
                userId={user.uid}
                onOrganizationCreated={(org, inviteCode) => {
                  setOrganizationDetails(org);
                  setUserRole('owner');
                  setOrganizationStatus('member');
                  setShowCreateOrgForm(false);
                  setShowInviteCodeCreatedCard(true); // Show the "created" card
                }}
                onBack={() => {setShowCreateOrgForm(false); setShowJoinOrgForm(false);}}
              />
            )}
            {showJoinOrgForm && user && (
              <JoinOrganizationForm
                userId={user.uid}
                onOrganizationJoined={(org) => {
                  setOrganizationDetails(org);
                  setUserRole('member'); // Role will be 'member' when joining
                  setOrganizationStatus('member');
                  setShowJoinOrgForm(false);
                  setShowInviteCodeCreatedCard(false);
                }}
                onBack={() => {setShowCreateOrgForm(false); setShowJoinOrgForm(false);}}
              />
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

      {userRole === 'owner' && organizationDetails?.inviteCode && (
        <Card className="w-full max-w-md shadow-xl rounded-xl bg-green-50 border-green-200 dark:bg-green-900/30 dark:border-green-700">
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl font-semibold text-green-700 dark:text-green-300 flex items-center gap-2">
              <Info className="h-5 w-5" /> 
              {showInviteCodeCreatedCard ? "Organization Created!" : "Your Organization's Invite Code"}
            </CardTitle>
            <CardDescription className="text-green-600 dark:text-green-400">
              Share this invite code with your team members to join "{organizationDetails.name}".
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <div className="p-3 bg-green-100 dark:bg-green-800/50 rounded-md inline-flex items-center gap-2">
              <Label htmlFor="inviteCodeDisplay" className="sr-only">Invite Code</Label>
              <Input 
                id="inviteCodeDisplay"
                type="text" 
                value={organizationDetails.inviteCode} 
                readOnly 
                className="text-2xl font-mono tracking-wider text-green-800 dark:text-green-200 bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 h-auto p-0" 
              />
              <Button variant="ghost" size="sm" onClick={handleCopyInviteCode} aria-label="Copy invite code">
                <Copy className="h-5 w-5 text-green-600 dark:text-green-400" />
              </Button>
            </div>
          </CardContent>
          {showInviteCodeCreatedCard && (
            <CardFooter>
               <Button variant="outline" size="sm" className="w-full" onClick={() => setShowInviteCodeCreatedCard(false)}>
                  Dismiss
               </Button>
            </CardFooter>
          )}
        </Card>
      )}


      <Card className="w-full max-w-md shadow-xl rounded-xl">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl font-semibold">
            <User className="h-6 w-6 text-primary" />
            Time Tracking Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="name" className="text-sm font-medium text-foreground/80">Your Name (for this entry)</Label>
            <Input
              id="name"
              type="text"
              placeholder="Enter your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 text-base py-3 px-4 h-12 rounded-md focus:border-primary focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground mt-1">Logged in as: {user?.email}</p>
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
