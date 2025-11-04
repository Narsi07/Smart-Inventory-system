
"use client";

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import type { UserProfile } from '@/types';
import { doc } from 'firebase/firestore';
import { AppSidebar } from '@/components/app-sidebar';
import { Loader2 } from 'lucide-react';
import { FloatingChatbot } from '@/components/floating-chatbot';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const firestore = useFirestore();

  const userProfileDoc = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, `users/${user.uid}`);
  }, [firestore, user]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileDoc);

  React.useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
    // This check is important. If the profile is loaded and the role is 'Supplier', redirect.
    if (!isProfileLoading && userProfile && userProfile.role === 'Supplier') {
        router.push('/supplier/dashboard');
    }
  }, [user, isUserLoading, userProfile, isProfileLoading, router]);

  // Combine loading states.
  const isLoading = isUserLoading || isProfileLoading;

  // This is the critical part. We must wait until we have confirmed the user's role.
  // If we render children before the profile is loaded, child components might
  // make queries that a 'Staff' or 'Supplier' user is not allowed to make.
  if (isLoading || !userProfile || userProfile.role === 'Supplier') {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  // Only once we have the user and their profile (and they are not a supplier) can we render the main app layout.
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main className="flex-1 bg-muted/40">
        {children}
      </main>
      <FloatingChatbot />
    </div>
  );
}
