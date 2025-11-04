
"use client";

import * as React from "react";
import {
  collection,
  doc,
  Timestamp,
  writeBatch,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { useCollection, useFirestore, useUser, useMemoFirebase, useDoc } from "@/firebase";
import {
  addDocumentNonBlocking,
  deleteDocumentNonBlocking,
  updateDocumentNonBlocking,
} from "@/firebase/non-blocking-updates";
import type { Product, Supplier, UserProfile, Sale } from "@/types";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import {
  MoreHorizontal,
  PlusCircle,
  ArrowUpDown,
  FilePenLine,
  Trash2,
  BrainCircuit,
  Loader2,
  Sparkles,
  DollarSign,
  FilePlus2,
} from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Label } from "@/components/ui/label";
import { intelligentReorderSuggestions } from "@/ai/flows/intelligent-reorder-suggestions";
import { generateProductDetails } from "@/ai/flows/generate-product-details";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  description: z.string().optional(),
  stock: z.coerce.number().min(0, "Stock cannot be negative"),
  unitOfMeasure: z.string().min(1, "Unit of Measure is required"),
  reorderPoint: z.coerce.number().min(0, "Reorder point cannot be negative"),
  location: z.string().min(1, "Location is required"),
  supplierId: z.string().min(1, "Supplier is required"),
  expirationDate: z.string().min(1, "Expiration date is required"),
  reorderQuantity: z.coerce.number().min(1),
  leadTime: z.coerce.number().min(0),
  costPrice: z.coerce.number().min(0, "Cost price cannot be negative"),
  sellingPrice: z.coerce.number().min(0, "Selling price cannot be negative"),
  purchaseDate: z.string().min(1, "Purchase date is required"),
  lifecycle: z.enum(["New", "Mature", "Declining"]).optional(),
  storageCapacity: z.coerce.number().optional(),
});

const saleSchema = z.object({
    quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
});

type SortKey = keyof Omit<Product, 'expirationDate' | 'purchaseDate' | 'description'>;

