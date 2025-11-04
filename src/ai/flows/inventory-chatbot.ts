
'use server';
/**
 * @fileOverview An AI-powered chatbot for querying inventory.
 * - inventoryChat - The main chat function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import {
  collection,
  getDocs,
  query,
  where,
  limit,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase/index';
import type { InventoryChatHistory, Part, Product, Supplier, PurchaseOrder } from '@/types';

// Schemas for Tools
const ProductSearchSchema = z.object({
  productName: z.string().describe('The name of the product to search for. e.g., "bananas" or "apples".'),
});

const ProductForAISchema = z.object({
    id: z.string(),
    name: z.string(),
    category: z.string(),
    stock: z.number(),
    reorderPoint: z.number(),
    supplierId: z.string(),
});
const ProductSearchOutputSchema = z.array(ProductForAISchema);

// Internal Zod schema for safe parsing of Firestore data
const FirestoreProductSchema = z.object({
  id: z.string(),
  name: z.string().default(''),
  category: z.string().default(''),
  stock: z.number().default(0),
  reorderPoint: z.number().default(0),
  supplierId: z.string().default(''),
  // All other fields from the Product type are optional for the chatbot's purpose
}).passthrough();


const SupplierSearchSchema = z.object({
    query: z.string().describe('A natural language query about suppliers. For example: "who supplies bananas?" or "what is the contact info for Global Foods?"'),
});

const SupplierSchema = z.object({
    id: z.string(),
    name: z.string(),
    contactEmail: z.string().optional(),
    phone: z.string().optional(),
});
const SupplierSearchOutputSchema = z.array(SupplierSchema);


const PurchaseOrderSearchSchema = z.object({
    query: z.string().describe('A natural language query about purchase orders. For example: "what is the status of the latest PO?" or "show me pending orders"'),
});

const PurchaseOrderSchema = z.object({
    id: z.string(),
    poNumber: z.string(),
    supplierId: z.string(),
    status: z.string(),
    totalCost: z.number(),
    orderDate: z.string(),
});
const PurchaseOrderSearchOutputSchema = z.array(PurchaseOrderSchema);


// Tool Definitions

const searchInventory = ai.defineTool(
  {
    name: 'searchInventory',
    description: 'Search for products in the inventory by name to find their stock levels and other details.',
    inputSchema: ProductSearchSchema,
    outputSchema: ProductSearchOutputSchema,
  },
  async (input) => {
    console.log(`[searchInventory] Received query for: ${input.productName}`);
    const { firestore } = initializeFirebase();
    const productsRef = collection(firestore, 'products');
    
    const querySnapshot = await getDocs(productsRef);
    const products: z.infer<typeof ProductForAISchema>[] = [];

    querySnapshot.docs.forEach(doc => {
      const result = FirestoreProductSchema.safeParse({
        id: doc.id,
        ...doc.data(),
      });
      
      if (result.success) {
        products.push({
            id: result.data.id,
            name: result.data.name,
            category: result.data.category,
            stock: result.data.stock,
            reorderPoint: result.data.reorderPoint,
            supplierId: result.data.supplierId
        });
      } else {
        console.warn(`[searchInventory] Document ${doc.id} failed validation:`, result.error.issues);
      }
    });

    if (input.productName) {
      const lowerCaseQuery = input.productName.toLowerCase();
      return products.filter(p => 
          p.name.toLowerCase().includes(lowerCaseQuery) ||
          p.category.toLowerCase().includes(lowerCaseQuery)
      ).slice(0, 10);
    }
    
    return products.slice(0, 10);
  }
);


const searchSuppliers = ai.defineTool(
    {
        name: 'searchSuppliers',
        description: 'Search for suppliers. Can find suppliers by name, or find the supplier for a specific product.',
        inputSchema: SupplierSearchSchema,
        outputSchema: SupplierSearchOutputSchema,
    },
    async (input) => {
        console.log(`[searchSuppliers] Received query: ${input.query}`);
        const { firestore } = initializeFirebase();
        const lowerCaseQuery = input.query.toLowerCase();
        
        const productsRef = collection(firestore, 'products');
        const productsSnapshot = await getDocs(productsRef);
        const allProducts = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));

        const productMentioned = allProducts.find(p => p.name && lowerCaseQuery.includes(p.name.toLowerCase()));

        let supplierIds: string[] = [];
        if (productMentioned && productMentioned.supplierId) {
            supplierIds.push(productMentioned.supplierId);
        }

        const suppliersRef = collection(firestore, 'suppliers');
        const suppliersSnapshot = await getDocs(suppliersRef);
        const allSuppliers = suppliersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier));

        if (supplierIds.length > 0) {
            return allSuppliers.filter(s => supplierIds.includes(s.id)).map(s => ({
                id: s.id,
                name: s.name,
                contactEmail: s.contactEmail,
                phone: s.phone,
            }));
        }

        return allSuppliers
            .filter(s => s.name && s.name.toLowerCase().includes(lowerCaseQuery))
            .slice(0, 5)
            .map(s => ({
                id: s.id,
                name: s.name,
                contactEmail: s.contactEmail,
                phone: s.phone,
            }));
    }
);

const searchPurchaseOrders = ai.defineTool(
    {
        name: 'searchPurchaseOrders',
        description: 'Search for purchase orders (POs). Can filter by status (Pending, Acknowledged, Shipped, Completed) or search for the latest POs.',
        inputSchema: PurchaseOrderSearchSchema,
        outputSchema: PurchaseOrderSearchOutputSchema,
    },
    async (input) => {
        console.log(`[searchPurchaseOrders] Received query: ${input.query}`);
        const { firestore } = initializeFirebase();
        let poRef = collection(firestore, 'purchaseOrders');
        let q = query(poRef);

        const lowerCaseQuery = input.query.toLowerCase();
        const statusMap = {
            pending: 'Pending',
            acknowledged: 'Acknowledged',
            shipped: 'Shipped',
            completed: 'Completed',
        };

        for (const key in statusMap) {
            if (lowerCaseQuery.includes(key)) {
                q = query(poRef, where('status', '==', statusMap[key as keyof typeof statusMap]));
                break;
            }
        }

        if (lowerCaseQuery.includes('latest') || lowerCaseQuery.includes('recent')) {
            q = query(poRef, orderBy('orderDate', 'desc'), limit(5));
        }

        const querySnapshot = await getDocs(q);

        const toISO = (ts: any): string => {
            if (ts instanceof Timestamp) {
                return new Date(ts.toMillis()).toISOString();
            }
            if (typeof ts === 'string') {
                return ts;
            }
            if (ts && typeof ts.toDate === 'function') {
                return ts.toDate().toISOString();
            }
            if(ts && ts.seconds) {
                return new Date(ts.seconds * 1000).toISOString();
            }
            return new Date().toISOString();
        };

        return querySnapshot.docs.map(doc => {
            const data = doc.data();

            return {
                id: doc.id,
                poNumber: data.poNumber || '',
                supplierId: data.supplierId || '',
                status: data.status || 'Unknown',
                totalCost: data.totalCost || 0,
                orderDate: toISO(data.orderDate),
            };
        }).slice(0, 10);
    }
);


const inventoryChatPrompt = ai.definePrompt({
  name: 'inventoryChatPrompt',
  system: `You are an expert inventory management assistant. Your primary purpose is to answer questions about products, suppliers, and purchase orders by using the tools provided. Do not make up information. If a tool returns no results, say that you couldn't find any information.`,
  tools: [searchInventory, searchSuppliers, searchPurchaseOrders],
  model: 'googleai/gemini-2.5-flash',
});

export async function inventoryChat(history: InventoryChatHistory[]): Promise<Part[]> {
  try {
    const llmResponse = await inventoryChatPrompt({
      history: history.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
    });

    if (!llmResponse || !llmResponse.output || !llmResponse.output.content) {
      console.error("Invalid response from LLM:", llmResponse);
      return [{ text: "Sorry, I couldn't process that. Please try rephrasing your question." }];
    }

    return llmResponse.output.content;
  } catch (error) {
    console.error("Error in inventoryChat flow:", error);
    return [{ text: "Sorry, I encountered an error while communicating with the AI. Please try again later." }];
  }
}

    