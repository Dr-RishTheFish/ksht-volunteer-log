
"use client";

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import type { TimeLogEntry } from '@/interfaces/TimeLogEntry';
import { useToast } from '@/hooks/use-toast';
import { format, parse } from 'date-fns';
import { User, CalendarDays, ArrowRightToLine, ArrowLeftToLine, Download, Trash2, LogOut, Building, Users, Loader2, Info, Copy, Settings, PlusCircle, MoreVertical, Edit3, Calendar as CalendarIcon } from 'lucide-react';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { 
  createOrganizationWithInviteCode, 
  joinOrganizationWithInviteCode, 
  getUserOrganizationDetails,
  getUserAssociatedOrganizations,
  updateUserActiveOrganization,
  deleteOrganization as deleteOrgService,
  getOrganizationMembers
} from '@/lib/firebase/firestoreService';
import type { Organization } from '@/interfaces/Organization';
import type { UserProfile } from '@/interfaces/User';


const ALL_EMPLOYEES_OPTION = "__ALL_EMPLOYEES__";

type ComponentState = 'loading' | 'orgSelection' | 'memberView';
type OrgSelectionSubView = 'list' | 'createForm' | 'joinForm';

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
          Back to Organization List
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
          Back to Organization List
        </Button>
      </div>
    </form>
  );
}


