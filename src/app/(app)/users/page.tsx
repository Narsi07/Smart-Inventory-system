
"use client";

import * as React from "react";
import { collection, doc } from "firebase/firestore";
import { useCollection, useFirestore, useUser, useMemoFirebase, useDoc } from "@/firebase";
import { updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import type { UserProfile } from "@/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";


export default function UsersPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [filter, setFilter] = React.useState("");

  const currentUserProfileDoc = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, `users/${user.uid}`);
  }, [firestore, user]);
  const { data: currentUserProfile, isLoading: isCurrentUserProfileLoading } = useDoc<UserProfile>(currentUserProfileDoc);

  const usersCollection = useMemoFirebase(() => {
    if (!firestore || currentUserProfile?.role !== 'Admin') return null;
    return collection(firestore, 'users');
  }, [firestore, currentUserProfile]);
  
  const { data: users, isLoading: usersLoading } = useCollection<Omit<UserProfile, 'id'>>(usersCollection);

  const isLoading = usersLoading || isCurrentUserProfileLoading;

  const filteredUsers = React.useMemo(() => {
    if (!users) return [];
    return users.filter(u => 
        u.displayName.toLowerCase().includes(filter.toLowerCase()) ||
        u.email.toLowerCase().includes(filter.toLowerCase())
    );
  }, [users, filter]);

  React.useEffect(() => {
    if (!isCurrentUserProfileLoading && currentUserProfile) {
        if (currentUserProfile.role !== 'Admin') {
            toast({
                variant: "destructive",
                title: "Access Denied",
                description: "You do not have permission to view this page.",
            });
            router.push('/dashboard');
        }
    }
  }, [currentUserProfile, isCurrentUserProfileLoading, router, toast]);

  const handleRoleChange = (userId: string, newRole: UserProfile['role']) => {
    if (!firestore || currentUserProfile?.role !== 'Admin') return;
    
    if (userId === user?.uid) {
        toast({
            variant: "destructive",
            title: "Action Forbidden",
            description: "You cannot change your own role.",
        });
        return;
    }

    const userDocRef = doc(firestore, 'users', userId);
    updateDocumentNonBlocking(userDocRef, { role: newRole });
    toast({
        title: "Role Updated",
        description: "User role has been successfully updated.",
    });
  };

  if (isLoading || !currentUserProfile || currentUserProfile.role !== 'Admin') {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader
        title="User Management"
        description="View and manage user roles within your organization."
      />

      <div className="flex items-center justify-between">
        <Input
          placeholder="Filter by name or email..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Display Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Member Since</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length > 0 ? filteredUsers.map((userProfile) => (
              <TableRow key={userProfile.id}>
                <TableCell className="font-medium">{userProfile.displayName}</TableCell>
                <TableCell>{userProfile.email}</TableCell>
                <TableCell>
                  <Select
                    defaultValue={userProfile.role}
                    onValueChange={(value) => handleRoleChange(userProfile.id, value as UserProfile['role'])}
                    disabled={userProfile.id === user?.uid}
                  >
                    <SelectTrigger className="w-[120px]">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Admin">Admin</SelectItem>
                      <SelectItem value="Staff">Staff</SelectItem>
                      <SelectItem value="Supplier">Supplier</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  {userProfile.createdAt?.toDate().toLocaleDateString()}
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  No users found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
