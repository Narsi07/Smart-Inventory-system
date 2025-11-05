
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
import { useCollection, useFirestore, useMemoFirebase, useUser } from "@/firebase";
import { collection } from "firebase/firestore";
import type { Product, Sale } from "@/types";
import { Loader2, DollarSign, Package } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function SalesReportPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  
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

  const isLoading = productsLoading || salesLoading;

  const productMap = React.useMemo(() => {
    if (!products) return new Map();
    return new Map(products.map(p => [p.id, p]));
  }, [products]);

  const analytics = React.useMemo(() => {
    if (!sales || !products) {
      return {
        totalRevenue: 0,
        totalUnitsSold: 0,
        topSellingProductsByRevenue: [],
        topSellingProductsByUnits: [],
        recentSales: [],
      };
    }
    
    // Filter out sales for products that no longer exist
    const validSales = sales.filter(sale => productMap.has(sale.productId));

    const totalRevenue = validSales.reduce((acc, sale) => acc + sale.totalPrice, 0);
    const totalUnitsSold = validSales.reduce((acc, sale) => acc + sale.quantity, 0);

    const productSales = new Map<string, { revenue: number; units: number }>();

    validSales.forEach(sale => {
      const existing = productSales.get(sale.productId) || { revenue: 0, units: 0 };
      existing.revenue += sale.totalPrice;
      existing.units += sale.quantity;
      productSales.set(sale.productId, existing);
    });

    const topSellingProductsByRevenue = Array.from(productSales.entries())
      .map(([productId, data]) => ({ name: productMap.get(productId)?.name || 'Unknown', ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const topSellingProductsByUnits = Array.from(productSales.entries())
      .map(([productId, data]) => ({ name: productMap.get(productId)?.name || 'Unknown', ...data }))
      .sort((a, b) => b.units - a.units)
      .slice(0, 5);

    const recentSales = validSales
        .sort((a, b) => b.saleDate.toMillis() - a.saleDate.toMillis())
        .slice(0, 10)
        .map(sale => ({
            ...sale,
            productName: productMap.get(sale.productId)?.name || 'Unknown',
        }));

    return { totalRevenue, totalUnitsSold, topSellingProductsByRevenue, topSellingProductsByUnits, recentSales };
  }, [sales, products, productMap]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader
        title="Sales Report"
        description="Advanced analytics on your sales performance."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${analytics.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground">Total revenue from all sales.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Units Sold</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalUnitsSold.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Total units sold across all products.</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top 5 Products by Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.topSellingProductsByRevenue} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(value) => `$${value}`} />
                <YAxis type="category" dataKey="name" width={80} />
                <Tooltip formatter={(value) => `$${(value as number).toFixed(2)}`} />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top 5 Products by Units Sold</CardTitle>
          </CardHeader>
          <CardContent>
             <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.topSellingProductsByUnits} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={80} />
                <Tooltip />
                <Bar dataKey="units" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
            <CardTitle>Recent Sales</CardTitle>
            <CardDescription>Your 10 most recent sales transactions.</CardDescription>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead className="text-right">Total Price</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {analytics.recentSales.map(sale => (
                        <TableRow key={sale.id}>
                            <TableCell className="font-medium">{sale.productName}</TableCell>
                            <TableCell>{sale.saleDate.toDate().toLocaleDateString()}</TableCell>
                            <TableCell className="text-right">{sale.quantity}</TableCell>
                            <TableCell className="text-right">${sale.totalPrice.toFixed(2)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </CardContent>
      </Card>
    </div>
  );
}
