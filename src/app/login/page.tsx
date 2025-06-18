
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { auth } from '@/lib/firebase/config';
import { signInWithEmailAndPassword, sendPasswordResetEmail, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { LogIn } from 'lucide-react';
import { createUserDocument } from '@/lib/firebase/firestoreService';

// Google Icon SVG
const GoogleIcon = () => (
  <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2">
    <title>Google</title>
    <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.18-1.73 4.1-1.02 1.08-2.58 2.26-4.8 2.26-5.72 0-10.32-4.58-10.32-10.26S6.76 0 12.48 0c3.54 0 6.28 1.36 8.04 3.1l-2.35 2.3-1.08-1.04c-1.6-1.6-3.57-2.6-5.6-2.6-4.78 0-8.68 3.82-8.68 8.52s3.9 8.52 8.68 8.52c2.96 0 5.17-1.22 6.47-2.48.97-.95 1.56-2.35 1.73-4.32H12.48z" fill="currentColor"/>
  </svg>
);

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast({ title: 'Login Successful', description: 'Welcome back!' });
      router.push('/');
    } catch (error: any) {
      toast({
        title: 'Login Failed',
        description: error.message || 'Please check your credentials and try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email) {
      toast({
        title: 'Email Required',
        description: 'Please enter your email address to reset your password.',
        variant: 'destructive',
      });
      return;
    }
    setIsLoading(true); // Reuse isLoading for general activity indication
    try {
      await sendPasswordResetEmail(auth, email);
      toast({
        title: 'Password Reset Email Sent',
        description: 'If an account exists for this email, a password reset link has been sent.',
      });
    } catch (error: any) {
      toast({
        title: 'Password Reset Failed',
        description: error.message || 'Could not send password reset email.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      await createUserDocument(user); // Ensure user document exists in Firestore
      toast({ title: 'Login Successful', description: `Welcome, ${user.displayName}!` });
      router.push('/');
    } catch (error: any) {
      toast({
        title: 'Google Sign-In Failed',
        description: error.message || 'Could not sign in with Google. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-background to-secondary/10 flex flex-col items-center justify-center p-4 sm:p-8 selection:bg-primary/20 selection:text-primary">
      <Card className="w-full max-w-md shadow-xl rounded-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl sm:text-3xl font-bold flex items-center justify-center gap-2">
            <LogIn className="h-7 w-7 text-primary" />
            Login to Your Account
          </CardTitle>
          <CardDescription>Enter your credentials to access the time clock.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="text-base py-3 px-4 h-12 rounded-md"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Button
                  type="button"
                  variant="link"
                  onClick={handlePasswordReset}
                  className="text-xs px-0 text-primary hover:underline"
                  disabled={isLoading || isGoogleLoading}
                >
                  Forgot password?
                </Button>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="text-base py-3 px-4 h-12 rounded-md"
              />
            </div>
            <Button type="submit" className="w-full text-base py-3 h-12 rounded-md" disabled={isLoading || isGoogleLoading}>
              {isLoading ? 'Logging in...' : 'Login'}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full text-base py-3 h-12 rounded-md"
            onClick={handleGoogleSignIn}
            disabled={isLoading || isGoogleLoading}
          >
            {isGoogleLoading ? (
              'Signing in with Google...'
            ) : (
              <>
                <GoogleIcon /> Sign in with Google
              </>
            )}
          </Button>
        </CardContent>
        <CardFooter className="text-center block mt-4">
          <p className="text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="font-medium text-primary hover:underline">
              Sign up
            </Link>
          </p>
        </CardFooter>
      </Card>
    </main>
  );
}
