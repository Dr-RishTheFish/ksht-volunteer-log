
"use client";

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { auth } from '@/lib/firebase/config';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { Loader2, UserPlus, Building, Users } from 'lucide-react';
import { createUserDocument, joinOrganization, createOrganization } from '@/lib/firebase/firestoreService';

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [flow, setFlow] = useState<'signup' | 'join_org' | 'create_org'>('signup');
  const [inviteCode, setInviteCode] = useState('');
  const [orgName, setOrgName] = useState('');

  useEffect(() => {
    const action = searchParams.get('action');
    const invite = searchParams.get('inviteCode');
    if (invite) {
      setFlow('join_org');
      setInviteCode(invite);
    } else if (action === 'create_org') {
      setFlow('create_org');
    } else if (action === 'join_org') {
      setFlow('join_org');
    }
  }, [searchParams]);

  const handleSignupAndAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast({ title: 'Error', description: 'Please enter your full name.', variant: 'destructive' });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: 'Error', description: 'Passwords do not match.', variant: 'destructive' });
      return;
    }
    if (flow === 'create_org' && !orgName.trim()) {
        toast({ title: 'Error', description: 'Please enter an organization name.', variant: 'destructive' });
        return;
    }
    if (flow === 'join_org' && !inviteCode.trim()) {
        toast({ title: 'Error', description: 'Please enter an invite code.', variant: 'destructive' });
        return;
    }

    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      await updateProfile(user, { displayName: fullName.trim() });
      await createUserDocument(user, fullName.trim());
      
      if (flow === 'create_org') {
        await createOrganization(user.uid, orgName.trim());
        toast({ title: 'Success!', description: 'Account and organization created.' });
      } else if (flow === 'join_org') {
        const joinedOrg = await joinOrganization(user.uid, inviteCode.trim());
        if (!joinedOrg) throw new Error("Invalid invite code.");
        toast({ title: 'Success!', description: `Account created and you've joined ${joinedOrg.name}.` });
      } else {
        toast({ title: 'Account Created!', description: 'You can now join or create an organization.' });
      }
      
      router.push('/');
    } catch (error: any) {
      toast({
        title: 'Signup Failed',
        description: error.message.includes("Invalid invite code") ? "Invalid invite code. Please check and try again." : (error.message || 'Could not create your account.'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getTitle = () => {
    if (flow === 'create_org') return "Create Organization";
    if (flow === 'join_org') return "Join Organization";
    return "Create an Account";
  };
  
  const getDescription = () => {
    if (flow === 'create_org') return "First, create your account, then your new organization.";
    if (flow === 'join_org') return "Create an account to join an organization with an invite code.";
    return "Get started with KSHT Volunteer Log.";
  };

  const getIcon = () => {
    if (flow === 'create_org') return <Building className="h-7 w-7 text-primary" />;
    if (flow === 'join_org') return <Users className="h-7 w-7 text-primary" />;
    return <UserPlus className="h-7 w-7 text-primary" />;
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-background to-secondary/10 flex flex-col items-center justify-center p-4 sm:p-8">
       <div className="mb-8 text-center">
        <Image src="/logo.png" alt="KSHT Logo" width={100} height={100} className="mx-auto rounded-full shadow-lg" data-ai-hint="temple logo" priority />
        <h1 className="text-3xl sm:text-4xl font-bold mt-4">
          <span className="bg-gradient-to-r from-primary to-accent text-transparent bg-clip-text">
            KSHT Volunteer Log
          </span>
        </h1>
      </div>
      <Card className="w-full max-w-md shadow-xl rounded-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl sm:text-3xl font-bold flex items-center justify-center gap-2">
            {getIcon()} {getTitle()}
          </CardTitle>
          <CardDescription>{getDescription()}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignupAndAction} className="space-y-4">
            {flow === 'create_org' && (
                <div className="space-y-2">
                    <Label htmlFor="orgName">New Organization Name</Label>
                    <Input id="orgName" value={orgName} onChange={(e) => setOrgName(e.target.value)} required />
                </div>
            )}
            {flow === 'join_org' && (
                 <div className="space-y-2">
                    <Label htmlFor="inviteCode">Invite Code</Label>
                    <Input id="inviteCode" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} required />
                </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign Up
            </Button>
          </form>
        </CardContent>
        <CardFooter className="text-center block">
          <p className="text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Log in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </main>
  );
}

export default function SignupPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <SignupForm />
        </Suspense>
    )
}