export default function Home() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [currentUserName, setCurrentUserName] = useState<string>('');
  const [timeLogs, setTimeLogs] = useState<TimeLogEntry[]>([]);
  const [currentDateTime, setCurrentDateTime] = useState<string>('');
  const { toast } = useToast();
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [selectedExportOption, setSelectedExportOption] = useState<string>(ALL_EMPLOYEES_OPTION);
  
  const [componentState, setComponentState] = useState<ComponentState>('loading');
  const [orgSelectionSubView, setOrgSelectionSubView] = useState<OrgSelectionSubView>('list');
  const [userAssociatedOrgs, setUserAssociatedOrgs] = useState<Organization[]>([]);
  const [isLoadingUserAssociatedOrgs, setIsLoadingUserAssociatedOrgs] = useState<boolean>(true);

  const [organizationDetails, setOrganizationDetails] = useState<Organization | null>(null);
  const [userRole, setUserRole] = useState<UserProfile['role']>(null);
  const [showInviteCodeCreatedCard, setShowInviteCodeCreatedCard] = useState(false);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [orgToDelete, setOrgToDelete] = useState<Organization | null>(null);

  const [organizationMembers, setOrganizationMembers] = useState<UserProfile[]>([]);
  const [manualSelectedEmployeeId, setManualSelectedEmployeeId] = useState<string>('');
  const [manualDate, setManualDate] = useState<Date | undefined>(new Date());
  const [manualClockInTime, setManualClockInTime] = useState<string>(''); // HH:mm
  const [manualClockOutTime, setManualClockOutTime] = useState<string>(''); // HH:mm
  const [isAddingManualEntry, setIsAddingManualEntry] = useState(false);


  const fetchAndSetUserAssociatedOrgs = async (userId: string) => {
    setIsLoadingUserAssociatedOrgs(true);
    try {
      const orgs = await getUserAssociatedOrganizations(userId);
      setUserAssociatedOrgs(orgs);
    } catch (error) {
      console.error("Error fetching user's associated organizations:", error);
      toast({ title: 'Error', description: 'Could not fetch your organizations.', variant: 'destructive' });
      setUserAssociatedOrgs([]);
    } finally {
      setIsLoadingUserAssociatedOrgs(false);
    }
  };
  
  useEffect(() => {
    if (authLoading) {
      setComponentState('loading');
      return;
    }
    if (!user) {
      router.push('/login');
      return;
    }

    setComponentState('loading');
    setTimeLogs([]); 
    
    getUserOrganizationDetails(user.uid)
      .then(orgAndUserData => {
        if (orgAndUserData?.organization) {
          setOrganizationDetails(orgAndUserData.organization);
          setUserRole(orgAndUserData.userRole);
          setCurrentUserName(orgAndUserData.userDisplayName || user.email?.split('@')[0] || 'User');
          setComponentState('memberView');
        } else {
          setCurrentUserName(orgAndUserData?.userDisplayName || user.displayName || user.email?.split('@')[0] || 'User');
          setComponentState('orgSelection');
          setOrgSelectionSubView('list');
          fetchAndSetUserAssociatedOrgs(user.uid);
          setOrganizationDetails(null);
          setUserRole(null);
        }
      })
      .catch(error => {
        console.error("Error fetching initial organization or user details:", error);
        toast({ title: 'Error', description: 'Could not fetch your details. Please try refreshing.', variant: 'destructive'});
        setCurrentUserName(user.displayName || user.email?.split('@')[0] || 'User');
        setComponentState('orgSelection');
        setOrgSelectionSubView('list');
        fetchAndSetUserAssociatedOrgs(user.uid);
        setOrganizationDetails(null);
        setUserRole(null);
      });

  }, [user, authLoading, router, toast]);

  useEffect(() => {
    if (user && componentState === 'memberView' && organizationDetails?.id) {
      const storageKey = `timeLogs_${organizationDetails.id}`;
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
          setTimeLogs([]);
        }
      } else {
        setTimeLogs([]);
      }
    } else if (componentState !== 'memberView' || !organizationDetails?.id) {
        setTimeLogs([]); 
    }
  }, [user, componentState, organizationDetails?.id]);

  useEffect(() => {
    if (componentState === 'memberView' && organizationDetails?.id && timeLogs) {
      const storageKey = `timeLogs_${organizationDetails.id}`;
      localStorage.setItem(storageKey, JSON.stringify(timeLogs));
    }
  }, [timeLogs, componentState, organizationDetails?.id]);

  useEffect(() => {
    const updateDateTime = () => {
      setCurrentDateTime(format(new Date(), 'MM/dd/yyyy - hh:mm:ss a'));
    };
    updateDateTime();
    const timer = setInterval(updateDateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch organization members if user is owner and in memberView
  useEffect(() => {
    if (componentState === 'memberView' && userRole === 'owner' && organizationDetails?.id) {
      getOrganizationMembers(organizationDetails.id)
        .then(members => {
          setOrganizationMembers(members);
          if (members.length > 0 && !manualSelectedEmployeeId) {
            setManualSelectedEmployeeId(members[0].uid); // Default to first member
          }
        })
        .catch(error => {
          console.error("Error fetching organization members:", error);
          toast({ title: "Error", description: "Could not fetch organization members.", variant: "destructive"});
          setOrganizationMembers([]);
        });
    } else {
      setOrganizationMembers([]); // Clear if not owner or not in member view
    }
  }, [componentState, userRole, organizationDetails?.id, toast]);


  const isCurrentUserClockedIn = useMemo(() => {
    if (!currentUserName || componentState !== 'memberView') return false;
    const todayDateStr = format(new Date(), 'yyyy-MM-dd');
    return timeLogs.some(log => log.name === currentUserName && log.clockOut === null && log.date === todayDateStr);
  }, [currentUserName, timeLogs, componentState]);

  const handleClockIn = () => {
    if (!currentUserName.trim() || !organizationDetails?.id) return;
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
    if (!currentUserName.trim() || !organizationDetails?.id) return;
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
  
  const todayLogs = useMemo(() => {
    if (componentState !== 'memberView' || !organizationDetails?.id) return [];
    const todayDateStr = format(new Date(), 'yyyy-MM-dd');
    let logsToDisplay = timeLogs.filter(log => log.date === todayDateStr);
    if (userRole === 'member' && currentUserName) {
      logsToDisplay = logsToDisplay.filter(log => log.name === currentUserName);
    }
    return logsToDisplay.sort((a,b) => b.clockIn.getTime() - a.clockIn.getTime());
  }, [timeLogs, componentState, organizationDetails?.id, userRole, currentUserName]);

  const uniqueEmployeeNamesForExport = useMemo(() => {
    if (!organizationDetails?.id) return [];
    if (userRole === 'owner') {
      const names = new Set(timeLogs.filter(log => log.date === format(new Date(), 'yyyy-MM-dd')).map(log => log.name));
      return Array.from(names).sort((a, b) => a.localeCompare(b));
    }
    if (currentUserName && timeLogs.some(log => log.name === currentUserName && log.date === format(new Date(), 'yyyy-MM-dd'))) {
      return [currentUserName];
    }
    return [];
  }, [timeLogs, userRole, currentUserName, organizationDetails?.id]);

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
    if (!organizationDetails?.id) return;
    let logsToExport: TimeLogEntry[];
    let fileNamePart: string;
    const allTodayLogsForCurrentOrg = timeLogs.filter(log => log.date === format(new Date(), 'yyyy-MM-dd'));

    if (userRole === 'member' && currentUserName) {
        logsToExport = allTodayLogsForCurrentOrg.filter(log => log.name === currentUserName);
        fileNamePart = currentUserName.replace(/\s+/g, '_');
    } else if (userRole === 'owner') {
        if (selectedExportOption === ALL_EMPLOYEES_OPTION) {
            logsToExport = [...allTodayLogsForCurrentOrg].sort((a, b) => a.name.localeCompare(b.name));
            fileNamePart = "All_Employees";
        } else {
            logsToExport = allTodayLogsForCurrentOrg.filter(log => log.name === selectedExportOption);
            fileNamePart = selectedExportOption.replace(/\s+/g, '_');
        }
    } else {
        toast({ title: "Error", description: "Cannot determine export scope.", variant: "destructive" });
        return;
    }
    if (logsToExport.length === 0) {
        const forWhom = userRole === 'member' ? currentUserName : (selectedExportOption === ALL_EMPLOYEES_OPTION ? `today's entries for ${organizationDetails.name}` : selectedExportOption);
        toast({ title: "No Data", description: `There are no time entries for ${forWhom} to export.`, variant: "destructive" });
        return;
    }
    const dataToExport = logsToExport.map(log => ({
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
    XLSX.writeFile(workbook, `TimeLogs_${fileNamePart}_${organizationDetails?.name.replace(/\s+/g, '_') || 'Org'}_${todayDateFileName}.xlsx`);
    toast({ title: "Export Successful", description: `Time entries exported for ${fileNamePart}.` });
  };

  const confirmClearEntries = () => {
    if (!organizationDetails?.id) return;
    let clearedCount = 0;
    const todayDateStr = format(new Date(), 'yyyy-MM-dd');
    if (userRole === 'member' && currentUserName) {
      const userLogsForToday = timeLogs.filter(log => log.name === currentUserName && log.date === todayDateStr);
      clearedCount = userLogsForToday.length;
      setTimeLogs(prevLogs => prevLogs.filter(log => !(log.name === currentUserName && log.date === todayDateStr)));
      if (clearedCount > 0) {
        toast({ title: "Entries Cleared", description: `Your ${clearedCount} time entr${clearedCount === 1 ? 'y' : 'ies'} for today in ${organizationDetails.name} have been cleared from local storage.` });
      } else {
        toast({ title: "No Entries", description: `You had no time entries for today in ${organizationDetails.name} to clear.` });
      }
    } else if (userRole === 'owner') {
      const logsForTodayInOrg = timeLogs.filter(log => log.date === todayDateStr);
      clearedCount = logsForTodayInOrg.length;
      setTimeLogs(prevLogs => prevLogs.filter(log => log.date !== todayDateStr)); // Clears all for today in current org
      if (clearedCount > 0) {
        toast({ title: "All Entries Cleared", description: `All ${clearedCount} time entr${clearedCount === 1 ? 'y' : 'ies'} for today in ${organizationDetails.name} have been cleared from local storage.` });
      } else {
        toast({ title: "No Entries", description: `There were no time entries for today in ${organizationDetails.name} to clear.` });
      }
    } else {
      toast({ title: "Error", description: "Cannot determine clear scope.", variant: "destructive" });
    }
    setIsClearConfirmOpen(false);
  };

  const handleCopyInviteCode = () => {
    if (organizationDetails?.inviteCode) {
      navigator.clipboard.writeText(organizationDetails.inviteCode)
        .then(() => toast({ title: "Copied!", description: "Invite code copied to clipboard." }))
        .catch(() => toast({ title: "Error", description: "Could not copy invite code.", variant: "destructive" }));
    }
  };

  const handleSelectOrganization = async (org: Organization) => {
    if (!user) return;
    setOrganizationDetails(org);
    const role = org.ownerUid === user.uid ? 'owner' : 'member';
    setUserRole(role);
    await updateUserActiveOrganization(user.uid, org.id, role);
    setComponentState('memberView');
    setShowInviteCodeCreatedCard(false);
    setTimeLogs([]); 
  };

  const handleReturnToOrgSelectionList = () => {
    if (!user) return;
    setComponentState('orgSelection');
    setOrgSelectionSubView('list');
    fetchAndSetUserAssociatedOrgs(user.uid); 
    setOrganizationDetails(null);
    setUserRole(null);
    setShowInviteCodeCreatedCard(false);
    setTimeLogs([]);
  };

  const handleDeleteOrgClicked = (org: Organization) => {
    setOrgToDelete(org);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteOrganization = async () => {
    if (!orgToDelete || !user) return;
    try {
      await deleteOrgService(orgToDelete.id);
      toast({ title: 'Organization Deleted', description: `"${orgToDelete.name}" has been deleted.` });
      setOrgToDelete(null);
      setIsDeleteDialogOpen(false);
      fetchAndSetUserAssociatedOrgs(user.uid); // Refresh list
      if (organizationDetails?.id === orgToDelete.id) {
        setOrganizationDetails(null);
        setUserRole(null);
        setComponentState('orgSelection'); // Go back to selection if current org was deleted
        setOrgSelectionSubView('list');
      }
    } catch (error: any) {
      toast({ title: 'Error Deleting Organization', description: error.message || 'Could not delete organization.', variant: 'destructive' });
    }
  };

  const handleAddManualTimeEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAddingManualEntry(true);

    if (!manualSelectedEmployeeId || !manualDate || !manualClockInTime) {
      toast({ title: "Missing Information", description: "Please select an employee, date, and clock-in time.", variant: "destructive" });
      setIsAddingManualEntry(false);
      return;
    }

    const selectedEmployee = organizationMembers.find(mem => mem.uid === manualSelectedEmployeeId);
    if (!selectedEmployee) {
      toast({ title: "Error", description: "Selected employee not found.", variant: "destructive" });
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
        name: selectedEmployee.displayName,
        clockIn: clockInDateTime,
        clockOut: clockOutDateTime,
        date: dateStr,
      };

      setTimeLogs(prevLogs => [...prevLogs, newLog].sort((a,b) => b.clockIn.getTime() - a.clockIn.getTime()));
      toast({ title: "Manual Entry Added", description: `Time log added for ${selectedEmployee.displayName}.` });

      // Reset form
      setManualClockInTime('');
      setManualClockOutTime('');
      // setManualDate(new Date()); // Optionally reset date or keep it
      // setManualSelectedEmployeeId(organizationMembers.length > 0 ? organizationMembers[0].uid : ''); // Optionally reset employee

    } catch (error) {
      console.error("Error processing manual time entry:", error);
      toast({ title: "Error Adding Entry", description: "Could not add manual time entry.", variant: "destructive"});
    } finally {
      setIsAddingManualEntry(false);
    }
  };


  if (componentState === 'loading' || authLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/10">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </main>
    );
  }

  if (!user) { return <main className="min-h-screen flex items-center justify-center"><p>Redirecting to login...</p></main>; }

  const commonHeader = (
    <div className="text-center space-y-4 w-full max-w-2xl mb-8">
      <div className="flex justify-between items-center w-full">
        <Image src="/Stickers.png" alt="Big Brainbox Logo" width={80} height={80} className="rounded-full shadow-lg" data-ai-hint="logo sticker"/>
        <Button onClick={logout} variant="outline" size="sm"><LogOut className="mr-2 h-4 w-4" /> Logout</Button>
      </div>
      <h1 className="text-4xl sm:text-5xl font-bold">
        <span className="bg-gradient-to-r from-primary to-accent text-transparent bg-clip-text">Big Brainbox Time Clock</span>
      </h1>
      {componentState === 'memberView' && organizationDetails && (
        <>
          <p className="text-lg sm:text-xl text-muted-foreground">Organization: {organizationDetails.name} ({currentUserName || 'User'} - {userRole === 'owner' ? 'Owner' : userRole === 'member' ? 'Member' : 'Role not set'})</p>
          {currentDateTime && ( <div className="inline-flex items-center gap-2 p-3 sm:p-4 rounded-lg shadow-md bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold text-md sm:text-lg"><CalendarDays className="h-5 w-5 sm:h-6 sm:w-6" /><span>{currentDateTime}</span></div> )}
        </>
      )}
       {componentState === 'orgSelection' && (
         <p className="text-lg sm:text-xl text-muted-foreground">Welcome, {currentUserName || 'User'}!</p>
       )}
    </div>
  );

  if (componentState === 'orgSelection') {
    return (
      <main className="min-h-screen bg-gradient-to-br from-background to-secondary/10 flex flex-col items-center p-4 sm:p-8 space-y-8 selection:bg-primary/20 selection:text-primary">
        {commonHeader}
        {orgSelectionSubView === 'list' && (
          <Card className="w-full max-w-lg shadow-xl rounded-xl">
            <CardHeader>
              <CardTitle className="text-xl sm:text-2xl font-semibold">Your Organizations</CardTitle>
              <CardDescription>Select an organization to continue, or create/join a new one.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingUserAssociatedOrgs ? (
                <div className="flex justify-center py-4"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : userAssociatedOrgs.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto p-1">
                  {userAssociatedOrgs.map(org => (
                    <div key={org.id} className="flex items-center gap-2">
                      <Button variant="outline" className="flex-1 justify-start p-4 h-auto text-left" onClick={() => handleSelectOrganization(org)}>
                        <Building className="mr-3 h-5 w-5 text-primary/80" />
                        <div className="flex flex-col">
                          <span className="font-semibold">{org.name}</span>
                          <span className="text-xs text-muted-foreground">
                            Role: {org.ownerUid === user.uid ? 'Owner' : 'Member'} | ID: {org.id.substring(0,6)}...
                          </span>
                        </div>
                      </Button>
                      {org.ownerUid === user.uid && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleDeleteOrgClicked(org)}
                              className="text-red-600 focus:text-red-600 focus:bg-red-50"
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Delete Organization
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-4">You are not associated with any organizations yet.</p>
              )}
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button onClick={() => setOrgSelectionSubView('createForm')} className="flex-1" size="lg">
                  <PlusCircle className="mr-2 h-5 w-5" /> Create New Organization
                </Button>
                <Button onClick={() => setOrgSelectionSubView('joinForm')} variant="outline" className="flex-1" size="lg">
                  <Users className="mr-2 h-5 w-5" /> Join with Code
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        {orgSelectionSubView === 'createForm' && (
          <Card className="w-full max-w-md shadow-xl rounded-xl">
            <CardHeader><CardTitle>Create New Organization</CardTitle></CardHeader>
            <CardContent>
              <CreateOrganizationForm
                userId={user.uid}
                onOrganizationCreated={(org) => { 
                  setOrganizationDetails(org);
                  setUserRole('owner');
                  setComponentState('memberView');
                  setShowInviteCodeCreatedCard(true);
                  updateUserActiveOrganization(user.uid, org.id, 'owner');
                }}
                onBack={() => setOrgSelectionSubView('list')}
              />
            </CardContent>
          </Card>
        )}
        {orgSelectionSubView === 'joinForm' && (
           <Card className="w-full max-w-md shadow-xl rounded-xl">
             <CardHeader><CardTitle>Join Organization</CardTitle></CardHeader>
             <CardContent>
              <JoinOrganizationForm
                userId={user.uid}
                onOrganizationJoined={(org) => {
                  setOrganizationDetails(org);
                  setUserRole('member');
                  setComponentState('memberView');
                  setShowInviteCodeCreatedCard(false);
                  updateUserActiveOrganization(user.uid, org.id, 'member');
                }}
                onBack={() => setOrgSelectionSubView('list')}
              />
            </CardContent>
          </Card>
        )}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure you want to delete "{orgToDelete?.name}"?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the organization and all associated data that is directly stored within the organization document. Member time logs stored locally will remain unless their active organization changes.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => { setIsDeleteDialogOpen(false); setOrgToDelete(null); }}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeleteOrganization} className="bg-red-600 hover:bg-red-700">
                Yes, Delete Organization
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    );
  }
  
  // componentState === 'memberView'
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
            <CardDescription className="text-green-600 dark:text-green-400">Share this invite code with your team members to join "{organizationDetails.name}".</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <div className="p-3 bg-green-100 dark:bg-green-800/50 rounded-md inline-flex items-center gap-2">
              <Label htmlFor="inviteCodeDisplay" className="sr-only">Invite Code</Label>
              <Input id="inviteCodeDisplay" type="text" value={organizationDetails.inviteCode} readOnly className="text-2xl font-mono tracking-wider text-green-800 dark:text-green-200 bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 h-auto p-0"/>
              <Button variant="ghost" size="sm" onClick={handleCopyInviteCode} aria-label="Copy invite code"><Copy className="h-5 w-5 text-green-600 dark:text-green-400" /></Button>
            </div>
          </CardContent>
          {showInviteCodeCreatedCard && ( <CardFooter><Button variant="outline" size="sm" className="w-full" onClick={() => setShowInviteCodeCreatedCard(false)}>Dismiss</Button></CardFooter> )}
        </Card>
      )}

      <Card className="w-full max-w-md shadow-xl rounded-xl">
        <CardHeader className="pb-4"><CardTitle className="flex items-center gap-2 text-xl sm:text-2xl font-semibold"><User className="h-6 w-6 text-primary" />Time Tracking Controls</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="name" className="text-sm font-medium text-foreground/80">Your Name (for time entry)</Label>
            <Input id="name" type="text" placeholder="Your name for clock-in" value={currentUserName || ''} readOnly className="mt-1 text-base py-3 px-4 h-12 rounded-md focus:border-primary focus:ring-primary bg-muted/50 cursor-not-allowed"/>
            <p className="text-xs text-muted-foreground mt-1">Logged in as: {user?.email}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Button onClick={handleClockIn} disabled={!currentUserName.trim() || isCurrentUserClockedIn} size="lg" className="text-base py-3 h-12 rounded-md"><ArrowRightToLine className="mr-2 h-5 w-5" /> Clock In</Button>
            <Button onClick={handleClockOut} disabled={!currentUserName.trim() || !isCurrentUserClockedIn} size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground text-base py-3 h-12 rounded-md"><ArrowLeftToLine className="mr-2 h-5 w-5" /> Clock Out</Button>
          </div>
        </CardContent>
      </Card>

      {userRole === 'owner' && organizationDetails && (
        <Card className="w-full max-w-2xl shadow-xl rounded-xl">
          <CardHeader>
            <CardTitle className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
              <Edit3 className="h-6 w-6 text-primary" /> Manual Time Adjustment
            </CardTitle>
            <CardDescription>Manually add or adjust time entries for employees in "{organizationDetails.name}".</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddManualTimeEntry} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="manualEmployeeSelect">Employee</Label>
                  <Select 
                    value={manualSelectedEmployeeId} 
                    onValueChange={setManualSelectedEmployeeId}
                    disabled={organizationMembers.length === 0 || isAddingManualEntry}
                  >
                    <SelectTrigger id="manualEmployeeSelect">
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {organizationMembers.length > 0 ? organizationMembers.map(member => (
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
              <Button type="submit" className="w-full" disabled={isAddingManualEntry || !manualSelectedEmployeeId || !manualDate || !manualClockInTime}>
                {isAddingManualEntry ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isAddingManualEntry ? 'Adding Entry...' : 'Add Manual Time Entry'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="w-full max-w-2xl shadow-xl rounded-xl">
        <CardHeader><CardTitle className="text-xl sm:text-2xl font-semibold">Today's Time Entries</CardTitle></CardHeader>
        <CardContent className="pt-0"><TimeLogTable logs={todayLogs} currentUserName={currentUserName} userRole={userRole} /></CardContent>
      </Card>

      <Card className="w-full max-w-2xl shadow-xl rounded-xl">
        <CardHeader><CardTitle className="text-xl sm:text-2xl font-semibold">Export &amp; Data Management</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {userRole === 'owner' && (
            <div className="space-y-2">
              <Label htmlFor="export-select">Select Employee to Export (Today's Entries for {organizationDetails?.name})</Label>
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
          )}
          {userRole === 'member' && ( <p className="text-sm text-muted-foreground">You can export your own time entries for {organizationDetails?.name}.</p> )}
          <Button onClick={handleExport} variant="outline" className="w-full" disabled={(userRole === 'member' && todayLogs.filter(log => log.name === currentUserName).length === 0) || (userRole === 'owner' && timeLogs.filter(log => log.date === format(new Date(), 'yyyy-MM-dd')).length === 0 )}>
            <Download className="mr-2 h-5 w-5" /> Export to XLSX {userRole === 'member' ? `(My Entries)` : ''}
          </Button>
          <AlertDialog open={isClearConfirmOpen} onOpenChange={setIsClearConfirmOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full" disabled={(userRole === 'member' && todayLogs.filter(log => log.name === currentUserName).length === 0) || (userRole === 'owner' && timeLogs.filter(log => log.date === format(new Date(), 'yyyy-MM-dd')).length === 0 )}>
                <Trash2 className="mr-2 h-5 w-5" /> Clear {userRole === 'member' ? `My Entries for Today (Org: ${organizationDetails?.name || 'Current'})` : `All Entries for Today (Org: ${organizationDetails?.name || 'Current'})`}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete 
                  {userRole === 'member' ? ` your time log entries for today in "${organizationDetails?.name}"` : ` all time log entries for today in "${organizationDetails?.name}"`}
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

      <Card className="w-full max-w-2xl shadow-xl rounded-xl">
        <CardHeader><CardTitle className="text-xl sm:text-2xl font-semibold flex items-center gap-2"><Settings className="h-6 w-6 text-primary" />Organization Settings</CardTitle></CardHeader>
        <CardContent>
          <Button onClick={handleReturnToOrgSelectionList} variant="outline" className="w-full">
            <Users className="mr-2 h-5 w-5" /> Switch or Manage Organizations
          </Button>
          <p className="text-xs text-muted-foreground mt-2 text-center">This will take you back to the organization selection screen. Your current time logs for "{organizationDetails?.name}" are saved locally.</p>
        </CardContent>
      </Card>
    </main>
  );
}

    
