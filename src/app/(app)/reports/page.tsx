
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
import { PageHeader } from "@/components/page-header";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { useCollection, useFirestore, useMemoFirebase, useUser } from "@/firebase";
import { collection } from "firebase/firestore";
import type { Product, Supplier, Sale } from "@/types";
import { Loader2 } from "lucide-react";

export default function ReportsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  
  const productsCollection = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, "products");
  }, [firestore, user]);
  const { data: products, isLoading: productsLoading } = useCollection<Omit<Product, 'id'>>(productsCollection);

  const suppliersCollection = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, "suppliers");
  }, [firestore, user]);
  const { data: suppliers, isLoading: suppliersLoading } = useCollection<Omit<Supplier, 'id'>>(suppliersCollection);

  const salesCollection = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, "sales");
  }, [firestore, user]);
  const { data: sales, isLoading: salesLoading } = useCollection<Omit<Sale, "id">>(salesCollection);
  
  const [salesVelocityMap, setSalesVelocityMap] = React.useState<Map<string, number>>(new Map());

  const isLoading = productsLoading || suppliersLoading || salesLoading;

  React.useEffect(() => {
    if (products && sales) {
      const newMap = new Map<string, number>();
      for (const product of products) {
        const productSales = sales.filter(s => s.productId === product.id);
        if (productSales.length > 1) {
          const sortedSales = productSales.sort((a,b) => a.saleDate.toMillis() - b.saleDate.toMillis());
          const firstSale = sortedSales[0];
          const lastSale = sortedSales[sortedSales.length - 1];
          const totalQuantity = sortedSales.reduce((sum, s) => sum + s.quantity, 0);

          const timeDiff = lastSale.saleDate.toMillis() - firstSale.saleDate.toMillis();
          const days = Math.max(1, timeDiff / (1000 * 3600 * 24));
          newMap.set(product.id, totalQuantity / days);
        } else if (productSales.length === 1) {
            newMap.set(product.id, productSales[0].quantity);
        } else {
            newMap.set(product.id, 0);
        }
      }
      setSalesVelocityMap(newMap);
    }
  }, [products, sales]);
  
  const reportsData = React.useMemo(() => {
    if (!products || !sales) return {
      salesVelocityData: [],
      profitabilityData: [],
      inventoryValueData: [],
    };

    const salesVelocityData = products
      .map(p => ({ 
          name: p.name, 
          velocity: salesVelocityMap.get(p.id) || 0 
      }))
      .filter(p => p.velocity > 0)
      .sort((a, b) => b.velocity - a.velocity)
      .slice(0, 10);
      
    const productSales = new Map<string, { totalRevenue: number, totalCost: number }>();
    sales.forEach(sale => {
        const product = products.find(p => p.id === sale.productId);
        if (product) {
            const saleData = productSales.get(product.id) || { totalRevenue: 0, totalCost: 0 };
            saleData.totalRevenue += sale.totalPrice;
            saleData.totalCost += product.costPrice * sale.quantity;
            productSales.set(product.id, saleData);
        }
    });

    const profitabilityData = Array.from(productSales.entries()).map(([productId, data]) => {
        const product = products.find(p => p.id === productId);
        return {
            name: product?.name || 'Unknown',
            profit: data.totalRevenue - data.totalCost,
        }
    })
    .sort((a,b) => b.profit - a.profit)
    .slice(0, 5);

    const inventoryValueData = products.map(p => ({
        name: p.name,
        value: p.stock * p.costPrice,
    }))
    .sort((a,b) => b.value - a.value)
    .slice(0, 10);

    return { salesVelocityData, profitabilityData, inventoryValueData };

  }, [products, sales, salesVelocityMap]);


  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader
        title="Legacy Reports"
        description="Analyze your inventory data with these reports."
      />
      <div className="grid gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Sales Velocity</CardTitle>
            <CardDescription>
              Top 10 fastest-selling products (units sold per day).
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            {reportsData.salesVelocityData.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                <BarChart data={reportsData.salesVelocityData}>
                    <XAxis
                    dataKey="name"
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    interval={0}
                    />
                    <YAxis
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    />
                    <Tooltip
                    cursor={{ fill: 'hsl(var(--muted))' }}
                    content={({ active, payload, label }) =>
                        active && payload && payload.length ? (
                        <div className="rounded-lg border bg-background p-2 shadow-sm">
                            <div className="grid grid-cols-1 gap-1">
                            <p className="text-sm font-medium">{label}</p>
                            <p className="text-sm text-muted-foreground">
                                {`Sales Velocity: ${(payload[0].value as number).toFixed(2)}`}
                            </p>
                            </div>
                        </div>
                        ) : null
                    }
                    />
                    <Bar dataKey="velocity" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
                </ResponsiveContainer>
            ) : (
                <div className="flex flex-col items-center justify-center h-[350px]">
                    <p className="text-muted-foreground">No sales data available to calculate velocity.</p>
                </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-8 md:grid-cols-2">
            <Card>
                <CardHeader>
                    <CardTitle>Top 5 Profitable Products</CardTitle>
                    <CardDescription>Products generating the most profit.</CardDescription>
                </CardHeader>
                <CardContent>
                    {reportsData.profitabilityData.length > 0 ? (
                         <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={reportsData.profitabilityData} layout="vertical">
                                <XAxis type="number" stroke="#888888" fontSize={12} tickFormatter={(value) => `$${value}`} />
                                <YAxis type="category" dataKey="name" stroke="#888888" fontSize={12} width={80} interval={0} />
                                <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                                <Bar dataKey="profit" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
                            </BarChart>
                         </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-[300px]">
                            <p className="text-muted-foreground">No sales data to calculate profitability.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Inventory Value Report</CardTitle>
                    <CardDescription>Total value (cost price) of current stock.</CardDescription>
                </CardHeader>
                <CardContent>
                     {reportsData.inventoryValueData.length > 0 ? (
                         <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={reportsData.inventoryValueData} layout="vertical">
                                <XAxis type="number" stroke="#888888" fontSize={12} tickFormatter={(value) => `$${value/1000}k`} />
                                <YAxis type="category" dataKey="name" stroke="#888888" fontSize={12} width={80} interval={0} />
                                <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                                <Bar dataKey="value" fill="hsl(var(--secondary-foreground))" radius={[0, 4, 4, 0]} />
                            </BarChart>
                         </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-[300px]">
                            <p className="text-muted-foreground">No inventory to report value.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Supplier Report</CardTitle>
            <CardDescription>
              Products grouped by their supplier.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {suppliers && suppliers.map(supplier => (
                <div key={supplier.id}>
                  <h3 className="text-lg font-semibold mb-2">{supplier.name}</h3>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Your Stock</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {products && products.filter(p => p.supplierId === supplier.id).length > 0 ? (
                            products.filter(p => p.supplierId === supplier.id).map(product => (
                            <TableRow key={product.id}>
                                <TableCell className="font-medium">{product.name}</TableCell>
                                <TableCell>{product.category}</TableCell>
                                <TableCell className="text-right">{product.stock}</TableCell>
                            </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={3} className="h-24 text-center">
                                    No products from this supplier.
                                </TableCell>
                            </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}
              {suppliers && suppliers.length === 0 && (
                 <div className="flex flex-col items-center justify-center h-24">
                    <p className="text-muted-foreground">No suppliers found.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
