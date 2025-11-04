
"use client";

import * as React from "react";
import { collection, query, where, Timestamp, doc } from "firebase/firestore";
import { useCollection, useFirestore, useUser, useMemoFirebase, useDoc } from "@/firebase";
import { updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import type { PurchaseOrder, UserProfile } from "@/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { Loader2, Check, Truck, PackageOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";

export default function SupplierDashboardPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const userProfileDoc = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, `users/${user.uid}`);
  }, [firestore, user]);
  const { data: userProfile } = useDoc<UserProfile>(userProfileDoc);

  const poCollection = useMemoFirebase(() => {
    if (!firestore || !userProfile?.supplierId) return null;
    return query(
      collection(firestore, "purchaseOrders"),
      where("supplierId", "==", userProfile.supplierId)
    );
  }, [firestore, userProfile]);
  const { data: purchaseOrders, isLoading: posLoading } = useCollection<Omit<PurchaseOrder, "id">>(poCollection);
  
  const [selectedPo, setSelectedPo] = React.useState<PurchaseOrder | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = React.useState(false);
  const [isShippingOpen, setIsShippingOpen] = React.useState(false);
  const [shippingCarrier, setShippingCarrier] = React.useState("");
  const [trackingNumber, setTrackingNumber] = React.useState("");


  const handleViewDetails = (po: PurchaseOrder) => {
    setSelectedPo(po);
    setIsDetailsOpen(true);
  };
  
  const handleAcknowledge = (poId: string) => {
    if (!firestore) return;
    const poRef = doc(firestore, "purchaseOrders", poId);
    updateDocumentNonBlocking(poRef, {
      status: "Acknowledged",
      acknowledgedAt: Timestamp.now(),
    });
    toast({ title: "Success", description: "Order acknowledged." });
    setIsDetailsOpen(false);
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

  const getStatusBadge = (status: PurchaseOrder['status']) => {
    switch (status) {
      case "Pending": return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case "Acknowledged": return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Acknowledged</Badge>;
      case "Shipped": return <Badge variant="secondary" className="bg-blue-200 text-blue-800">Shipped</Badge>;
      case "Completed": return <Badge variant="secondary" className="bg-green-200 text-green-800">Completed</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const sortedPurchaseOrders = React.useMemo(() => 
    purchaseOrders ? [...purchaseOrders].sort((a,b) => b.orderDate.toMillis() - a.orderDate.toMillis()) : [],
  [purchaseOrders]);

  return (
    <>
      <PageHeader
        title="Supplier Dashboard"
        description="View and manage your incoming purchase orders."
      />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PO Number</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Order Date</TableHead>
              <TableHead>Expected Delivery</TableHead>
              <TableHead className="text-right">Total Value</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {posLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /></TableCell></TableRow>
            ) : (
              sortedPurchaseOrders.map((po) => (
                <TableRow key={po.id}>
                  <TableCell className="font-medium">{po.poNumber}</TableCell>
                  <TableCell>{getStatusBadge(po.status)}</TableCell>
                  <TableCell>{po.orderDate.toDate().toLocaleDateString()}</TableCell>
                  <TableCell>{po.expectedDeliveryDate?.toDate().toLocaleDateString() || 'N/A'}</TableCell>
                  <TableCell className="text-right">${po.totalCost.toFixed(2)}</TableCell>
                  <TableCell className="space-x-2">
                    <Button variant="outline" size="sm" onClick={() => handleViewDetails(po)}>
                       <PackageOpen className="mr-2 h-4 w-4" /> View Details
                    </Button>
                    {po.status === "Acknowledged" && (
                        <Button variant="outline" size="sm" onClick={() => handleOpenShippingDialog(po)}>
                            <Truck className="mr-2 h-4 w-4"/> Mark as Shipped
                        </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
            {!posLoading && sortedPurchaseOrders.length === 0 && (
                <TableRow>
                    <TableCell colSpan={6} className="text-center h-24">You have no purchase orders.</TableCell>
                </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Purchase Order Details</DialogTitle>
            <DialogDescription>PO Number: {selectedPo?.poNumber}</DialogDescription>
          </DialogHeader>
          {selectedPo && (
            <div>
              <div className="rounded-md border my-4">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Product Name</TableHead>
                            <TableHead className="text-right">Quantity</TableHead>
                            <TableHead className="text-right">Unit Cost</TableHead>
                            <TableHead className="text-right">Total Cost</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {selectedPo.items.map((item, index) => (
                            <TableRow key={index}>
                                <TableCell>{item.name}</TableCell>
                                <TableCell className="text-right">{item.quantity}</TableCell>
                                <TableCell className="text-right">${item.costPrice.toFixed(2)}</TableCell>
                                <TableCell className="text-right">${(item.quantity * item.costPrice).toFixed(2)}</TableCell>
                            </TableRow>
                        ))}
                         <TableRow className="font-bold">
                            <TableCell colSpan={3} className="text-right">Grand Total</TableCell>
                            <TableCell className="text-right">${selectedPo.totalCost.toFixed(2)}</TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
              </div>
            </div>
          )}
          <DialogFooter>
             <Button variant="outline" onClick={() => setIsDetailsOpen(false)}>Close</Button>
            {selectedPo?.status === "Pending" && (
              <Button onClick={() => handleAcknowledge(selectedPo.id)}>
                <Check className="mr-2 h-4 w-4" />
                Acknowledge Order
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
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

    </>
  );
}