export default function InventoryPage() {
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
    return collection(firestore, 'products');
  }, [firestore, user]);
  const { data: products = [], isLoading: productsLoading } = useCollection<Omit<Product, 'id'>>(productsCollection);

  const suppliersCollection = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'suppliers');
  }, [firestore, user]);
  const { data: suppliers = [], isLoading: suppliersLoading } = useCollection<Omit<Supplier, 'id'>>(suppliersCollection);

  const salesCollection = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, "sales");
  }, [firestore, user]);
  const { data: sales } = useCollection<Omit<Sale, "id">>(salesCollection);

  const supplierMap = React.useMemo(() => new Map(suppliers?.map(s => [s.id, s]) || []), [suppliers]);

  const [filter, setFilter] = React.useState("");
  const [sortConfig, setSortConfig] = React.useState<{
    key: SortKey;
    direction: "ascending" | "descending";
  } | null>({ key: "name", direction: "ascending" });
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = React.useState(false);
  const [isReorderDialogOpen, setIsReorderDialogOpen] = React.useState(false);
  const [isSaleFormOpen, setIsSaleFormOpen] = React.useState(false);
  const [reorderSuggestion, setReorderSuggestion] = React.useState<any>(null);
  const [isReorderLoading, setIsReorderLoading] = React.useState(false);
  const [isGeneratingDetails, setIsGeneratingDetails] = React.useState(false);
  const [selectedProduct, setSelectedProduct] = React.useState<Product | null>(null);
  const [demandForecast, setDemandForecast] = React.useState(50);
  const [salesVelocityMap, setSalesVelocityMap] = React.useState<Map<string, number>>(new Map());
  const [salesTrendMap, setSalesTrendMap] = React.useState<Map<string, number>>(new Map());

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<z.infer<typeof productSchema>>({
    resolver: zodResolver(productSchema),
  });

   const {
    register: registerSale,
    handleSubmit: handleSaleSubmit,
    reset: resetSale,
    formState: { errors: saleErrors },
    watch: watchSale
  } = useForm<z.infer<typeof saleSchema>>({
    resolver: zodResolver(saleSchema),
  });
  
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


  const toDateString = (date: Date | Timestamp | undefined) => {
    if (!date) return "";
    if (date instanceof Timestamp) {
      return date.toDate().toISOString().split('T')[0];
    }
    return new Date(date).toISOString().split('T')[0];
  };

  const handleSort = (key: SortKey) => {
    let direction: "ascending" | "descending" = "ascending";
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === "ascending"
    ) {
      direction = "descending";
    }
    setSortConfig({ key, direction });
  };

  const sortedAndFilteredProducts = React.useMemo(() => {
    if (!products) return [];
    let sortableProducts = [...products];
    if (sortConfig !== null) {
      sortableProducts.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];

        if (aVal < bVal) {
          return sortConfig.direction === "ascending" ? -1 : 1;
        }
        if (aVal > bVal) {
          return sortConfig.direction === "ascending" ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableProducts.filter((product) =>
      product.name.toLowerCase().includes(filter.toLowerCase())
    );
  }, [products, filter, sortConfig]);

  const handleAddClick = () => {
    setSelectedProduct(null);
    reset({
      name: "",
      category: "",
      description: "",
      stock: 0,
      unitOfMeasure: "item",
      reorderPoint: 10,
      location: "",
      supplierId: "",
      expirationDate: toDateString(new Date()),
      reorderQuantity: 20,
      leadTime: 3,
      costPrice: 0,
      sellingPrice: 0,
      purchaseDate: toDateString(new Date()),
      lifecycle: "New",
      storageCapacity: 100,
    });
    setIsFormOpen(true);
  };

  const handleEditClick = (product: Product) => {
    setSelectedProduct(product);
    reset({
        ...product,
        expirationDate: toDateString(product.expirationDate),
        purchaseDate: toDateString(product.purchaseDate),
    });
    setIsFormOpen(true);
  };

  const handleDeleteClick = (product: Product) => {
    setSelectedProduct(product);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedProduct || !firestore) return;

    try {
        const batch = writeBatch(firestore);

        // 1. Find all sales documents for the product
        const salesQuery = query(collection(firestore, 'sales'), where('productId', '==', selectedProduct.id));
        const salesSnapshot = await getDocs(salesQuery);
        salesSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });

        // 2. Delete the product document
        const productRef = doc(firestore, 'products', selectedProduct.id);
        batch.delete(productRef);

        // 3. Commit the batch
        await batch.commit();

        toast({
            title: "Product Deleted",
            description: `${selectedProduct.name} and all its sales data have been removed.`,
        });

    } catch (error) {
        console.error("Error performing cascading delete:", error);
        toast({
            variant: "destructive",
            title: "Deletion Failed",
            description: "Could not delete the product and its related data.",
        });
    }

    setIsDeleteConfirmOpen(false);
    setSelectedProduct(null);
  };

  const handleFormSubmit = (data: z.infer<typeof productSchema>) => {
    if (!firestore || !user) return;
    
    const productData: Omit<Product, 'id'> = {
        ...data,
        expirationDate: Timestamp.fromDate(new Date(data.expirationDate)),
        purchaseDate: Timestamp.fromDate(new Date(data.purchaseDate)),
        owner: user.uid,
    };
    
    if (productData.lifecycle === undefined) {
        delete productData.lifecycle;
    }

    if (selectedProduct) {
      // Update
      const docRef = doc(firestore, 'products', selectedProduct.id);
      updateDocumentNonBlocking(docRef, productData);
    } else {
      // Create
      const collectionRef = collection(firestore, 'products');
      addDocumentNonBlocking(collectionRef, productData);
    }
    setIsFormOpen(false);
    setSelectedProduct(null);
  };

  const handleReorderClick = (product: Product) => {
    setSelectedProduct(product);
    setReorderSuggestion(null);
    setDemandForecast(Math.round(product.reorderPoint * 1.5)); // Default forecast
    setIsReorderDialogOpen(true);
  };

  const handleSellClick = (product: Product) => {
    setSelectedProduct(product);
    resetSale({ quantity: 1 });
    setIsSaleFormOpen(true);
  };
  
  const handleSaleFormSubmit = async (data: z.infer<typeof saleSchema>) => {
    if (!firestore || !user || !selectedProduct) return;

    if (data.quantity > selectedProduct.stock) {
      toast({
        variant: "destructive",
        title: "Not enough stock",
        description: `You only have ${selectedProduct.stock} units of ${selectedProduct.name}.`,
      });
      return;
    }
    
    const batch = writeBatch(firestore);

    const productRef = doc(firestore, 'products', selectedProduct.id);
    const newStock = selectedProduct.stock - data.quantity;
    batch.update(productRef, { stock: newStock });
    
    const saleRef = doc(collection(firestore, 'sales'));
    batch.set(saleRef, {
      productId: selectedProduct.id,
      quantity: data.quantity,
      totalPrice: data.quantity * selectedProduct.sellingPrice,
      saleDate: Timestamp.now(),
      owner: user.uid,
    });

    try {
        await batch.commit();
        toast({
            title: "Sale Recorded",
            description: `Sold ${data.quantity} of ${selectedProduct.name}.`,
        });
        setIsSaleFormOpen(false);
        setSelectedProduct(null);
    } catch (error) {
        console.error("Error recording sale:", error);
        toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to record sale. Please try again.",
        });
    }
  };
  
  const handleGenerateDetails = async () => {
    const productName = watch("name");
    if (!productName) {
        toast({
            variant: "destructive",
            title: "Product Name Required",
            description: "Please enter a product name first.",
        });
        return;
    }
    setIsGeneratingDetails(true);
    try {
        const result = await generateProductDetails({ productName });
        setValue("category", result.category);
        setValue("description", result.description);
        toast({
            title: "Details Generated",
            description: "Category and description have been filled in.",
        });
    } catch (e) {
        console.error("Error generating product details:", e);
        toast({
            variant: "destructive",
            title: "Generation Failed",
            description: "Could not generate details. Please try again.",
        });
    } finally {
        setIsGeneratingDetails(false);
    }
  };

  const getReorderSuggestion = async () => {
    if (!selectedProduct) return;
    const supplier = supplierMap.get(selectedProduct.supplierId);
    setIsReorderLoading(true);
    try {
      const result = await intelligentReorderSuggestions({
        products: [{
            productId: selectedProduct.id,
            currentStockLevel: selectedProduct.stock,
            demandForecast: demandForecast,
            reorderPoint: selectedProduct.reorderPoint,
            reorderQuantity: selectedProduct.reorderQuantity,
            leadTime: selectedProduct.leadTime,
            salesVelocity: salesVelocityMap.get(selectedProduct.id) || 0,
            salesVelocityTrend: salesTrendMap.get(selectedProduct.id) || 0,
            supplierReliability: supplier?.reliabilityScore,
            storageCapacity: selectedProduct.storageCapacity,
        }]
      });
      setReorderSuggestion(result.suggestions[0]);
    } catch (error) {
      console.error("Error getting reorder suggestion:", error);
      setReorderSuggestion({
        reorderSuggestion: false,
        reorderQuantity: 0,
        reasoning: "An error occurred while fetching the suggestion."
      });
    }
    setIsReorderLoading(false);
  };
  
  const handleCreateDraftPo = async () => {
    if (!firestore || !user || !selectedProduct || !reorderSuggestion) return;

    const poNumber = `PO-${Date.now()}`;
    const totalCost = selectedProduct.costPrice * reorderSuggestion.reorderQuantity;

    const poData = {
        poNumber,
        supplierId: selectedProduct.supplierId,
        status: 'Pending' as const,
        items: [{
            productId: selectedProduct.id,
            name: selectedProduct.name,
            quantity: reorderSuggestion.reorderQuantity,
            costPrice: selectedProduct.costPrice,
        }],
        totalCost,
        orderDate: Timestamp.now(),
        owner: user.uid,
    };

    await addDocumentNonBlocking(collection(firestore, 'purchaseOrders'), poData);
    
    toast({
        title: "Draft PO Created",
        description: `A new purchase order for ${reorderSuggestion.reorderQuantity} units of ${selectedProduct.name} has been created.`,
        action: (
            <Button variant="outline" size="sm" onClick={() => router.push('/purchase-orders')}>
                View POs
            </Button>
        ),
    });
    setIsReorderDialogOpen(false);
  };

  const getStatus = (product: Product) => {
    if (product.stock === 0) return <Badge variant="destructive">Out of Stock</Badge>;
    if (product.stock < product.reorderPoint) return <Badge variant="secondary" className="bg-yellow-200 text-yellow-800">Low Stock</Badge>;
    return <Badge variant="secondary" className="bg-green-200 text-green-800">In Stock</Badge>;
  };
  
  const isAdmin = userProfile?.role === 'Admin';
  const isStaff = userProfile?.role === 'Staff';


  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader
        title="Inventory"
        description="Manage your products and track their stock levels."
      />

      <div className="flex items-center justify-between">
        <Input
          placeholder="Filter products..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-sm"
        />
        {(isAdmin || isStaff) && (
        <Button onClick={handleAddClick}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Product
        </Button>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead onClick={() => handleSort("name")}>
                <Button variant="ghost" size="sm">
                  Name
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead onClick={() => handleSort("stock")}>
                <Button variant="ghost" size="sm">
                  Stock
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>Supplier</TableHead>
              {isAdmin && <TableHead>Cost Price</TableHead>}
              {isAdmin && <TableHead>Selling Price</TableHead>}
              <TableHead>Sales Velocity</TableHead>
              <TableHead>Expiration</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {productsLoading || suppliersLoading ? (
                <TableRow>
                    <TableCell colSpan={isAdmin ? 9 : 7} className="text-center">
                        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                    </TableCell>
                </TableRow>
            ) : (
                sortedAndFilteredProducts.map((product) => (
                <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>{getStatus(product)}</TableCell>
                    <TableCell>{product.stock.toLocaleString()} {product.unitOfMeasure}</TableCell>
                    <TableCell>{supplierMap.get(product.supplierId)?.name || 'N/A'}</TableCell>
                    {isAdmin && <TableCell>${(product.costPrice || 0).toFixed(2)}</TableCell>}
                    {isAdmin && <TableCell>${(product.sellingPrice || 0).toFixed(2)}</TableCell>}
                    <TableCell>{(salesVelocityMap.get(product.id) || 0).toFixed(2)}/day</TableCell>
                    <TableCell>
                    {product.expirationDate.toDate().toLocaleDateString()}
                    </TableCell>
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
                        {(isAdmin || isStaff) && (
                          <DropdownMenuItem onClick={() => handleSellClick(product)}>
                            <DollarSign className="mr-2 h-4 w-4" />
                            Sell Product
                          </DropdownMenuItem>
                        )}
                        {isAdmin && (
                          <>
                            <DropdownMenuItem onClick={() => handleEditClick(product)}>
                                <FilePenLine className="mr-2 h-4 w-4" />
                                Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleReorderClick(product)}>
                                <BrainCircuit className="mr-2 h-4 w-4" />
                                Reorder Suggestion
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => handleDeleteClick(product)}
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                            </DropdownMenuItem>
                           </>
                        )}
                         {!isAdmin && !isStaff && (
                            <DropdownMenuItem disabled>No actions available</DropdownMenuItem>
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
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedProduct ? 'Edit' : 'Add'} Product</DialogTitle>
            <DialogDescription>
              {selectedProduct ? 'Update the details of your product.' : 'Add a new product to your inventory.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(handleFormSubmit)} className="grid gap-4 py-4">
            <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" {...register("name")} />
                {errors.name && <p className="text-red-500 text-xs">{errors.name.message}</p>}
            </div>

            <div className="relative space-y-2">
                <div className="flex justify-between items-center">
                    <Label htmlFor="category">Category</Label>
                    <Button type="button" variant="ghost" size="sm" onClick={handleGenerateDetails} disabled={isGeneratingDetails}>
                        {isGeneratingDetails ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        <span className="ml-2">AI Generate</span>
                    </Button>
                </div>
                <Input id="category" {...register("category")} />
                {errors.category && <p className="text-red-500 text-xs">{errors.category.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" {...register("description")} placeholder="AI-generated description will appear here..."/>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="stock">Stock</Label>
                  <Input id="stock" type="number" {...register("stock")} />
                  {errors.stock && <p className="text-red-500 text-xs">{errors.stock.message}</p>}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="unitOfMeasure">Unit of Measure</Label>
                    <Input id="unitOfMeasure" placeholder="e.g., kg, item, liter" {...register("unitOfMeasure")} />
                    {errors.unitOfMeasure && <p className="text-red-500 text-xs">{errors.unitOfMeasure.message}</p>}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="reorderPoint">Reorder Point</Label>
                  <Input id="reorderPoint" type="number" {...register("reorderPoint")} />
                  {errors.reorderPoint && <p className="text-red-500 text-xs">{errors.reorderPoint.message}</p>}
                </div>
                 <div className="space-y-2">
                  <Label htmlFor="reorderQuantity">Reorder Quantity</Label>
                  <Input id="reorderQuantity" type="number" {...register("reorderQuantity")} />
                  {errors.reorderQuantity && <p className="text-red-500 text-xs">{errors.reorderQuantity.message}</p>}
                </div>
            </div>
            
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="leadTime">Lead Time (days)</Label>
                    <Input id="leadTime" type="number" {...register("leadTime")} />
                    {errors.leadTime && <p className="text-red-500 text-xs">{errors.leadTime.message}</p>}
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="storageCapacity">Storage Capacity (units)</Label>
                    <Input id="storageCapacity" type="number" {...register("storageCapacity")} />
                    {errors.storageCapacity && <p className="text-red-500 text-xs">{errors.storageCapacity.message}</p>}
                 </div>
             </div>


             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="costPrice">Cost Price ($)</Label>
                  <Input id="costPrice" type="number" step="0.01" {...register("costPrice")} />
                  {errors.costPrice && <p className="text-red-500 text-xs">{errors.costPrice.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sellingPrice">Selling Price ($)</Label>
                  <Input id="sellingPrice" type="number" step="0.01" {...register("sellingPrice")} />
                  {errors.sellingPrice && <p className="text-red-500 text-xs">{errors.sellingPrice.message}</p>}
                </div>
             </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input id="location" {...register("location")} />
              {errors.location && <p className="text-red-500 text-xs">{errors.location.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <Label htmlFor="lifecycle">Lifecycle Stage</Label>
                    <Controller
                    control={control}
                    name="lifecycle"
                    render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select stage..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="New">New</SelectItem>
                            <SelectItem value="Mature">Mature</SelectItem>
                            <SelectItem value="Declining">Declining</SelectItem>
                        </SelectContent>
                        </Select>
                    )}
                    />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="supplierId">Supplier</Label>
                    <Controller
                    control={control}
                    name="supplierId"
                    render={({ field }) => (
                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={suppliersLoading}>
                        <SelectTrigger>
                            <SelectValue placeholder={suppliersLoading ? "Loading..." : "Select a supplier"} />
                        </SelectTrigger>
                        <SelectContent>
                            {suppliers?.map((s: Supplier) => (
                            <SelectItem key={s.id} value={s.id}>
                                {s.name}
                            </SelectItem>
                            ))}
                        </SelectContent>
                        </Select>
                    )}
                    />
                    {errors.supplierId && <p className="text-sm text-destructive">{errors.supplierId.message}</p>}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="purchaseDate">Purchase Date</Label>
                <Input id="purchaseDate" type="date" {...register("purchaseDate")} />
                {errors.purchaseDate && <p className="text-red-500 text-xs">{errors.purchaseDate.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="expirationDate">Expiration Date</Label>
                <Input id="expirationDate" type="date" {...register("expirationDate")} />
                {errors.expirationDate && <p className="text-red-500 text-xs">{errors.expirationDate.message}</p>}
              </div>
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
              This action cannot be undone. This will permanently delete the product "{selectedProduct?.name}" and all of its associated sales data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isReorderDialogOpen} onOpenChange={setIsReorderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center"><BrainCircuit className="mr-2"/> AI Reorder Suggestion</DialogTitle>
            <DialogDescription>For product: {selectedProduct?.name}</DialogDescription>
          </DialogHeader>
          {isReorderLoading ? (
             <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
             </div>
          ) : reorderSuggestion ? (
            <div className="space-y-4">
              <div className={`p-4 rounded-md ${reorderSuggestion.reorderSuggestion ? 'bg-green-100 dark:bg-green-900' : 'bg-amber-100 dark:bg-amber-900'}`}>
                <h4 className="font-bold">Suggestion: {reorderSuggestion.reorderSuggestion ? `Reorder ${reorderSuggestion.reorderQuantity} units` : "Do Not Reorder"}</h4>
              </div>
              <div>
                <h5 className="font-semibold">Reasoning:</h5>
                <p className="text-sm text-muted-foreground">{reorderSuggestion.reasoning}</p>
              </div>
              {reorderSuggestion.reorderSuggestion && isAdmin && (
                <DialogFooter className="pt-4">
                    <Button onClick={handleCreateDraftPo}>
                        <FilePlus2 className="mr-2 h-4 w-4" />
                        Create Draft PO
                    </Button>
                </DialogFooter>
              )}
            </div>
          ) : (
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="demandForecast" className="text-right col-span-2">Demand Forecast</Label>
                  <Input 
                    id="demandForecast" 
                    type="number" 
                    value={demandForecast}
                    onChange={(e) => setDemandForecast(Number(e.target.value))}
                    className="col-span-2"
                  />
              </div>
              <p className="text-xs text-muted-foreground text-center">Enter the forecasted demand for the next lead time period ({selectedProduct?.leadTime} days) to get an AI-powered reorder suggestion.</p>
              <Button onClick={getReorderSuggestion} className="w-full">
                Get Suggestion
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      <Dialog open={isSaleFormOpen} onOpenChange={setIsSaleFormOpen}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Record Sale</DialogTitle>
                <DialogDescription>Record a new sale for {selectedProduct?.name}.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSaleSubmit(handleSaleFormSubmit)}>
                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="quantity">Quantity</Label>
                        <Input id="quantity" type="number" {...registerSale("quantity")} />
                        {saleErrors.quantity && <p className="text-red-500 text-xs">{saleErrors.quantity.message}</p>}
                    </div>
                     <div className="space-y-2">
                        <Label>Total Price</Label>
                        <p className="text-lg font-bold">${(watchSale("quantity") * (selectedProduct?.sellingPrice || 0)).toFixed(2)}</p>
                    </div>
                </div>
                <DialogFooter>
                    <Button type="submit">Record Sale</Button>
                </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
