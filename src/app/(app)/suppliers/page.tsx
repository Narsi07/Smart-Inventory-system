
"use client";

import * as React from "react";
import { collection, doc, query, where } from "firebase/firestore";
import { useCollection, useFirestore, useUser, useMemoFirebase, useDoc } from "@/firebase";
import {
  addDocumentNonBlocking,
  deleteDocumentNonBlocking,
  updateDocumentNonBlocking,
} from "@/firebase/non-blocking-updates";
import type { Supplier, UserProfile } from "@/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import {
  MoreHorizontal,
  PlusCircle,
  FilePenLine,
  Trash2,
  Loader2,
} from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { useRouter } from "next/navigation";

const supplierSchema = z.object({
  name: z.string().min(1, "Name is required"),
  contactEmail: z.string().email("Invalid email address").optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  userId: z.string().optional(),
  reliabilityScore: z.coerce.number().min(0).max(1).optional(),
});

export default function SuppliersPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const userProfileDoc = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, `users/${user.uid}`);
  }, [firestore, user]);
  const { data: userProfile, isLoading: isUserProfileLoading } = useDoc<UserProfile>(userProfileDoc);

  const suppliersCollection = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'suppliers');
  }, [firestore, user]);
  const { data: suppliers, isLoading: suppliersLoading } = useCollection<Omit<Supplier, 'id'>>(suppliersCollection);
  
  // This query is now allowed for both Admin and Staff roles by the security rules
  const supplierUsersQuery = useMemoFirebase(() => {
    if (!firestore || !userProfile || (userProfile.role !== 'Admin' && userProfile.role !== 'Staff')) return null;
    return query(collection(firestore, 'users'), where("role", "==", "Supplier"));
  }, [firestore, userProfile]);

  const { data: supplierUsers, isLoading: usersLoading } = useCollection<Omit<UserProfile, 'id'>>(supplierUsersQuery);
  
  const userMap = React.useMemo(() => {
    if (!supplierUsers) return new Map();
    return new Map(supplierUsers.map(u => [u.id, u.displayName]));
  }, [supplierUsers]);

  const [filter, setFilter] = React.useState("");
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = React.useState(false);
  const [selectedSupplier, setSelectedSupplier] = React.useState<Supplier | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    formState: { errors },
  } = useForm<z.infer<typeof supplierSchema>>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
        reliabilityScore: 0.9,
    }
  });
  
  const pageIsLoading = suppliersLoading || usersLoading || isUserProfileLoading;

  React.useEffect(() => {
    if (!isUserProfileLoading && userProfile) {
        if (userProfile.role !== 'Admin' && userProfile.role !== 'Staff') {
            toast({
                variant: "destructive",
                title: "Access Denied",
                description: "You do not have permission to view this page.",
            });
            router.push('/dashboard');
        }
    }
  }, [userProfile, isUserProfileLoading, router, toast]);

  const filteredSuppliers = React.useMemo(() => {
    if (!suppliers) return [];
    return suppliers.filter((supplier) =>
      supplier.name.toLowerCase().includes(filter.toLowerCase())
    );
  }, [suppliers, filter]);

  const handleAddClick = () => {
    setSelectedSupplier(null);
    reset({ name: "", contactEmail: "", phone: "", address: "", userId: "", reliabilityScore: 0.9 });
    setIsFormOpen(true);
  };

  const handleEditClick = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    reset(supplier);
    setIsFormOpen(true);
  };

  const handleDeleteClick = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (selectedSupplier && firestore) {
      const docRef = doc(firestore, 'suppliers', selectedSupplier.id);
      deleteDocumentNonBlocking(docRef);
    }
    setIsDeleteConfirmOpen(false);
    setSelectedSupplier(null);
  };

  const handleFormSubmit = async (data: z.infer<typeof supplierSchema>) => {
    if (!firestore || !user) return;
    
    const finalUserId = data.userId === 'none' ? undefined : data.userId;

    const supplierData = {
      ...data,
      userId: finalUserId,
      owner: user.uid,
    };

    if (selectedSupplier) {
      const docRef = doc(firestore, 'suppliers', selectedSupplier.id);
      await updateDocumentNonBlocking(docRef, supplierData);
      toast({title: "Supplier Updated", description: "The supplier details have been saved."})
    } else {
      const collectionRef = collection(firestore, 'suppliers');
      await addDocumentNonBlocking(collectionRef, supplierData);
      toast({title: "Supplier Added", description: "The new supplier has been created."})
    }

    setIsFormOpen(false);
    setSelectedSupplier(null);
  };
  
  const reliabilityScore = watch('reliabilityScore');

  const isAdmin = userProfile?.role === 'Admin';
  const isStaff = userProfile?.role === 'Staff';
  
  if (pageIsLoading || !userProfile || (userProfile.role !== 'Admin' && userProfile.role !== 'Staff')) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader
        title="Suppliers"
        description="Manage your product suppliers."
      />

      <div className="flex items-center justify-between">
        <Input
          placeholder="Filter suppliers..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-sm"
        />
        {(isAdmin || isStaff) && (
        <Button onClick={handleAddClick}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Supplier
        </Button>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Contact Email</TableHead>
              <TableHead>Reliability</TableHead>
              <TableHead>Portal User</TableHead>
              {(isAdmin || isStaff) && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageIsLoading ? (
                <TableRow>
                    <TableCell colSpan={isAdmin || isStaff ? 5 : 4} className="text-center h-24">
                        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                    </TableCell>
                </TableRow>
            ) : (
                filteredSuppliers.map((supplier) => (
                <TableRow key={supplier.id}>
                    <TableCell className="font-medium">{supplier.name}</TableCell>
                    <TableCell>{supplier.contactEmail || 'N/A'}</TableCell>
                    <TableCell>{((supplier.reliabilityScore || 0) * 100).toFixed(0)}%</TableCell>
                    <TableCell>{userMap.get(supplier.userId || '') || 'N/A'}</TableCell>
                    {(isAdmin || isStaff) && (
                        <TableCell>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => handleEditClick(supplier)}>
                                    <FilePenLine className="mr-2 h-4 w-4" />
                                    Edit
                                </DropdownMenuItem>
                                {isAdmin && <DropdownMenuSeparator />}
                                {isAdmin && <DropdownMenuItem
                                    className="text-red-600"
                                    onClick={() => handleDeleteClick(supplier)}
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                </DropdownMenuItem>}
                            </DropdownMenuContent>
                        </DropdownMenu>
                        </TableCell>
                    )}
                </TableRow>
                ))
            )}
            {!pageIsLoading && filteredSuppliers.length === 0 && (
                <TableRow>
                    <TableCell colSpan={isAdmin || isStaff ? 5 : 4} className="text-center h-24">
                        No suppliers found.
                    </TableCell>
                </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      
       <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedSupplier ? 'Edit' : 'Add'} Supplier</DialogTitle>
            <DialogDescription>
              {selectedSupplier ? 'Update the details of your supplier.' : 'Add a new supplier to your list.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(handleFormSubmit)} className="grid gap-4 py-4">
            <div className="space-y-2">
                <Label htmlFor="name">Supplier Name</Label>
                <Input id="name" {...register("name")} />
                {errors.name && <p className="text-red-500 text-xs">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
                <Label htmlFor="contactEmail">Contact Email</Label>
                <Input id="contactEmail" type="email" {...register("contactEmail")} />
                {errors.contactEmail && <p className="text-red-500 text-xs">{errors.contactEmail.message}</p>}
            </div>
            <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input id="phone" type="tel" {...register("phone")} />
                {errors.phone && <p className="text-red-500 text-xs">{errors.phone.message}</p>}
            </div>
            <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Textarea id="address" {...register("address")} />
                {errors.address && <p className="text-red-500 text-xs">{errors.address.message}</p>}
            </div>
            <div className="space-y-2">
                <Label>Reliability Score: {Math.round((reliabilityScore || 0) * 100)}%</Label>
                 <Controller
                    control={control}
                    name="reliabilityScore"
                    render={({ field: { value, onChange } }) => (
                        <Slider
                            value={[value || 0]}
                            onValueChange={(vals) => onChange(vals[0])}
                            max={1}
                            step={0.05}
                        />
                    )}
                />
                <p className="text-xs text-muted-foreground">0% is very unreliable, 100% is very reliable.</p>
            </div>
             <div className="space-y-2">
                <Label htmlFor="userId">Link to Supplier User</Label>
                <Controller
                  control={control}
                  name="userId"
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value || "none"} disabled={usersLoading}>
                      <SelectTrigger>
                        <SelectValue placeholder={usersLoading ? "Loading..." : "Select a user"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {supplierUsers?.map((u: UserProfile) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.displayName} ({u.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <p className="text-xs text-muted-foreground">Link this entry to a user with the 'Supplier' role for portal access.</p>
              </div>
            <DialogFooter>
              <Button type="submit">Save changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the supplier "{selectedSupplier?.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
