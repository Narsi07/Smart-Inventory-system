
"use client";
import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, BrainCircuit, Loader2, Bot, FilePlus2, Bell, AlertTriangle, TrendingDown, TrendingUp, PackageX } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from "@/firebase";
import { collection, writeBatch, doc, Timestamp } from "firebase/firestore";
import type { Product, Sale, Supplier, UserProfile, PurchaseOrder } from "@/types";
import { dashboardSummary } from "@/ai/flows/dashboard-summary";
import { intelligentReorderSuggestions } from "@/ai/flows/intelligent-reorder-suggestions";
import ReactMarkdown from 'react-markdown';
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { subDays } from "date-fns";

export default function DashboardPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const userProfileDoc = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, `users/${user.uid}`);
  }, [firestore, user]);
  const { data: userProfile } = useDoc<UserProfile>(userProfileDoc);
  
  const productsCollection = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, "products");
  }, [firestore, user]);

  const { data: products, isLoading: productsLoading } = useCollection<Omit<Product, 'id'>>(productsCollection);
  
  const salesCollection = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, "sales");
  }, [firestore, user]);
  const { data: sales, isLoading: salesLoading } = useCollection<Omit<Sale, "id">>(salesCollection);

  const suppliersCollection = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'suppliers');
  }, [firestore, user]);
  const { data: suppliers = [] } = useCollection<Omit<Supplier, 'id'>>(suppliersCollection);
  const supplierMap = React.useMemo(() => new Map(suppliers?.map(s => [s.id, s]) || []), [suppliers]);

  const [summary, setSummary] = React.useState<string | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = React.useState(false);
  const [salesVelocityMap, setSalesVelocityMap] = React.useState<Map<string, number>>(new Map());
  const [salesTrendMap, setSalesTrendMap] = React.useState<Map<string, number>>(new Map());
  const [isDraftingPos, setIsDraftingPos] = React.useState(false);


   React.useEffect(() => {
    const calculateAllVelocities = () => {
      if (products && sales) {
        const newVelocityMap = new Map<string, number>();
        const newTrendMap = new Map<string, number>();

        for (const product of products) {
          const productSales = sales
            .filter(s => s.productId === product.id)
            .map(s => ({
              saleDate: s.saleDate.toDate(),
              quantity: s.quantity,
            }))
            .sort((a, b) => a.saleDate.getTime() - b.saleDate.getTime());

          if (productSales.length > 1) {
            const firstSale = productSales[0];
            const lastSale = productSales[productSales.length - 1];
            const totalQuantity = productSales.reduce((sum, s) => sum + s.quantity, 0);
            
            const timeDiff = lastSale.saleDate.getTime() - firstSale.saleDate.getTime();
            const days = Math.max(1, timeDiff / (1000 * 3600 * 24));
            const velocity = totalQuantity / days;
            newVelocityMap.set(product.id, velocity);

            // Trend calculation
            const midPoint = Math.floor(productSales.length / 2);
            const firstHalf = productSales.slice(0, midPoint);
            const secondHalf = productSales.slice(midPoint);

            const firstHalfAvg = firstHalf.reduce((sum, s) => sum + s.quantity, 0) / (firstHalf.length || 1);
            const secondHalfAvg = secondHalf.reduce((sum, s) => sum + s.quantity, 0) / (secondHalf.length || 1);

            if (firstHalfAvg > 0) {
              const trend = (secondHalfAvg - firstHalfAvg) / firstHalfAvg;
              newTrendMap.set(product.id, Math.max(-1, Math.min(1, trend)));
            } else {
              newTrendMap.set(product.id, secondHalfAvg > 0 ? 1 : 0);
            }
          } else {
            newVelocityMap.set(product.id, productSales.length > 0 ? productSales[0].quantity : 0);
            newTrendMap.set(product.id, 0);
          }
        }
        setSalesVelocityMap(newVelocityMap);
        setSalesTrendMap(newTrendMap);
      }
    };
    calculateAllVelocities();
  }, [products, sales]);
  

  const lowStockProducts = React.useMemo(() => 
    products
      ? products
          .filter((p) => p.stock <= p.reorderPoint)
          .sort((a, b) => a.stock - b.stock)
      : [], 
  [products]);
  
  const outOfStockCount = React.useMemo(() => 
    products ? products.filter((p) => p.stock === 0).length : 0, 
  [products]);

  const chartData = React.useMemo(() => 
    products ? products.slice(0, 7).map(product => ({
      name: product.name.split(" ")[0],
      total: product.stock,
    })) : [],
  [products]);

  React.useEffect(() => {
    if (products && products.length > 0 && salesVelocityMap.size > 0 && !summary && !isSummaryLoading) {
      const getSummary = async () => {
        setIsSummaryLoading(true);
        try {
          const result = await dashboardSummary({
            products: products.map(p => ({
              id: p.id,
              name: p.name,
              stock: p.stock,
              reorderPoint: p.reorderPoint,
              salesVelocity: salesVelocityMap.get(p.id) || 0,
              costPrice: p.costPrice,
              sellingPrice: p.sellingPrice,
            })),
            totalProducts: products.length,
            lowStockCount: lowStockProducts.length,
            outOfStockCount,
          });
          setSummary(result.summary);
        } catch (e) {
          console.error("Error generating dashboard summary:", e);
          setSummary("Could not load AI summary.");
        } finally {
          setIsSummaryLoading(false);
        }
      };
      getSummary();
    }
  }, [products, lowStockProducts, outOfStockCount, summary, isSummaryLoading, salesVelocityMap]);
  
  const handleDraftPOs = async () => {
    if (!firestore || !user || lowStockProducts.length === 0) return;
    setIsDraftingPos(true);
    
    const productsToReorder = lowStockProducts.map(p => {
        const supplier = supplierMap.get(p.supplierId);
        return {
            productId: p.id,
            currentStockLevel: p.stock,
            demandForecast: (salesVelocityMap.get(p.id) || 0) * (p.leadTime || 7),
            reorderPoint: p.reorderPoint,
            reorderQuantity: p.reorderQuantity,
            leadTime: p.leadTime,
            salesVelocity: salesVelocityMap.get(p.id) || 0,
            salesVelocityTrend: salesTrendMap.get(p.id) || 0,
            supplierReliability: supplier?.reliabilityScore,
            storageCapacity: p.storageCapacity,
        }
    });

    try {
        const result = await intelligentReorderSuggestions({ products: productsToReorder });
        
        const posBySupplier: Record<string, Partial<PurchaseOrder>> = {};

        for (const suggestion of result.suggestions) {
            if (!suggestion.reorderSuggestion || suggestion.reorderQuantity <= 0) continue;
            
            const product = lowStockProducts.find(p => p.id === suggestion.productId);
            if (!product) continue;
            
            const supplierId = product.supplierId;
            if (!posBySupplier[supplierId]) {
                posBySupplier[supplierId] = {
                    supplierId: supplierId,
                    status: 'Pending',
                    items: [],
                    totalCost: 0,
                    owner: user.uid,
                };
            }
            
            const itemCost = product.costPrice * suggestion.reorderQuantity;
            posBySupplier[supplierId].items!.push({
                productId: product.id,
                name: product.name,
                quantity: suggestion.reorderQuantity,
                costPrice: product.costPrice,
            });
            posBySupplier[supplierId].totalCost! += itemCost;
        }

        if (Object.keys(posBySupplier).length === 0) {
            toast({ title: "No Reorders Needed", description: "AI analysis determined no reorders are currently required." });
            setIsDraftingPos(false);
            return;
        }

        const batch = writeBatch(firestore);
        const poCount = Object.keys(posBySupplier).length;
        let currentPoIndex = 0;
        for (const supplierId in posBySupplier) {
            const poData = posBySupplier[supplierId];
            const poRef = doc(collection(firestore, 'purchaseOrders'));
            batch.set(poRef, {
                ...poData,
                poNumber: `PO-${Date.now()}-${currentPoIndex++}`,
                orderDate: Timestamp.now(),
            });
        }
        
        await batch.commit();

        toast({
            title: "Purchase Orders Drafted",
            description: `${poCount} draft PO(s) have been created.`,
            action: (
                <Button variant="outline" size="sm" onClick={() => router.push('/purchase-orders')}>
                    View POs
                </Button>
            ),
        });

    } catch (error) {
        console.error("Error drafting POs:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not draft purchase orders." });
    } finally {
        setIsDraftingPos(false);
    }
  };


  const isLoading = productsLoading || salesLoading;

  if (isLoading) {
      return (
          <div className="flex h-screen items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
      )
  }

  const isStaffOrAdmin = userProfile?.role === 'Admin' || userProfile?.role === 'Staff';


  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      <PageHeader
        title="Dashboard"
        description="Get a quick overview of your inventory status."
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="lg:col-span-2">
            <CardHeader>
                <CardTitle className="flex items-center">
                    <BrainCircuit className="mr-2" />
                    AI-Powered Summary
                </CardTitle>
                <CardDescription>An intelligent overview of your inventory.</CardDescription>
            </CardHeader>
            <CardContent>
                {isSummaryLoading && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin"/>
                        <span>Generating insights...</span>
                    </div>
                )}
                {summary && (
                    <div className="text-sm text-muted-foreground prose prose-sm prose-p:my-0 prose-strong:text-foreground">
                        <ReactMarkdown>{summary}</ReactMarkdown>
                    </div>
                )}
            </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Products
            </CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <rect width="20" height="14" x="2" y="5" rx="2" />
              <path d="M2 10h20" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{products?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              Unique products in inventory
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Items Low on Stock
            </CardTitle>
             <PackageX
              className="h-4 w-4 text-muted-foreground"
            />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lowStockProducts.length}</div>
            <p className="text-xs text-muted-foreground">
              Products at or below their reorder point.
            </p>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-full lg:col-span-4">
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={chartData}>
                <XAxis
                  dataKey="name"
                  stroke="#888888"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#888888"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${value}`}
                />
                <Bar dataKey="total" fill="currentColor" radius={[4, 4, 0, 0]} className="fill-primary" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="col-span-full lg:col-span-3">
          <CardHeader>
            <div className="flex items-center justify-between">
                <div>
                    <CardTitle>Low Stock Products</CardTitle>
                    <CardDescription>
                      Products at or below their reorder point.
                    </CardDescription>
                </div>
                {isStaffOrAdmin && (
                <Button size="sm" onClick={handleDraftPOs} disabled={isDraftingPos || lowStockProducts.length === 0}>
                    {isDraftingPos ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FilePlus2 className="mr-2 h-4 w-4" />}
                    Draft POs
                </Button>
                )}
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lowStockProducts.slice(0, 5).map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div className="font-medium">{product.name}</div>
                      <div className="text-sm text-muted-foreground">
                        Reorder at {product.reorderPoint}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end">
                        <span className={product.stock === 0 ? 'text-destructive font-bold' : ''}>{product.stock}</span>
                        <Progress value={(product.stock / product.reorderPoint) * 100} className="w-24 h-2 mt-1" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                 {lowStockProducts.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={2} className="h-24 text-center">No products are low on stock.</TableCell>
                    </TableRow>
                 )}
              </TableBody>
            </Table>
            {lowStockProducts.length > 5 && (
              <div className="pt-4 text-center">
                 <Button asChild variant="outline" size="sm">
                  <Link href="/inventory">
                     View All ({lowStockProducts.length})
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
