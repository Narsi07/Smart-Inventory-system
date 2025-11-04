
"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { useCollection, useFirestore, useMemoFirebase, useDoc, useUser } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import type { Product, UserProfile, Sale } from "@/types";
import { DollarSign, Archive, ShoppingCart, BrainCircuit, Loader2, PackageX, TrendingUp } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, Line, LineChart, CartesianGrid } from "recharts";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { financialAnalysis } from "@/ai/flows/financial-analysis";
import ReactMarkdown from 'react-markdown';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { subDays, format, startOfDay } from 'date-fns';

export default function FinancialsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [aiAnalysis, setAiAnalysis] = React.useState<string | null>(null);
  const [isAnalysisLoading, setIsAnalysisLoading] = React.useState(false);

  const currentUserProfileDoc = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, `users/${user.uid}`);
  }, [firestore, user]);
  const { data: currentUserProfile, isLoading: isCurrentUserProfileLoading } = useDoc<UserProfile>(currentUserProfileDoc);

  const productsCollection = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, "products");
  }, [firestore]);
  const { data: products, isLoading: productsLoading } = useCollection<Omit<Product, 'id'>>(productsCollection);

  const salesCollection = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, "sales");
  }, [firestore]);
  const { data: sales, isLoading: salesLoading } = useCollection<Omit<Sale, "id">>(salesCollection);

  const productMap = React.useMemo(() => new Map(products?.map(p => [p.id, p]) || []), [products]);

  const pageIsLoading = productsLoading || isCurrentUserProfileLoading || salesLoading;

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

  const financials = React.useMemo(() => {
    if (!products || !sales) return {
      totalInventoryValue: 0,
      potentialProfit: 0,
      averageMargin: 0,
      highestMarginProducts: [],
      inventoryTurnover: 0,
      deadStock: [],
      pnlData: [],
      categoryProfitability: [],
    };
    
    // This check is crucial. If there are no products, all financials should be zero.
    if (products.length === 0) {
        return {
            totalInventoryValue: 0,
            potentialProfit: 0,
            averageMargin: 0,
            highestMarginProducts: [],
            inventoryTurnover: 0,
            deadStock: [],
            pnlData: Array.from({ length: 30 }, (_, i) => {
                const date = subDays(new Date(), 29 - i);
                return { name: format(date, 'MMM d'), revenue: 0, cogs: 0, profit: 0 };
            }),
            categoryProfitability: [],
        };
    }


    const totalInventoryValue = products.reduce((acc, p) => acc + (p.stock * p.costPrice), 0);
    const potentialRevenue = products.reduce((acc, p) => acc + (p.stock * p.sellingPrice), 0);
    const potentialProfit = potentialRevenue - totalInventoryValue;
    
    const totalMargin = products.reduce((acc, p) => {
        if(p.sellingPrice > 0) {
            return acc + ((p.sellingPrice - p.costPrice) / p.sellingPrice);
        }
        return acc;
    }, 0);
    const averageMargin = products.length > 0 ? (totalMargin / products.length) * 100 : 0;

    const highestMarginProducts = products.map(p => ({
        name: p.name,
        margin: p.sellingPrice > 0 ? ((p.sellingPrice - p.costPrice) / p.sellingPrice) * 100 : 0,
        costPrice: p.costPrice,
        sellingPrice: p.sellingPrice,
    })).sort((a,b) => b.margin - a.margin).slice(0, 5);
    
    const thirtyDaysAgo = subDays(new Date(), 30);
    const salesInLast30Days = sales.filter(s => s.saleDate.toDate() > thirtyDaysAgo);
    const costOfGoodsSold = salesInLast30Days.reduce((acc, sale) => {
        const product = productMap.get(sale.productId);
        return acc + (product ? product.costPrice * sale.quantity : 0);
    }, 0);
    
    const averageInventoryValue = totalInventoryValue; // Simplified for this context
    const inventoryTurnover = averageInventoryValue > 0 ? costOfGoodsSold / averageInventoryValue : 0;


    const ninetyDaysAgo = subDays(new Date(), 90);
    const soldProductIdsInLast90Days = new Set(sales.filter(s => s.saleDate.toDate() > ninetyDaysAgo).map(s => s.productId));
    const deadStock = products.filter(p => p.stock > 0 && !soldProductIdsInLast90Days.has(p.id));

    // Initialize map for the last 30 days of P&L data
    const pnlDataMap = new Map<string, { name: string; revenue: number; cogs: number; profit: number }>();
    for (let i = 0; i < 30; i++) {
        const date = subDays(new Date(), 29 - i);
        const dateStr = format(startOfDay(date), 'yyyy-MM-dd');
        pnlDataMap.set(dateStr, { name: format(date, 'MMM d'), revenue: 0, cogs: 0, profit: 0 });
    }

    const thirtyDaysAgoStart = startOfDay(thirtyDaysAgo);

    sales.forEach(sale => {
        const product = productMap.get(sale.productId);
        // Only process sales for products that still exist
        if (!product) return;
        
        const saleDate = sale.saleDate.toDate();
        if (saleDate >= thirtyDaysAgoStart) {
            const saleDateStr = format(startOfDay(saleDate), 'yyyy-MM-dd');
            const dayData = pnlDataMap.get(saleDateStr);
            
            if (dayData) {
                const cogs = product.costPrice * sale.quantity;
                dayData.revenue += sale.totalPrice;
                dayData.cogs += cogs;
                dayData.profit += sale.totalPrice - cogs;
            }
        }
    });

    
    const categoryData: {[key: string]: { revenue: number, profit: number }} = {};
    sales.forEach(sale => {
        const product = productMap.get(sale.productId);
        if (product) {
            if (!categoryData[product.category]) {
                categoryData[product.category] = { revenue: 0, profit: 0 };
            }
            const cogs = product.costPrice * sale.quantity;
            categoryData[product.category].revenue += sale.totalPrice;
            categoryData[product.category].profit += sale.totalPrice - cogs;
        }
    });

    const categoryProfitability = Object.entries(categoryData).map(([name, data]) => ({ name, ...data }));


    return { totalInventoryValue, potentialProfit, averageMargin, highestMarginProducts, inventoryTurnover, deadStock, pnlData: Array.from(pnlDataMap.values()), categoryProfitability };
  }, [products, sales, productMap]);

  React.useEffect(() => {
    if (products && financials.totalInventoryValue > 0 && !aiAnalysis && !isAnalysisLoading && currentUserProfile?.role === 'Admin') {
      const getAnalysis = async () => {
        setIsAnalysisLoading(true);
        try {
          const result = await financialAnalysis({
            totalInventoryValue: financials.totalInventoryValue,
            potentialProfit: financials.potentialProfit,
            averageMargin: financials.averageMargin,
            highestMarginProducts: financials.highestMarginProducts.map(p => ({name: p.name, margin: p.margin})),
          });
          setAiAnalysis(result.analysis);
        } catch (e) {
          console.error("Error generating financial analysis:", e);
          setAiAnalysis("Could not load AI analysis.");
        } finally {
          setIsAnalysisLoading(false);
        }
      };
      getAnalysis();
    } else if (!products || products.length === 0) {
        setAiAnalysis(null);
    }
  }, [products, financials, aiAnalysis, isAnalysisLoading, currentUserProfile]);

  if (pageIsLoading || !currentUserProfile || currentUserProfile.role !== 'Admin') {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      <PageHeader
        title="Financials"
        description="A comprehensive, interactive overview of your inventory's financial health."
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Inventory Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${financials.totalInventoryValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground">Total cost of all products currently in stock.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Potential Profit</CardTitle>
            <Archive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${financials.potentialProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground">Estimated profit if all current inventory is sold.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Profit Margin</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{financials.averageMargin.toFixed(2)}%</div>
            <p className="text-xs text-muted-foreground">Average profit margin across all products.</p>
          </CardContent>
        </Card>
         <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inventory Turnover</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{financials.inventoryTurnover.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Times inventory sold in last 30 days. Higher is better.</p>
          </CardContent>
        </Card>
      </div>

       <Card>
        <CardHeader>
            <CardTitle>Profit &amp; Loss Trend (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
            <ResponsiveContainer width="100%" height={350}>
                <LineChart data={financials.pnlData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(value) => `$${value/1000}k`} />
                    <Tooltip formatter={(value: number, name: string) => [`$${value.toFixed(2)}`, name.charAt(0).toUpperCase() + name.slice(1)]} />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} />
                    <Line type="monotone" dataKey="cogs" name="COGS" stroke="hsl(var(--destructive))" strokeWidth={2} />
                    <Line type="monotone" dataKey="profit" stroke="hsl(var(--accent))" strokeWidth={2} />
                </LineChart>
            </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
            <CardHeader>
                <CardTitle>Category Profitability</CardTitle>
                <CardDescription>Which product categories are driving your profit?</CardDescription>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={financials.categoryProfitability} layout="vertical" margin={{ left: 20, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={80} />
                        <Tooltip formatter={(value: number, name: string) => [`$${value.toFixed(2)}`, name.charAt(0).toUpperCase() + name.slice(1)]} />
                        <Legend />
                        <Bar dataKey="revenue" fill="hsl(var(--secondary))" radius={[0, 4, 4, 0]}/>
                        <Bar dataKey="profit" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]}/>
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
         <Card>
            <CardHeader>
                <CardTitle>Top 5 Highest Margin Products</CardTitle>
                <CardDescription>These products have the highest potential profit margins.</CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={financials.highestMarginProducts}>
                    <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}%`} />
                    <Tooltip
                        cursor={{ fill: 'hsl(var(--muted))' }}
                        content={({ active, payload, label }) =>
                            active && payload && payload.length ? (
                            <div className="rounded-lg border bg-background p-2 shadow-sm">
                                <div className="grid grid-cols-1 gap-1.5">
                                    <p className="text-sm font-medium">{label}</p>
                                    <p className="text-sm text-primary">{`Margin: ${payload[0].value?.toFixed(2)}%`}</p>
                                    <div className="text-xs text-muted-foreground grid grid-cols-2 gap-x-2">
                                        <span>Cost:</span><span className="font-mono text-right">${payload[0].payload.costPrice.toFixed(2)}</span>
                                        <span>Selling:</span><span className="font-mono text-right">${payload[0].payload.sellingPrice.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                            ) : null
                        }
                    />
                    <Bar dataKey="margin" fill="currentColor" radius={[4, 4, 0, 0]} className="fill-primary" />
                </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
      </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center">
                    <PackageX className="mr-2" />
                    Dead Stock Report
                </CardTitle>
                <CardDescription>Products with stock and no sales in the last 90 days.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead>Stock</TableHead>
                            <TableHead className="text-right">Value (Cost)</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {financials.deadStock.length > 0 ? financials.deadStock.map(p => (
                            <TableRow key={p.id}>
                                <TableCell>{p.name}</TableCell>
                                <TableCell>{p.stock}</TableCell>
                                <TableCell className="text-right">${(p.stock * p.costPrice).toFixed(2)}</TableCell>
                            </TableRow>
                        )) : <TableRow><TableCell colSpan={3} className="text-center h-24">No dead stock found. Great job!</TableCell></TableRow>}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center">
                    <BrainCircuit className="mr-2" />
                    AI Financial Analyst
                </CardTitle>
                <CardDescription>An AI-generated analysis of your financial data.</CardDescription>
            </CardHeader>
            <CardContent>
                {isAnalysisLoading && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin"/>
                        <span>Generating analysis...</span>
                    </div>
                )}
                {aiAnalysis && (
                    <div className="text-sm text-muted-foreground prose prose-sm prose-p:my-2 prose-strong:text-foreground prose-ul:list-disc prose-ul:pl-6">
                        <ReactMarkdown>{aiAnalysis}</ReactMarkdown>
                    </div>
                )}
                 {!aiAnalysis && !isAnalysisLoading && financials.totalInventoryValue === 0 && (
                     <div className="text-center text-muted-foreground">No financial data to analyze. Add some products and sales.</div>
                 )}
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
