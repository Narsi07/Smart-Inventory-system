
"use client";

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useDoc, useFirestore, useMemoFirebase, useAuth } from '@/firebase';
import type { UserProfile } from '@/types';
import { doc, } from 'firebase/firestore';
import { Loader2, LogOut } from 'lucide-react';
import { Logo } from '@/components/logo';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { signOut } from 'firebase/auth';

export default function SupplierLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const firestore = useFirestore();
  const auth = useAuth();

  const userProfileDoc = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, `users/${user.uid}`);
  }, [firestore, user]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileDoc);

  React.useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
    if (!isProfileLoading && userProfile?.role !== 'Supplier') {
      router.push('/dashboard'); // Or a generic access-denied page
    }
  }, [user, isUserLoading, userProfile, isProfileLoading, router]);

  const handleLogout = () => {
    if (auth) {
      signOut(auth);
    }
  };

  const isLoading = isUserLoading || isProfileLoading;

  if (isLoading || !userProfile || userProfile.role !== 'Supplier') {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-16 items-center justify-between border-b bg-card px-6">
        <Link href="/supplier/dashboard" className="flex items-center gap-2 font-semibold">
          <Logo className="h-6 w-auto" />
          <span className="font-bold">Supplier Portal</span>
        </Link>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-medium">{user?.displayName}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Log Out
          </Button>
        </div>
      </header>
      <main className="flex-1 bg-muted/40 p-4 md:p-8">
        {children}
      </main>
    </div>
  );
}
