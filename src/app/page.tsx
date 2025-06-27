
"use client";

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { TimeLogEntry } from '@/interfaces/TimeLogEntry';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { User, CalendarDays, ArrowRightToLine, ArrowLeftToLine, Download, Trash2, LogOut, Loader2, Edit3, Calendar as CalendarIcon } from 'lucide-react';
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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

const ALL_VOLUNTEERS_OPTION = "__ALL_VOLUNTEERS__";

const MOCK_MEMBERS = [
    { uid: 'mockuser1', displayName: 'Volunteer One', email: 'one@test.com' },
    { uid: 'mockuser2', displayName: 'Volunteer Two', email: 'two@test.com' },
    { uid: 'mockuser3', displayName: 'Volunteer Three', email: 'three@test.com' },
];

export default function Home() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [currentUserName, setCurrentUserName] = useState<string>('');
  const [timeLogs, setTimeLogs] = useState<TimeLogEntry[]>([]);
  const [currentDateTime, setCurrentDateTime] = useState<string>('');
  const { toast } = useToast();
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [selectedExportOption, setSelectedExportOption] = useState<string>(ALL_VOLUNTEERS_OPTION);
  
  // Hardcoded values for local testing without a database
  const organizationName = "KSHT";
  const userRole = 'owner'; // Assume 'owner' role to show all features

  const [manualSelectedVolunteerId, setManualSelectedVolunteerId] = useState<string>('');
  const [manualDate, setManualDate] = useState<Date | undefined>(new Date());
  const [manualClockInTime, setManualClockInTime] = useState<string>(''); // HH:mm
  const [manualClockOutTime, setManualClockOutTime] = useState<string>(''); // HH:mm
  const [manualNote, setManualNote] = useState<string>('');
  const [isAddingManualEntry, setIsAddingManualEntry] = useState(false);

  const [displayDate, setDisplayDate] = useState<Date>(new Date());

  // Effect for handling auth state
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    setCurrentUserName(user.displayName || user.email?.split('@')[0] || 'User');
  }, [user, authLoading, router]);

  // Effect for loading logs from localStorage on mount
  useEffect(() => {
    const storageKey = 'timeLogs_ksht';
    const storedLogs = localStorage.getItem(storageKey);
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
        console.error(`Failed to parse logs from localStorage (key: ${storageKey})`, error);
        localStorage.removeItem(storageKey);
      }
    }
  }, []);

  // Effect for saving logs to localStorage
  useEffect(() => {
    const storageKey = 'timeLogs_ksht';
    localStorage.setItem(storageKey, JSON.stringify(timeLogs));
  }, [timeLogs]);

  // Effect for updating current date/time display
  useEffect(() => {
    const updateDateTime = () => {
      setCurrentDateTime(format(new Date(), 'MM/dd/yyyy - hh:mm:ss a'));
    };
    updateDateTime();
    const timer = setInterval(updateDateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Effect to pre-select a volunteer for the manual entry form
  useEffect(() => {
      if (MOCK_MEMBERS.length > 0) {
          setManualSelectedVolunteerId(MOCK_MEMBERS[0].uid);
      }
  }, []);


  const isCurrentUserClockedIn = useMemo(() => {
    if (!currentUserName) return false;
    const todayDateStr = format(new Date(), 'yyyy-MM-dd'); 
    return timeLogs.some(log => log.name === currentUserName && log.clockOut === null && log.date === todayDateStr);
  }, [currentUserName, timeLogs]);

  const handleClockIn = () => {
    if (!currentUserName.trim()) return;
    if (isCurrentUserClockedIn) {
      toast({ title: 'Error', description: `${currentUserName} is already clocked in.`, variant: 'destructive' });
      return;
    }
    const newLog: TimeLogEntry = {
      id: crypto.randomUUID(),
      name: currentUserName.trim(),
      clockIn: new Date(),
      clockOut: null,
      date: format(new Date(), 'yyyy-MM-dd'), 
    };
    setTimeLogs(prevLogs => [...prevLogs, newLog]);
  };

  const handleClockOut = () => {
    if (!currentUserName.trim()) return;
    if (!isCurrentUserClockedIn) {
      toast({ title: 'Error', description: `${currentUserName} is not clocked in.`, variant: 'destructive' });
      return;
    }
    setTimeLogs(prevLogs => {
      const newLogs = [...prevLogs];
      const todayDateStr = format(new Date(), 'yyyy-MM-dd'); 
      const logIndex = newLogs.findLastIndex(
        (log) => log.name === currentUserName.trim() && log.clockOut === null && log.date === todayDateStr
      );
      if (logIndex !== -1) {
        newLogs[logIndex] = { ...newLogs[logIndex], clockOut: new Date() };
        return newLogs;
      }
      toast({ title: 'Error', description: 'Could not find active clock-in.', variant: 'destructive' });
      return prevLogs;
    });
  };
  
  const displayedDateLogs = useMemo(() => {
    const selectedDateStr = format(displayDate, 'yyyy-MM-dd');
    let logsToDisplay = timeLogs.filter(log => log.date === selectedDateStr);
    if (userRole === 'member' && currentUserName) {
      logsToDisplay = logsToDisplay.filter(log => log.name === currentUserName);
    }
    return logsToDisplay.sort((a,b) => b.clockIn.getTime() - a.clockIn.getTime());
  }, [timeLogs, userRole, currentUserName, displayDate]);

  const uniqueVolunteerNamesForExport = useMemo(() => {
    const logsForSelectedDate = timeLogs.filter(log => log.date === format(displayDate, 'yyyy-MM-dd'));
    if (userRole === 'owner') {
      const names = new Set(logsForSelectedDate.map(log => log.name));
      return Array.from(names).sort((a, b) => a.localeCompare(b));
    }
    if (currentUserName && logsForSelectedDate.some(log => log.name === currentUserName)) {
      return [currentUserName];
    }
    return [];
  }, [timeLogs, userRole, currentUserName, displayDate]);

  const formatDurationForExport = (startTime: Date, endTime: Date | null): string => {
    if (!endTime) return 'In Progress';
    const durationMs = endTime.getTime() - startTime.getTime();
    if (durationMs < 0) return 'Invalid';
    const hours = Math.floor(durationMs / (3600 * 1000));
    const minutes = Math.floor((durationMs % (3600 * 1000)) / (60 * 1000));
    const seconds = Math.floor((durationMs % (60 * 1000)) / 1000);
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  const handleExport = () => {
    let logsToExport: TimeLogEntry[];
    let fileNamePart: string;
    const selectedDateStr = format(displayDate, 'yyyy-MM-dd');
    const logsForSelectedDate = timeLogs.filter(log => log.date === selectedDateStr);

    if (userRole === 'member' && currentUserName) {
        logsToExport = logsForSelectedDate.filter(log => log.name === currentUserName);
        fileNamePart = currentUserName.replace(/\s+/g, '_');
    } else if (userRole === 'owner') {
        if (selectedExportOption === ALL_VOLUNTEERS_OPTION) {
            logsToExport = [...logsForSelectedDate].sort((a, b) => a.name.localeCompare(b.name));
            fileNamePart = "All_Volunteers";
        } else {
            logsToExport = logsForSelectedDate.filter(log => log.name === selectedExportOption);
            fileNamePart = selectedExportOption.replace(/\s+/g, '_');
        }
    } else {
        toast({ title: "Error", description: "Cannot determine export scope.", variant: "destructive" });
        return;
    }
    if (logsToExport.length === 0) {
        const forWhom = userRole === 'member' ? currentUserName : (selectedExportOption === ALL_VOLUNTEERS_OPTION ? `entries for ${organizationName} on ${selectedDateStr}` : selectedExportOption);
        toast({ title: "No Data", description: `There are no volunteer entries for ${forWhom} to export for ${selectedDateStr}.`, variant: "destructive" });
        return;
    }
    const dataToExport = logsToExport.map(log => ({
      'Volunteer Name': log.name,
      'Clock In': format(log.clockIn, 'yyyy-MM-dd HH:mm:ss'),
      'Clock Out': log.clockOut ? format(log.clockOut, 'yyyy-MM-dd HH:mm:ss') : '---',
      'Duration': formatDurationForExport(log.clockIn, log.clockOut),
      'Status': log.clockOut ? 'Completed' : 'In Progress',
      'Note': log.note || '',
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Volunteer Logs');
    
    XLSX.writeFile(workbook, `VolunteerLogs_${fileNamePart}_${organizationName.replace(/\s+/g, '_')}_${selectedDateStr}.xlsx`);
    toast({ title: "Export Successful", description: `Volunteer entries for ${fileNamePart} on ${selectedDateStr} exported.` });
  };

  const confirmClearEntries = () => {
    let clearedCount = 0;
    const selectedDateStr = format(displayDate, 'yyyy-MM-dd');
    if (userRole === 'member' && currentUserName) {
      const userLogsForSelectedDate = timeLogs.filter(log => log.name === currentUserName && log.date === selectedDateStr);
      clearedCount = userLogsForSelectedDate.length;
      setTimeLogs(prevLogs => prevLogs.filter(log => !(log.name === currentUserName && log.date === selectedDateStr)));
      if (clearedCount > 0) {
        toast({ title: "Entries Cleared", description: `Your ${clearedCount} volunteer entr${clearedCount === 1 ? 'y' : 'ies'} for ${selectedDateStr} in ${organizationName} have been cleared.` });
      } else {
        toast({ title: "No Entries", description: `You had no volunteer entries for ${selectedDateStr} in ${organizationName} to clear.` });
      }
    } else if (userRole === 'owner') {
      const logsForSelectedDateInOrg = timeLogs.filter(log => log.date === selectedDateStr);
      clearedCount = logsForSelectedDateInOrg.length;
      setTimeLogs(prevLogs => prevLogs.filter(log => log.date !== selectedDateStr)); 
      if (clearedCount > 0) {
        toast({ title: "All Entries Cleared", description: `All ${clearedCount} volunteer entr${clearedCount === 1 ? 'y' : 'ies'} for ${selectedDateStr} in ${organizationName} have been cleared.` });
      } else {
        toast({ title: "No Entries", description: `There were no volunteer entries for ${selectedDateStr} in ${organizationName} to clear.` });
      }
    }
    setIsClearConfirmOpen(false);
  };

  const handleAddManualTimeEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAddingManualEntry(true);

    if (!manualSelectedVolunteerId || !manualDate || !manualClockInTime) {
      toast({ title: "Missing Information", description: "Please select a volunteer, date, and clock-in time.", variant: "destructive" });
      setIsAddingManualEntry(false);
      return;
    }

    const selectedVolunteer = MOCK_MEMBERS.find(mem => mem.uid === manualSelectedVolunteerId);
    if (!selectedVolunteer) {
      toast({ title: "Error", description: "Selected volunteer not found.", variant: "destructive" });
      setIsAddingManualEntry(false);
      return;
    }

    try {
      const dateStr = format(manualDate, 'yyyy-MM-dd');
      
      const [inHours, inMinutes] = manualClockInTime.split(':').map(Number);
      const clockInDateTime = new Date(manualDate);
      clockInDateTime.setHours(inHours, inMinutes, 0, 0);

      let clockOutDateTime: Date | null = null;
      if (manualClockOutTime) {
        const [outHours, outMinutes] = manualClockOutTime.split(':').map(Number);
        clockOutDateTime = new Date(manualDate);
        clockOutDateTime.setHours(outHours, outMinutes, 0, 0);

        if (clockOutDateTime <= clockInDateTime) {
          toast({ title: "Invalid Time", description: "Clock-out time must be after clock-in time.", variant: "destructive" });
          setIsAddingManualEntry(false);
          return;
        }
      }
      
      const newLog: TimeLogEntry = {
        id: crypto.randomUUID(),
        name: selectedVolunteer.displayName,
        clockIn: clockInDateTime,
        clockOut: clockOutDateTime,
        date: dateStr,
        note: manualNote.trim() || undefined,
      };

      setTimeLogs(prevLogs => [...prevLogs, newLog].sort((a,b) => b.clockIn.getTime() - a.clockIn.getTime()));
      toast({ title: "Manual Entry Added", description: `Volunteer log added for ${selectedVolunteer.displayName} on ${dateStr}.` });

      setManualClockInTime('');
      setManualClockOutTime('');
      setManualNote('');
    } catch (error) {
      console.error("Error processing manual volunteer entry:", error);
      toast({ title: "Error Adding Entry", description: "Could not add manual volunteer entry.", variant: "destructive"});
    } finally {
      setIsAddingManualEntry(false);
    }
  };

  const exportDisabled = useMemo(() => {
    if (userRole === 'member') {
      return displayedDateLogs.filter(log => log.name === currentUserName).length === 0;
    } else if (userRole === 'owner') {
      if (selectedExportOption === ALL_VOLUNTEERS_OPTION) {
        return displayedDateLogs.length === 0;
      } else {
        return displayedDateLogs.filter(log => log.name === selectedExportOption).length === 0;
      }
    }
    return true; 
  }, [userRole, displayedDateLogs, currentUserName, selectedExportOption]);

  const clearDisabled = useMemo(() => {
     if (userRole === 'member') {
      return displayedDateLogs.filter(log => log.name === currentUserName).length === 0;
    } else if (userRole === 'owner') {
      return displayedDateLogs.length === 0;
    }
    return true;
  }, [userRole, displayedDateLogs, currentUserName]);

  if (authLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/10">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </main>
    );
  }

  if (!user) {
    return <main className="min-h-screen flex items-center justify-center"><p>Redirecting to login...</p></main>;
  }
  
  const commonHeader = (
    <div className="text-center space-y-4 w-full max-w-2xl mb-8">
      <div className="flex justify-between items-center w-full">
        <Image 
          src="/logo.png" 
          alt="KSHT Logo" 
          width={80} 
          height={80} 
          className="rounded-full shadow-lg" 
          data-ai-hint="temple logo"
          priority
        />
        <Button onClick={logout} variant="outline" size="sm"><LogOut className="mr-2 h-4 w-4" /> Logout</Button>
      </div>
      <h1 className="text-4xl sm:text-5xl font-bold">
        <span className="bg-gradient-to-r from-primary to-accent text-transparent bg-clip-text">KSHT Volunteer Log</span>
      </h1>
        <>
          <p className="text-lg sm:text-xl text-muted-foreground">Organization: {organizationName} ({currentUserName || 'User'} - {userRole === 'owner' ? 'Owner' : 'Member'})</p>
          {currentDateTime && ( <div className="inline-flex items-center gap-2 p-3 sm:p-4 rounded-lg shadow-md bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold text-md sm:text-lg"><CalendarDays className="mr-2 h-5 w-5 sm:h-6 sm:w-6" /><span>{currentDateTime}</span></div> )}
        </>
    </div>
  );

  return (
    <main className="min-h-screen bg-gradient-to-br from-background to-secondary/10 flex flex-col items-center p-4 sm:p-8 space-y-8 selection:bg-primary/20 selection:text-primary">
      {commonHeader}

      <Card className="w-full max-w-md shadow-xl rounded-xl">
        <CardHeader className="pb-4"><CardTitle className="flex items-center gap-2 text-xl sm:text-2xl font-semibold"><User className="mr-2 h-6 w-6 text-primary" />Volunteer Logging</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="name" className="text-sm font-medium text-foreground/80">Your Name (for new entries)</Label>
            <Input id="name" type="text" placeholder="Your name for clock-in" value={currentUserName || ''} readOnly className="mt-1 text-base py-3 px-4 h-12 rounded-md focus:border-primary focus:ring-primary bg-muted/50 cursor-not-allowed"/>
            <p className="text-xs text-muted-foreground mt-1">Logged in as: {user?.email}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Button onClick={handleClockIn} disabled={!currentUserName.trim() || isCurrentUserClockedIn} size="lg" className="text-base py-3 h-12 rounded-md"><ArrowRightToLine className="mr-2 h-5 w-5" /> Clock In</Button>
            <Button onClick={handleClockOut} disabled={!currentUserName.trim() || !isCurrentUserClockedIn} size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground text-base py-3 h-12 rounded-md"><ArrowLeftToLine className="mr-2 h-5 w-5" /> Clock Out</Button>
          </div>
        </CardContent>
      </Card>

      {userRole === 'owner' && (
        <Card className="w-full max-w-2xl shadow-xl rounded-xl">
          <CardHeader>
            <CardTitle className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
              <Edit3 className="h-6 w-6 text-primary" /> Manual Volunteer Log Adjustment
            </CardTitle>
            <CardDescription>Manually add or adjust volunteer entries for members in "{organizationName}".</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddManualTimeEntry} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="manualVolunteerSelect">Volunteer</Label>
                  <Select 
                    value={manualSelectedVolunteerId} 
                    onValueChange={setManualSelectedVolunteerId}
                    disabled={MOCK_MEMBERS.length === 0 || isAddingManualEntry}
                  >
                    <SelectTrigger id="manualVolunteerSelect">
                      <SelectValue placeholder="Select volunteer" />
                    </SelectTrigger>
                    <SelectContent>
                      {MOCK_MEMBERS.length > 0 ? MOCK_MEMBERS.map(member => (
                        <SelectItem key={member.uid} value={member.uid}>
                          {member.displayName} ({member.email})
                        </SelectItem>
                      )) : <SelectItem value="-" disabled>No members found</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manualDate">Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="manualDate"
                        variant={"outline"}
                        className="w-full justify-start text-left font-normal h-10"
                        disabled={isAddingManualEntry}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {manualDate ? format(manualDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={manualDate}
                        onSelect={setManualDate}
                        initialFocus
                        disabled={(date) => date > new Date() || date < new Date("2000-01-01")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="manualClockInTime">Clock In Time</Label>
                  <Input 
                    id="manualClockInTime" 
                    type="time" 
                    value={manualClockInTime} 
                    onChange={(e) => setManualClockInTime(e.target.value)} 
                    required 
                    disabled={isAddingManualEntry}
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manualClockOutTime">Clock Out Time (Optional)</Label>
                  <Input 
                    id="manualClockOutTime" 
                    type="time" 
                    value={manualClockOutTime} 
                    onChange={(e) => setManualClockOutTime(e.target.value)} 
                    disabled={isAddingManualEntry}
                    className="h-10"
                  />
                </div>
              </div>
               <div className="space-y-2">
                <Label htmlFor="manualNote">Note (Optional)</Label>
                <Textarea
                  id="manualNote"
                  placeholder="Reason for manual entry, task details, etc."
                  value={manualNote}
                  onChange={(e) => setManualNote(e.target.value)}
                  disabled={isAddingManualEntry}
                  rows={3}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isAddingManualEntry || !manualSelectedVolunteerId || !manualDate || !manualClockInTime}>
                {isAddingManualEntry ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isAddingManualEntry ? 'Adding Entry...' : 'Add Manual Entry'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="w-full max-w-2xl shadow-xl rounded-xl">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-xl sm:text-2xl font-semibold">Volunteer Entries for {format(displayDate, "PPP")}</CardTitle>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className="w-auto justify-start text-left font-normal"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                <span>Change Date</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={displayDate}
                onSelect={(date) => {if (date) setDisplayDate(date);}}
                disabled={(date) => date > new Date() || date < new Date("2000-01-01")}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </CardHeader>
        <CardContent className="pt-0">
            <TimeLogTable logs={displayedDateLogs} currentUserName={currentUserName} userRole={userRole} displayDate={displayDate} />
        </CardContent>
      </Card>

      <Card className="w-full max-w-2xl shadow-xl rounded-xl">
        <CardHeader><CardTitle className="text-xl sm:text-2xl font-semibold">Export &amp; Data Management for {format(displayDate, "PPP")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {userRole === 'owner' && (
            <div className="space-y-2">
              <Label htmlFor="export-select">Select Volunteer to Export ({organizationName} - {format(displayDate, "PPP")})</Label>
              <Select value={selectedExportOption} onValueChange={setSelectedExportOption}>
                <SelectTrigger id="export-select" className="w-full">
                  <SelectValue placeholder="Select an option" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VOLUNTEERS_OPTION}>All Volunteers</SelectItem>
                  {uniqueVolunteerNamesForExport.length > 0 ? uniqueVolunteerNamesForExport.map(empName => (
                    <SelectItem key={empName} value={empName}>
                      {empName}
                    </SelectItem>
                  )) : <SelectItem value="no_entries" disabled>No entries on this date</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          )}
          {userRole === 'member' && ( <p className="text-sm text-muted-foreground">You can export your own volunteer entries for {organizationName} on {format(displayDate, "PPP")}.</p> )}
          <Button onClick={handleExport} variant="outline" className="w-full" disabled={exportDisabled}>
            <Download className="mr-2 h-5 w-5" /> Export to XLSX {userRole === 'member' ? `(My Entries)` : ''}
          </Button>
          <AlertDialog open={isClearConfirmOpen} onOpenChange={setIsClearConfirmOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full" disabled={clearDisabled}>
                <Trash2 className="mr-2 h-5 w-5" /> Clear {userRole === 'member' ? `My Entries for ${format(displayDate, "PPP")}` : `All Entries for ${format(displayDate, "PPP")}`} (Org: {organizationName})
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete 
                  {userRole === 'member' ? ` your volunteer log entries for ${format(displayDate, "PPP")} in "${organizationName}"` : ` all volunteer log entries for ${format(displayDate, "PPP")} in "${organizationName}"`}
                  from your browser&apos;s local storage.
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
