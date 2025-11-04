
"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/page-header";
import { productDemandForecast, type ProductDemandForecastOutput } from "@/ai/flows/product-demand-forecast";
import { BrainCircuit, Loader2, Wand2, TrendingUp, DollarSign, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import type { Product, UserProfile, Sale } from "@/types";
import { useRouter } from "next/navigation";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';


const formSchema = z.object({
  productId: z.string().min(1, "Please select a product."),
  externalFactors: z.string().optional(),
  seasonalityEvents: z.string().optional(),
});

export default function DemandForecastingPage() {
  const [isLoading, setIsLoading] = React.useState(false);
  const [result, setResult] = React.useState<ProductDemandForecastOutput | null>(null);
  const { toast } = useToast();
  const router = useRouter();
  const { user } = useUser();
  
  const firestore = useFirestore();
  
  const userProfileDoc = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, `users/${user.uid}`);
  }, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileDoc);

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

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      productId: "",
      externalFactors: "",
      seasonalityEvents: "",
    },
  });

  React.useEffect(() => {
    if (!isProfileLoading && userProfile) {
      if (userProfile.role !== 'Admin') {
        toast({
          variant: "destructive",
          title: "Access Denied",
          description: "You do not have permission to view this page.",
        });
        router.push('/dashboard');
      }
    }
  }, [userProfile, isProfileLoading, router, toast]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    setResult(null);
    
    if (!products || !sales) {
        toast({
            variant: "destructive",
            title: "Error",
            description: "Data not loaded yet.",
        });
        setIsLoading(false);
        return;
    }

    const selectedProduct = products.find(p => p.id === values.productId);
    if (!selectedProduct) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Selected product not found.",
      });
      setIsLoading(false);
      return;
    }

    try {
      const productSales = sales.filter(s => s.productId === selectedProduct.id).map(s => ({
          saleDate: s.saleDate.toDate().toISOString(),
          quantity: s.quantity,
      }));

      const forecastResult = await productDemandForecast({
        product: {
          name: selectedProduct.name,
          category: selectedProduct.category,
          currentStock: selectedProduct.stock,
          sellingPrice: selectedProduct.sellingPrice,
          lifecycle: selectedProduct.lifecycle,
          leadTime: selectedProduct.leadTime,
          promotion: selectedProduct.promotion ? {
              type: selectedProduct.promotion.type,
              startDate: selectedProduct.promotion.startDate.toDate().toISOString(),
              endDate: selectedProduct.promotion.endDate.toDate().toISOString(),
          } : undefined,
        },
        salesHistory: productSales,
        externalFactors: values.externalFactors,
        seasonalityEvents: values.seasonalityEvents,
      });
      setResult(forecastResult);
    } catch (error) {
      console.error("Failed to get forecast:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate demand forecast. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  const pageIsLoading = productsLoading || isProfileLoading || salesLoading;

  if (pageIsLoading || !userProfile || userProfile.role !== 'Admin') {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader
        title="Demand Forecasting"
        description="Predict future product demand based on various factors."
      />
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Forecasting Inputs</CardTitle>
            <CardDescription>
              Provide the necessary data  to generate a forecast.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="productId">Product</Label>
                <Controller
                  control={form.control}
                  name="productId"
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={productsLoading}>
                      <SelectTrigger>
                        <SelectValue placeholder={productsLoading ? "Loading products..." : "Select a product..."} />
                      </SelectTrigger>
                      <SelectContent>
                        {products?.map((product: Product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {form.formState.errors.productId && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.productId.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="seasonalityEvents">External Events & Seasonality (Optional)</Label>
                <Textarea
                  id="seasonalityEvents"
                  placeholder="e.g., Upcoming holidays, local festivals, marketing campaigns..."
                  {...form.register("seasonalityEvents")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="externalFactors">Other Market Factors (Optional)</Label>
                <Textarea
                  id="externalFactors"
                  placeholder="e.g., Competitor actions, economic trends..."
                  {...form.register("externalFactors")}
                />
              </div>

              <Button type="submit" disabled={isLoading || pageIsLoading} className="w-full">
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="mr-2 h-4 w-4" />
                )}
                Generate Forecast
              </Button>
            </form>
          </CardContent>
        </Card>
        
        <div className="space-y-4 lg:col-span-3">
          <Card className="flex-grow">
            <CardHeader>
              <CardTitle className="flex items-center">
                <BrainCircuit className="mr-2" /> Forecast Result
              </CardTitle>
              <CardDescription>
                The generated demand forecast will appear here.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading && (
                <div className="flex flex-col items-center justify-center space-y-4 py-16">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <p className="text-muted-foreground">
                    Analyzing data and generating forecast...
                  </p>
                </div>
              )}
              {result && !isLoading && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 text-center">
                        <div className="p-4 bg-muted rounded-lg">
                            <h4 className="text-sm font-medium text-muted-foreground">Forecasted Units</h4>
                            <p className="text-2xl font-bold flex items-center justify-center gap-2"><Package className="h-6 w-6"/> {result.totalForecastedUnits}</p>
                        </div>
                         <div className="p-4 bg-muted rounded-lg">
                            <h4 className="text-sm font-medium text-muted-foreground">Forecasted Revenue</h4>
                            <p className="text-2xl font-bold flex items-center justify-center gap-2"><DollarSign className="h-6 w-6"/>${result.forecastedRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                        </div>
                        <div className="p-4 bg-muted rounded-lg col-span-2 lg:col-span-1">
                            <h4 className="text-sm font-medium text-muted-foreground">Expected Growth</h4>
                            <p className="text-2xl font-bold flex items-center justify-center gap-2"><TrendingUp className="h-6 w-6"/> {result.expectedGrowth}</p>
                        </div>
                    </div>

                  <div>
                    <h3 className="text-lg font-semibold">Top Factor</h3>
                    <p className="text-sm text-muted-foreground font-medium p-2 bg-muted rounded-md inline-block">{result.topFactor}</p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Analysis</h3>
                    <div className="text-sm text-muted-foreground whitespace-pre-wrap prose prose-sm">
                      {result.analysis}
                    </div>
                  </div>
                </div>
              )}
              {!result && !isLoading && (
                <div className="flex flex-col items-center justify-center space-y-4 text-center py-16">
                  <div className="p-4 bg-muted rounded-full">
                    <BrainCircuit className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground max-w-xs mx-auto">
                    Select a product and click "Generate Forecast" to see the prediction.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      
      <div className="grid gap-8 mt-8">
            <Card>
                <CardHeader>
                    <CardTitle>Sales Forecasting</CardTitle>
                    <CardDescription>Predicted sales for the next lead time period.</CardDescription>
                </CardHeader>
                <CardContent>
                    {result ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={result.forecastData.map(d => ({name: format(new Date(d.date), 'MMM d'), ...d}))}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" fontSize={12} />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Line type="monotone" dataKey="predictedUnits" stroke="hsl(var(--primary))" name="Forecasted Units" />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                         <div className="flex flex-col items-center justify-center space-y-4 text-center h-[300px]">
                            <p className="text-muted-foreground">Generate a forecast to see the prediction graph.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
      </div>

    </div>
  );
}
