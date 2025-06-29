
"use client";

import { useState, useEffect, useMemo, Suspense } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import type { TimeLogEntry } from '@/interfaces/TimeLogEntry';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { User, CalendarDays, ArrowRightToLine, ArrowLeftToLine, Download, Trash2, Loader2, Edit3, Calendar as CalendarIcon, LogOut, Building, Users, Info, Copy, MoreVertical, PlusCircle, ArrowLeft } from 'lucide-react';
import { TimeLogTable } from '@/components/TimeLogTable';
import * as XLSX from 'xlsx';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { createOrganization, getUserAssociatedOrganizations, deleteOrganization, getOrganizationMembers, joinOrganization } from '@/lib/firebase/firestoreService';
import type { Organization } from '@/interfaces/Organization';
import type { UserProfile } from '@/interfaces/User';

function OrganizationHub() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [componentState, setComponentState] = useState<'loading' | 'orgSelection' | 'memberView'>('loading');
  const [orgSelectionSubView, setOrgSelectionSubView] = useState<'list' | 'createForm' | 'joinForm'>('list');
  
  const [userAssociatedOrgs, setUserAssociatedOrgs] = useState<Organization[]>([]);
  const [isLoadingUserAssociatedOrgs, setIsLoadingUserAssociatedOrgs] = useState(true);

  const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null);
  const [userRoleInSelectedOrg, setUserRoleInSelectedOrg] = useState<'owner' | 'member' | null>(null);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [orgToDelete, setOrgToDelete] = useState<Organization | null>(null);
  
  const [timeLogs, setTimeLogs] = useState<TimeLogEntry[]>([]);
  const [currentDateTime, setCurrentDateTime] = useState<string>('');
  
  const [manualSelectedVolunteerId, setManualSelectedVolunteerId] = useState<string>('');
  const [manualDate, setManualDate] = useState<Date | undefined>();
  const [manualClockInTime, setManualClockInTime] = useState<string>('');
  const [manualClockOutTime, setManualClockOutTime] = useState<string>('');
  const [manualNote, setManualNote] = useState<string>('');
  const [isAddingManualEntry, setIsAddingManualEntry] = useState(false);
  const [organizationMembers, setOrganizationMembers] = useState<UserProfile[]>([]);

  const [displayDate, setDisplayDate] = useState<Date | undefined>();
  const [selectedExportOption, setSelectedExportOption] = useState<string>("__ALL_VOLUNTEERS__");
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  
  const [newOrgName, setNewOrgName] = useState('');
  const [joinInviteCode, setJoinInviteCode] = useState('');
  const [isSubmittingOrgAction, setIsSubmittingOrgAction] = useState(false);


  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
    } else {
      setComponentState('orgSelection');
    }
  }, [user, authLoading, router]);

  const fetchUserOrgs = async () => {
    if (!user) return;
    setIsLoadingUserAssociatedOrgs(true);
    try {
        const orgs = await getUserAssociatedOrganizations(user.uid);
        setUserAssociatedOrgs(orgs);
    } catch (error) {
        console.error("Error fetching user organizations:", error);
        toast({ title: "Error", description: "Could not fetch your organizations.", variant: "destructive" });
    } finally {
        setIsLoadingUserAssociatedOrgs(false);
    }
  };

  useEffect(() => {
    if (componentState === 'orgSelection' && user) {
      fetchUserOrgs();
    }
  }, [componentState, user]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    const fetchOrgDetails = async () => {
      if (selectedOrganization && userRoleInSelectedOrg === 'owner') {
        try {
          // Assuming getOrganizationDetails fetches the full organization object including inviteCode
          // This function needs to be implemented or retrieved from firestoreService.ts
          // For now, we'll just update the selectedOrganization state with itself to trigger re-render if needed
          // If getOrganizationDetails is implemented and updates the inviteCode, the state will reflect it.
           const updatedOrg = await getOrganizationDetails(selectedOrganization.id);
           setSelectedOrganization(updatedOrg);
        } catch (error) {
          console.error("Error fetching organization details:", error);
        }
      }
    };
    if (selectedOrganization && userRoleInSelectedOrg === 'owner') {
      intervalId = setInterval(fetchOrgDetails, 30000); // Refresh every 30 seconds
    }
    const timer = setInterval(() => setCurrentDateTime(format(new Date(), 'MM/dd/yyyy - hh:mm:ss a')), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (selectedOrganization && userRoleInSelectedOrg === 'owner') {
      getOrganizationMembers(selectedOrganization.id)
        .then(members => {
          setOrganizationMembers(members);
          if (members.length > 0) {
            setManualSelectedVolunteerId(members[0].uid);
          }
        })
        .catch(err => {
          console.error("Failed to fetch org members:", err);
          toast({ title: "Error", description: "Could not load organization members.", variant: "destructive" });
        });
    }
  }, [selectedOrganization, userRoleInSelectedOrg, toast]);

  useEffect(() => {
    if (!selectedOrganization) {
      setTimeLogs([]);
      return;
    }
    const storageKey = `timeLogs_${selectedOrganization.id}`;
    const storedLogs = localStorage.getItem(storageKey);
    if (storedLogs) {
      try {
        const parsedLogs = JSON.parse(storedLogs, (key, value) => {
          if (key === 'clockIn' || key === 'clockOut') return value ? new Date(value) : null;
          return value;
        });
        setTimeLogs(parsedLogs);
      } catch (error) {
        console.error(`Failed to parse logs from localStorage (key: ${storageKey})`, error);
        localStorage.removeItem(storageKey);
      }
    } else {
      setTimeLogs([]);
    }
  }, [selectedOrganization]);

  useEffect(() => {
    if (selectedOrganization) {
      const storageKey = `timeLogs_${selectedOrganization.id}`;
      localStorage.setItem(storageKey, JSON.stringify(timeLogs));
    }
  }, [timeLogs, selectedOrganization]);

  useEffect(() => {
    const today = new Date();
    setDisplayDate(today);
    setManualDate(today);
  }, []);

  const handleSelectOrganization = (org: Organization) => {
    setSelectedOrganization(org);
    const role = org.ownerUid === user?.uid ? 'owner' : 'member';
    setUserRoleInSelectedOrg(role);
    setComponentState('memberView');
  };

  const handleCopyInviteLink = (inviteCode: string) => {
    const url = `${window.location.origin}/signup?inviteCode=${inviteCode}`;
    navigator.clipboard.writeText(url)
      .then(() => toast({ title: "Copied!", description: "Invite link copied to clipboard." }))
      .catch((error) => {
 console.error("Error copying invite link:", error); // Log the error object
 toast({ title: "Error", description: "Could not copy invite link.", variant: "destructive" });
 });
  };

  const handleDeleteOrgClick = (org: Organization) => {
    setOrgToDelete(org);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteOrganization = async () => {
    if (!orgToDelete || !user) return;
    try {
      await deleteOrganization(orgToDelete.id);
      toast({ title: "Success", description: `Organization "${orgToDelete.name}" has been deleted.` });
      setUserAssociatedOrgs(prev => prev.filter(o => o.id !== orgToDelete.id));
    } catch (error) {
      console.error("Error deleting organization:", error);
      toast({ title: "Error", description: "Failed to delete organization.", variant: "destructive" });
    } finally {
      setIsDeleteDialogOpen(false);
      setOrgToDelete(null);
    }
  };
  
  const handleReturnToHub = () => {
    setComponentState('orgSelection');
    setSelectedOrganization(null);
    setUserRoleInSelectedOrg(null);
    setTimeLogs([]);
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newOrgName.trim()) {
        toast({ title: 'Error', description: 'Organization name cannot be empty.', variant: 'destructive' });
        return;
    }
    setIsSubmittingOrgAction(true);
    try {
        await createOrganization(user.uid, newOrgName.trim());
        toast({ title: "Success", description: "Organization created successfully." });
        await fetchUserOrgs();
        setNewOrgName('');
        setOrgSelectionSubView('list');
    } catch (error) {
        toast({ title: "Error", description: "Failed to create organization.", variant: "destructive" });
    } finally {
        setIsSubmittingOrgAction(false);
    }
  };
  
  const handleJoinOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !joinInviteCode.trim()) {
        toast({ title: 'Error', description: 'Invite code cannot be empty.', variant: 'destructive' });
        return;
    }
    setIsSubmittingOrgAction(true);
    try {
        const joinedOrg = await joinOrganization(user.uid, joinInviteCode.trim());
        if (joinedOrg) {
            toast({ title: "Success", description: `Successfully joined "${joinedOrg.name}".` });
            await fetchUserOrgs();
            setJoinInviteCode('');
            setOrgSelectionSubView('list');
        } else {
            toast({ title: "Error", description: "Invalid invite code or already a member.", variant: "destructive" });
        }
    } catch (error) {
        toast({ title: "Error", description: "Failed to join organization.", variant: "destructive" });
    } finally {
        setIsSubmittingOrgAction(false);
    }
  };

  const currentUserName = user?.displayName || user?.email || 'Current User';

  const isCurrentUserClockedIn = useMemo(() => {
    if (!currentUserName) return false;
    const todayDateStr = format(new Date(), 'yyyy-MM-dd');
    return timeLogs.some(log => log.name === currentUserName && log.clockOut === null && log.date === todayDateStr);
  }, [currentUserName, timeLogs]);

  const handleClockIn = () => {
    const newLog: TimeLogEntry = { id: crypto.randomUUID(), name: currentUserName, clockIn: new Date(), clockOut: null, date: format(new Date(), 'yyyy-MM-dd') };
    setTimeLogs(prev => [...prev, newLog]);
  };

  const handleClockOut = () => {
    setTimeLogs(prev => {
      const newLogs = [...prev];
      const logIndex = newLogs.findLastIndex(log => log.name === currentUserName && log.clockOut === null);
      if (logIndex !== -1) {
        newLogs[logIndex] = { ...newLogs[logIndex], clockOut: new Date() };
        return newLogs;
      }
      return prev;
    });
  };

  const handleAddManualTimeEntry = (e: React.FormEvent) => {
    e.preventDefault();
    setIsAddingManualEntry(true);
    const selectedVolunteer = organizationMembers.find(m => m.uid === manualSelectedVolunteerId);
    if (!selectedVolunteer || !manualDate || !manualClockInTime) {
        toast({ title: "Missing Information", description: "Please select a volunteer, date, and clock-in time.", variant: "destructive" });
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
        const newLog: TimeLogEntry = { id: crypto.randomUUID(), name: selectedVolunteer.displayName, clockIn: clockInDateTime, clockOut: clockOutDateTime, date: dateStr, note: manualNote.trim() || undefined };
        setTimeLogs(prev => [...prev, newLog]);
        toast({ title: "Manual Entry Added", description: `Log added for ${selectedVolunteer.displayName}.` });
        setManualClockInTime('');
        setManualClockOutTime('');
        setManualNote('');
    } catch (error) {
        console.error("Error adding manual entry:", error);
        toast({ title: "Error", description: "Could not add manual entry.", variant: "destructive" });
    } finally {
        setIsAddingManualEntry(false);
    }
  };

  const displayedDateLogs = useMemo(() => {
    if (!displayDate) return [];
    const selectedDateStr = format(displayDate, 'yyyy-MM-dd');
    let logs = timeLogs.filter(log => log.date === selectedDateStr);
    if (userRoleInSelectedOrg === 'member') {
      logs = logs.filter(log => log.name === currentUserName);
    }
    return logs.sort((a,b) => b.clockIn.getTime() - a.clockIn.getTime());
  }, [timeLogs, displayDate, userRoleInSelectedOrg, currentUserName]);

  const uniqueVolunteerNamesForExport = useMemo(() => {
    if (!displayDate) return [];
    const logsForSelectedDate = timeLogs.filter(log => log.date === format(displayDate, 'yyyy-MM-dd'));
    const names = new Set(logsForSelectedDate.map(log => log.name));
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [timeLogs, displayDate]);

  const handleExport = () => {
    if (!displayDate) return;
    const selectedDateStr = format(displayDate, 'yyyy-MM-dd');
    let logsToExport = timeLogs.filter(log => log.date === selectedDateStr);
    if (userRoleInSelectedOrg === 'owner' && selectedExportOption !== '__ALL_VOLUNTEERS__') {
        logsToExport = logsToExport.filter(log => log.name === selectedExportOption);
    } else if (userRoleInSelectedOrg === 'member') {
        logsToExport = logsToExport.filter(log => log.name === currentUserName);
    }
    
    if (logsToExport.length === 0) {
        toast({ title: "No Data", description: `No entries to export for ${selectedDateStr}.`, variant: "destructive" });
        return;
    }
    
    const dataToExport = logsToExport.map(log => ({
      'Volunteer Name': log.name,
      'Clock In': format(log.clockIn, 'yyyy-MM-dd HH:mm:ss'),
      'Clock Out': log.clockOut ? format(log.clockOut, 'yyyy-MM-dd HH:mm:ss') : '---',
      'Duration': log.clockOut ? `${Math.floor((log.clockOut.getTime() - log.clockIn.getTime()) / 3600000)}h ${Math.floor(((log.clockOut.getTime() - log.clockIn.getTime()) % 3600000) / 60000)}m` : 'In Progress',
      'Note': log.note || '',
    }));
    
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Volunteer Logs');
    XLSX.writeFile(workbook, `VolunteerLogs_${selectedOrganization?.name.replace(/\s+/g, '_')}_${selectedDateStr}.xlsx`);
    toast({ title: "Export Successful", description: `Entries for ${selectedDateStr} exported.` });
  };
  
  const confirmClearEntries = () => {
      if (!displayDate || !selectedOrganization) return;
      const selectedDateStr = format(displayDate, 'yyyy-MM-dd');
      setTimeLogs(prevLogs => prevLogs.filter(log => log.date !== selectedDateStr));
      toast({ title: "Entries Cleared", description: `All entries for ${selectedDateStr} have been cleared from local storage for this organization.` });
      setIsClearConfirmOpen(false);
  };


  if (authLoading || componentState === 'loading') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/10">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </main>
    );
  }
  
  const commonHeader = (
    <div className="text-center space-y-4 w-full max-w-4xl mb-8">
       <div className="flex justify-between items-center w-full">
         <Image src="/logo.png" alt="KSHT Logo" width={80} height={80} className="rounded-full shadow-lg" data-ai-hint="temple logo" priority />
         {user && (
          <Button onClick={logout} variant="outline" size="sm">
            <LogOut className="mr-2 h-4 w-4" /> Logout
          </Button>
         )}
       </div>
       <h1 className="text-4xl sm:text-5xl font-bold">
         <span className="bg-gradient-to-r from-primary to-accent text-transparent bg-clip-text">KSHT Volunteer Log</span>
       </h1>
    </div>
  );

  if (componentState === 'orgSelection') {
    return (
      <main className="min-h-screen bg-gradient-to-br from-background to-secondary/10 flex flex-col items-center p-4 sm:p-8 space-y-8">
        {commonHeader}
        <Card className="w-full max-w-4xl">
          <CardHeader>
            <CardTitle className="text-2xl sm:text-3xl">Organization Hub</CardTitle>
            <CardDescription>
                {orgSelectionSubView === 'list' && "Select an organization to manage, or create/join a new one."}
                {orgSelectionSubView === 'createForm' && "Enter a name for your new organization."}
                {orgSelectionSubView === 'joinForm' && "Enter an invite code to join an organization."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingUserAssociatedOrgs ? (
              <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : orgSelectionSubView === 'list' ? (
              <>
                {userAssociatedOrgs.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold mb-4 border-b pb-2">Your Organizations</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {userAssociatedOrgs.map(org => (
                        <Card key={org.id} className="hover:shadow-lg transition-shadow flex flex-col">
                           <div className="flex-grow cursor-pointer" onClick={() => handleSelectOrganization(org)}>
                            <CardHeader>
                              <CardTitle>{org.name}</CardTitle>
                              <CardDescription>
                                Role: {org.ownerUid === user?.uid ? 'Owner' : 'Member'}
                              </CardDescription>
                            </CardHeader>
                          </div>
                          {org.ownerUid === user?.uid && (
                            <CardFooter>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="ml-auto">
                                    <MoreVertical className="h-4 w-4" />
                                    <span className="sr-only">Organization Options</span>
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleCopyInviteLink(org.inviteCode)}>
                                    <Copy className="mr-2 h-4 w-4" /> Copy Invite Link
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleDeleteOrgClick(org)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                    <Trash2 className="mr-2 h-4 w-4" /> Delete Organization
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </CardFooter>
                          )}
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-4 pt-4 border-t">
                  <Button onClick={() => setOrgSelectionSubView('createForm')} size="lg">
                    <PlusCircle className="mr-2 h-5 w-5" /> Create New Organization
                  </Button>
                  <Button onClick={() => setOrgSelectionSubView('joinForm')} variant="outline" size="lg">
                    <Users className="mr-2 h-5 w-5" /> Join with Invite Code
                  </Button>
                </div>
              </>
            ) : orgSelectionSubView === 'createForm' ? (
              <form onSubmit={handleCreateOrg} className="space-y-4 max-w-sm mx-auto">
                <div className="space-y-2">
                    <Label htmlFor="newOrgName">New Organization Name</Label>
                    <Input id="newOrgName" value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} required disabled={isSubmittingOrgAction} />
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                    <Button type="button" variant="outline" onClick={() => setOrgSelectionSubView('list')} disabled={isSubmittingOrgAction}>Cancel</Button>
                    <Button type="submit" className="flex-grow" disabled={isSubmittingOrgAction}>
                        {isSubmittingOrgAction && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create
                    </Button>
                </div>
              </form>
            ) : ( // joinForm
              <form onSubmit={handleJoinOrg} className="space-y-4 max-w-sm mx-auto">
                 <div className="space-y-2">
                    <Label htmlFor="joinInviteCode">Invite Code</Label>
                    <Input id="joinInviteCode" value={joinInviteCode} onChange={(e) => setJoinInviteCode(e.target.value)} required disabled={isSubmittingOrgAction} />
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                    <Button type="button" variant="outline" onClick={() => setOrgSelectionSubView('list')} disabled={isSubmittingOrgAction}>Cancel</Button>
                    <Button type="submit" className="flex-grow" disabled={isSubmittingOrgAction}>
                        {isSubmittingOrgAction && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Join
                    </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the "{orgToDelete?.name}" organization and all associated data from the database.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeleteOrganization} className="bg-destructive hover:bg-destructive/90">
                Yes, delete it
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    );
  }

  if (componentState === 'memberView' && selectedOrganization) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-background to-secondary/10 flex flex-col items-center p-4 sm:p-8 space-y-8">
        <div className="text-center space-y-4 w-full max-w-2xl mb-8">
          <div className="flex justify-between items-center w-full">
            <Image src="/logo.png" alt="KSHT Logo" width={80} height={80} className="rounded-full shadow-lg" data-ai-hint="temple logo" priority />
            <Button onClick={logout} variant="outline" size="sm"><LogOut className="mr-2 h-4 w-4" /> Logout</Button>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold">
            <span className="bg-gradient-to-r from-primary to-accent text-transparent bg-clip-text">KSHT Volunteer Log</span>
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground">Organization: {selectedOrganization.name} ({currentUserName} - {userRoleInSelectedOrg})</p>
          {currentDateTime && ( <div className="inline-flex items-center gap-2 p-3 sm:p-4 rounded-lg shadow-md bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold text-md sm:text-lg"><CalendarDays className="mr-2 h-5 w-5 sm:h-6 sm:w-6" /><span>{currentDateTime}</span></div> )}
        </div>
        
        <Button onClick={handleReturnToHub} variant="outline"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Organizations</Button>
        
        <Card className="w-full max-w-md shadow-xl rounded-xl">
          <CardHeader><CardTitle className="flex items-center gap-2 text-xl sm:text-2xl font-semibold"><User className="mr-2 h-6 w-6 text-primary" />Volunteer Logging</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <Button onClick={handleClockIn} disabled={!currentUserName.trim() || isCurrentUserClockedIn} size="lg"><ArrowRightToLine className="mr-2 h-5 w-5" /> Clock In</Button>
              <Button onClick={handleClockOut} disabled={!currentUserName.trim() || !isCurrentUserClockedIn} size="lg" className="bg-accent hover:bg-accent/90"><ArrowLeftToLine className="mr-2 h-5 w-5" /> Clock Out</Button>
            </div>
          </CardContent>
           {userRoleInSelectedOrg === 'owner' && selectedOrganization?.inviteCode && (
            <CardFooter className="flex justify-center">
              <div className="p-3 bg-green-100 dark:bg-green-800/50 rounded-md inline-flex items-center gap-2 text-green-800 dark:text-green-200 font-semibold text-lg">
                 <Info className="h-5 w-5" />
                 Invite Code: <span className="font-mono">{selectedOrganization.inviteCode}</span>
                 <Button variant="ghost" size="sm" onClick={() => handleCopyInviteLink(selectedOrganization.inviteCode)}><Copy className="h-4 w-4" /><span className="sr-only">Copy Invite Code</span></Button>
              </div>
            </CardFooter>
          )}
        </Card>
        {userRoleInSelectedOrg === 'owner' && (
          <Card className="w-full max-w-2xl shadow-xl rounded-xl">
            <CardHeader>
              <CardTitle className="text-xl sm:text-2xl font-semibold flex items-center gap-2"><Edit3 className="h-6 w-6 text-primary" /> Manual Volunteer Log Adjustment</CardTitle>
              <CardDescription>Manually add or adjust volunteer entries for members in "{selectedOrganization.name}".</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddManualTimeEntry} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="manualVolunteerSelect">Volunteer</Label>
                    <Select value={manualSelectedVolunteerId} onValueChange={setManualSelectedVolunteerId} disabled={organizationMembers.length === 0 || isAddingManualEntry}>
                      <SelectTrigger id="manualVolunteerSelect"><SelectValue placeholder="Select volunteer" /></SelectTrigger>
                      <SelectContent>
                        {organizationMembers.length > 0 ? organizationMembers.map(member => (
                          <SelectItem key={member.uid} value={member.uid}>{member.displayName} ({member.email})</SelectItem>
                        )) : <SelectItem value="-" disabled>No members found</SelectItem>}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="manualDate">Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button id="manualDate" variant={"outline"} className="w-full justify-start text-left font-normal h-10" disabled={isAddingManualEntry}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {manualDate ? format(manualDate, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={manualDate} onSelect={setManualDate} initialFocus disabled={(date) => date > new Date()} /></PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label htmlFor="manualClockInTime">Clock In Time</Label><Input id="manualClockInTime" type="time" value={manualClockInTime} onChange={(e) => setManualClockInTime(e.target.value)} required disabled={isAddingManualEntry} className="h-10"/></div>
                  <div className="space-y-2"><Label htmlFor="manualClockOutTime">Clock Out Time (Optional)</Label><Input id="manualClockOutTime" type="time" value={manualClockOutTime} onChange={(e) => setManualClockOutTime(e.target.value)} disabled={isAddingManualEntry} className="h-10"/></div>
                </div>
                 <div className="space-y-2"><Label htmlFor="manualNote">Note (Optional)</Label><Textarea id="manualNote" placeholder="Reason for manual entry, task details, etc." value={manualNote} onChange={(e) => setManualNote(e.target.value)} disabled={isAddingManualEntry} rows={3}/></div>
                <Button type="submit" className="w-full" disabled={isAddingManualEntry || !manualSelectedVolunteerId || !manualDate || !manualClockInTime}>
                  {isAddingManualEntry ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Add Manual Entry
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <Card className="w-full max-w-4xl shadow-xl rounded-xl">
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 gap-4">
            <CardTitle className="text-xl sm:text-2xl font-semibold">Volunteer Entries for {displayDate ? format(displayDate, "PPP") : '...'}</CardTitle>
            <Popover>
              <PopoverTrigger asChild><Button variant={"outline"} className="w-full sm:w-auto"><CalendarIcon className="mr-2 h-4 w-4" /><span>Change Date</span></Button></PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end"><Calendar mode="single" selected={displayDate} onSelect={(date) => {if (date) setDisplayDate(date);}} disabled={(date) => date > new Date()} initialFocus /></PopoverContent>
            </Popover>
          </CardHeader>
          <CardContent><TimeLogTable logs={displayedDateLogs} currentUserName={currentUserName} userRole={userRoleInSelectedOrg} displayDate={displayDate} /></CardContent>
        </Card>

        <Card className="w-full max-w-4xl shadow-xl rounded-xl">
          <CardHeader><CardTitle className="text-xl sm:text-2xl font-semibold">Export &amp; Data Management</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {userRoleInSelectedOrg === 'owner' && (
              <div className="space-y-2">
                <Label htmlFor="export-select">Select Volunteer to Export</Label>
                <Select value={selectedExportOption} onValueChange={setSelectedExportOption}>
                  <SelectTrigger id="export-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__ALL_VOLUNTEERS__">All Volunteers</SelectItem>
                    {uniqueVolunteerNamesForExport.map(name => (<SelectItem key={name} value={name}>{name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button onClick={handleExport} variant="outline" className="w-full" disabled={displayedDateLogs.length === 0}><Download className="mr-2 h-5 w-5" /> Export to XLSX</Button>
            <AlertDialog open={isClearConfirmOpen} onOpenChange={setIsClearConfirmOpen}>
              <AlertDialogTrigger asChild><Button variant="destructive" className="w-full" disabled={displayedDateLogs.length === 0}><Trash2 className="mr-2 h-5 w-5" /> Clear All Entries for {displayDate ? format(displayDate, "PPP") : '...'}</Button></AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete all volunteer log entries for {displayDate ? format(displayDate, "PPP") : 'the selected date'} in "{selectedOrganization.name}" from your browser's local storage.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmClearEntries}>Yes, clear entries</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </main>
    );
  }

  // Fallback for any other state
  return (
    <main className="min-h-screen flex items-center justify-center">
      <p>Returning to Organization Hub...</p>
    </main>
  );
}


export default function HomePage() {
  return (
    <Suspense fallback={<main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/10"><Loader2 className="h-12 w-12 animate-spin text-primary" /></main>}>
      <OrganizationHub />
    </Suspense>
  )
}
