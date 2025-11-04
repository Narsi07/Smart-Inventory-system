
import { Timestamp } from "firebase/firestore";
import { z } from 'zod';

export type Product = {
  id: string;
  name: string;
  category: string;
  description?: string;
  stock: number;
  unitOfMeasure: string; // e.g., 'kg', 'item', 'liters'
  location: string;
  reorderPoint: number;
  reorderQuantity: number;
  leadTime: number; // in days
  expirationDate: Timestamp;
  supplierId: string;
  costPrice: number;
  sellingPrice: number;
  purchaseDate: Timestamp;
  owner: string; 
  lifecycle?: 'New' | 'Mature' | 'Declining';
  storageCapacity?: number;
  promotion?: {
    type: string;
    startDate: Timestamp;
    endDate: Timestamp;
  };
};

export type UserProfile = {
    id: string;
    email: string;
    displayName: string;
    role: 'Admin' | 'Staff' | 'Supplier';
    createdAt: Timestamp;
    supplierId?: string;
}

export type Supplier = {
    id: string;
    name: string;
    contactEmail?: string;
    phone?: string;
    address?: string;
    owner: string;
    userId?: string;
    reliabilityScore?: number;
}

export type PurchaseOrder = {
    id: string;
    poNumber: string;
    supplierId: string;
    status: 'Pending' | 'Acknowledged' | 'Shipped' | 'Completed';
    items: {
        productId: string;
        name: string;
        quantity: number;
        costPrice: number;
    }[];
    totalCost: number;
    orderDate: Timestamp;
    expectedDeliveryDate?: Timestamp;
    owner: string;
    acknowledgedAt?: Timestamp;
    shippedAt?: Timestamp;
    shippingCarrier?: string;
    trackingNumber?: string;
}

export const PartSchema = z.object({
  text: z.string(),
});
export type Part = z.infer<typeof PartSchema>;

export const InventoryChatHistorySchema = z.object({
  role: z.enum(['user', 'model']),
  content: z.array(PartSchema),
});
export type InventoryChatHistory = z.infer<typeof InventoryChatHistorySchema>;


export type Sale = {
    id: string;
    productId: string;
    quantity: number;
    totalPrice: number;
    saleDate: Timestamp;
    owner: string;
}
