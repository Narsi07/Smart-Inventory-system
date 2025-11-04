
"use client";

import * as React from "react";
import {
  collection,
  doc,
  Timestamp,
  writeBatch,
  increment,
} from "firebase/firestore";
import { useCollection, useFirestore, useUser, useMemoFirebase, useDoc } from "@/firebase";
import {
  addDocumentNonBlocking,
  deleteDocumentNonBlocking,
  updateDocumentNonBlocking,
} from "@/firebase/non-blocking-updates";
import type { PurchaseOrder, Supplier, Product, UserProfile } from "@/types";
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
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import {
  MoreHorizontal,
  PlusCircle,
  Loader2,
  Trash2,
  CheckCircle,
  Truck,
  Check,
} from "lucide-react";
import { useFieldArray, useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const poItemSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
});

const poSchema = z.object({
  supplierId: z.string().min(1, "Supplier is required"),
  items: z.array(poItemSchema).min(1, "At least one item is required"),
  expectedDeliveryDate: z.string().optional(),
});

export default function PurchaseOrdersPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const userProfileDoc = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, `users/${user.uid}`);
  }, [firestore, user]);
  const { data: userProfile } = useDoc<UserProfile>(userProfileDoc);

  const poCollection = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, "purchaseOrders");
  }, [firestore, user]);
  const { data: purchaseOrders, isLoading: posLoading } = useCollection<Omit<PurchaseOrder, "id">>(poCollection);

  const suppliersCollection = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, "suppliers");
  }, [firestore, user]);
  const { data: suppliers, isLoading: suppliersLoading } = useCollection<Omit<Supplier, "id">>(suppliersCollection);
  
  const productsCollection = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, "products");
  }, [firestore, user]);
  const { data: products, isLoading: productsLoading } = useCollection<Omit<Product, 'id'>>(productsCollection);

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = React.useState(false);
  const [isShippingOpen, setIsShippingOpen] = React.useState(false);
  const [selectedPo, setSelectedPo] = React.useState<PurchaseOrder | null>(null);
  const [shippingCarrier, setShippingCarrier] = React.useState("");
  const [trackingNumber, setTrackingNumber] = React.useState("");

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<z.infer<typeof poSchema>>({
    resolver: zodResolver(poSchema),
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  const supplierMap = React.useMemo(() => new Map(suppliers?.map(s => [s.id, s.name]) || []), [suppliers]);
  const productMap = React.useMemo(() => new Map(products?.map(p => [p.id, p]) || []), [products]);

  const handleAddClick = () => {
    reset({
      supplierId: "",
      items: [{ productId: "", quantity: 1 }],
      expectedDeliveryDate: "",
    });
    setIsFormOpen(true);
  };
  
  const handleFormSubmit = (data: z.infer<typeof poSchema>) => {
    if (!firestore || !user) return;
    
    const totalCost = data.items.reduce((acc, item) => {
        const product = productMap.get(item.productId);
        return acc + (product?.costPrice || 0) * item.quantity;
    }, 0);

    const poNumber = `PO-${Date.now()}`;

    const poData = {
        ...data,
        poNumber,
        status: 'Pending' as const,
        items: data.items.map(item => {
            const product = productMap.get(item.productId);
            return {
                productId: item.productId,
                name: product?.name || 'Unknown',
                quantity: item.quantity,
                costPrice: product?.costPrice || 0,
            }
        }),
        totalCost,
        orderDate: Timestamp.now(),
        expectedDeliveryDate: data.expectedDeliveryDate ? Timestamp.fromDate(new Date(data.expectedDeliveryDate)) : undefined,
        owner: user.uid,
    };

    addDocumentNonBlocking(collection(firestore, 'purchaseOrders'), poData);
    setIsFormOpen(false);
    toast({ title: "Success", description: "Purchase order created." });
  };

  const handleDeleteClick = (po: PurchaseOrder) => {
    setSelectedPo(po);
    setIsDeleteConfirmOpen(true);
  };
  
  const confirmDelete = () => {
    if (selectedPo && firestore) {
      const docRef = doc(firestore, 'purchaseOrders', selectedPo.id);
      deleteDocumentNonBlocking(docRef);
      toast({ title: "Success", description: `PO #${selectedPo.poNumber} deleted.` });
    }
    setIsDeleteConfirmOpen(false);
    setSelectedPo(null);
  };
  
  const handleAcknowledge = (poId: string) => {
    if (!firestore) return;
    const poRef = doc(firestore, "purchaseOrders", poId);
    updateDocumentNonBlocking(poRef, {
      status: "Acknowledged",
      acknowledgedAt: Timestamp.now(),
    });
    toast({ title: "Success", description: "Order acknowledged." });
  };

  const handleOpenShippingDialog = (po: PurchaseOrder) => {
    setSelectedPo(po);
    setShippingCarrier(po.shippingCarrier || "");
    setTrackingNumber(po.trackingNumber || "");
    setIsShippingOpen(true);
  };

  const handleMarkAsShipped = () => {
    if (!firestore || !selectedPo) return;
    const poRef = doc(firestore, "purchaseOrders", selectedPo.id);
    updateDocumentNonBlocking(poRef, {
      status: "Shipped",
      shippedAt: Timestamp.now(),
      shippingCarrier,
      trackingNumber,
    });
    toast({ title: "Success", description: "Order marked as shipped." });
    setIsShippingOpen(false);
  };

  const markAsCompleted = async (po: PurchaseOrder) => {
      if (!firestore) return;

      const batch = writeBatch(firestore);

      const poRef = doc(firestore, "purchaseOrders", po.id);
      batch.update(poRef, { status: "Completed" });

      po.items.forEach(item => {
        const productRef = doc(firestore, "products", item.productId);
        batch.update(productRef, { stock: increment(item.quantity) });
      });

      try {
        await batch.commit();
        toast({ 
          title: "Success", 
          description: `PO #${po.poNumber} completed. Stock levels updated.` 
        });
      } catch (error) {
        console.error("Error completing PO:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Could not complete the purchase order. Please try again."
        });
      }
  };

  const getStatusBadge = (status: PurchaseOrder['status']) => {
    switch (status) {
      case "Pending": return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case "Acknowledged": return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Acknowledged</Badge>;
      case "Shipped": return <Badge variant="secondary" className="bg-cyan-100 text-cyan-800">Shipped</Badge>;
      case "Completed": return <Badge variant="secondary" className="bg-green-200 text-green-800">Completed</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  const isAdmin = userProfile?.role === 'Admin';
  const isStaff = userProfile?.role === 'Staff';
  const isLoading = posLoading || suppliersLoading || productsLoading;

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader
        title="Purchase Orders"
        description="Create and manage your purchase orders."
      />

      <div className="flex items-center justify-between">
        <div></div>
        {(isAdmin || isStaff) && (
        <Button onClick={handleAddClick}>
          <PlusCircle className="mr-2 h-4 w-4" />
          New Purchase Order
        </Button>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PO Number</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Order Date</TableHead>
              <TableHead>Tracking</TableHead>
              <TableHead className="text-right">Total Cost</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /></TableCell></TableRow>
            ) : (
              purchaseOrders && purchaseOrders.map((po) => (
                <TableRow key={po.id}>
                  <TableCell className="font-medium">{po.poNumber}</TableCell>
                  <TableCell>{supplierMap.get(po.supplierId) || 'Unknown Supplier'}</TableCell>
                  <TableCell>{getStatusBadge(po.status)}</TableCell>
                  <TableCell>{po.orderDate.toDate().toLocaleDateString()}</TableCell>
                   <TableCell>
                    {po.trackingNumber ? (
                      <a href="#" className="underline text-blue-600 hover:text-blue-800">{po.shippingCarrier}: {po.trackingNumber}</a>
                    ) : 'N/A'}
                  </TableCell>
                  <TableCell className="text-right">${po.totalCost.toFixed(2)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0" disabled={!(isAdmin || isStaff)}>
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        {po.status === 'Pending' && (
                            <DropdownMenuItem onClick={() => handleAcknowledge(po.id)}>
                                <Check className="mr-2 h-4 w-4" />
                                Acknowledge
                            </DropdownMenuItem>
                        )}
                        {po.status === 'Acknowledged' && (
                            <DropdownMenuItem onClick={() => handleOpenShippingDialog(po)}>
                                <Truck className="mr-2 h-4 w-4" />
                                Mark as Shipped
                            </DropdownMenuItem>
                        )}
                        {po.status === 'Shipped' && (
                            <DropdownMenuItem onClick={() => markAsCompleted(po)}>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Mark as Completed
                            </DropdownMenuItem>
                        )}
                        {isAdmin && po.status !== 'Completed' && <DropdownMenuSeparator />}
                        {isAdmin && (
                          <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => handleDeleteClick(po)}
                          >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Purchase Order</DialogTitle>
            <DialogDescription>Create a new PO for a supplier.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(handleFormSubmit)} className="grid gap-6 py-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="supplierId">Supplier</Label>
                    <Controller
                        control={control}
                        name="supplierId"
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} defaultValue={field.value} disabled={suppliersLoading}>
                            <SelectTrigger><SelectValue placeholder="Select a supplier..." /></SelectTrigger>
                            <SelectContent>{suppliers?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                            </Select>
                        )}
                    />
                    {errors.supplierId && <p className="text-red-500 text-xs">{errors.supplierId.message}</p>}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="expectedDeliveryDate">Expected Delivery Date</Label>
                    <Input id="expectedDeliveryDate" type="date" {...register("expectedDeliveryDate")} />
                </div>
            </div>

            <div className="space-y-4">
              <Label>Items</Label>
              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-2 items-end">
                    <div className="flex-1">
                        <Label htmlFor={`items.${index}.productId`} className="text-xs">Product</Label>
                         <Controller
                            control={control}
                            name={`items.${index}.productId`}
                            render={({ field }) => (
                                <Select onValueChange={field.onChange} defaultValue={field.value} disabled={productsLoading}>
                                <SelectTrigger><SelectValue placeholder="Select product..." /></SelectTrigger>
                                <SelectContent>{products?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                                </Select>
                            )}
                        />
                    </div>
                    <div className="w-24">
                        <Label htmlFor={`items.${index}.quantity`} className="text-xs">Quantity</Label>
                        <Input id={`items.${index}.quantity`} type="number" {...register(`items.${index}.quantity`)} />
                    </div>
                    <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
              ))}
              {errors.items && <p className="text-red-500 text-xs">{errors.items.message || errors.items.root?.message}</p>}
              <Button type="button" variant="outline" size="sm" onClick={() => append({ productId: "", quantity: 1 })}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Item
              </Button>
            </div>
            
            <DialogFooter>
              <Button type="submit">Create Purchase Order</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete PO #{selectedPo?.poNumber}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isShippingOpen} onOpenChange={setIsShippingOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Mark as Shipped</DialogTitle>
                <DialogDescription>Provide shipping details for PO #{selectedPo?.poNumber}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="space-y-2">
                    <Label htmlFor="shippingCarrier">Shipping Carrier</Label>
                    <Input id="shippingCarrier" value={shippingCarrier} onChange={(e) => setShippingCarrier(e.target.value)} placeholder="e.g., UPS, FedEx" />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="trackingNumber">Tracking Number</Label>
                    <Input id="trackingNumber" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="e.g., 1Z9999999999999999" />
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsShippingOpen(false)}>Cancel</Button>
                <Button onClick={handleMarkAsShipped}>
                    <Truck className="mr-2 h-4 w-4" /> Save and Mark as Shipped
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
