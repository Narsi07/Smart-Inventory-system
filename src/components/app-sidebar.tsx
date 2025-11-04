
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Boxes, 
  BrainCircuit, 
  LayoutDashboard, 
  LogOut, 
  Settings, 
  BarChart3, 
  Users,
  DollarSign,
  ShoppingCart,
  Truck,
  LineChart
} from "lucide-react";
import { Logo } from "@/components/logo";
import { useUser, useAuth, useDoc, useMemoFirebase, useFirestore } from "@/firebase";
import type { UserProfile } from "@/types";
import { doc } from "firebase/firestore";
import { Button } from "./ui/button";
import { signOut } from "firebase/auth";

export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();

  const userProfileDoc = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, `users/${user.uid}`);
  }, [firestore, user]);

  const { data: userProfile } = useDoc<UserProfile>(userProfileDoc);

  const handleLogout = () => {
    if(auth) {
      signOut(auth);
    }
  };

  const allMenuItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ['Admin', 'Staff'] },
    { href: "/inventory", label: "Inventory", icon: Boxes, roles: ['Admin', 'Staff'] },
    { href: "/suppliers", label: "Suppliers", icon: Truck, roles: ['Admin', 'Staff'] },
    { href: "/purchase-orders", label: "Purchase Orders", icon: ShoppingCart, roles: ['Admin', 'Staff'] },
    { href: "/sales-report", label: "Sales Report", icon: LineChart, roles: ['Admin', 'Staff'] },
    { href: "/reports", label: "Legacy Reports", icon: BarChart3, roles: ['Admin', 'Staff'] },
    { href: "/demand-forecasting", label: "Demand Forecasting", icon: BrainCircuit, roles: ['Admin'] },
    { href: "/financials", label: "Financials", icon: DollarSign, roles: ['Admin'] },
    { href: "/users", label: "Users", icon: Users, roles: ['Admin'] },
    { href: "/settings", label: "Settings", icon: Settings, roles: ['Admin', 'Staff'] },
  ];
  
  const menuItems = allMenuItems.filter(item => userProfile && item.roles.includes(userProfile.role));


  return (
    <div className="hidden md:block w-72 bg-card border-r">
      <div className="flex h-full max-h-screen flex-col gap-2">
        <div className="h-16 flex items-center border-b px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Logo className="h-6 w-auto" />
          </Link>
        </div>
        <div className="flex-1 overflow-auto py-2">
          <nav className="grid items-start px-4 text-sm font-medium">
            {menuItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={label}
                href={href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary ${pathname === href ? 'bg-muted text-primary' : ''}`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="mt-auto p-4 border-t">
          <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 overflow-hidden">
                <p className="font-semibold text-sm truncate">{user?.displayName || 'User'}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
               <div className="text-xs font-semibold uppercase text-muted-foreground">{userProfile?.role}</div>
          </div>
          <Button variant="outline" className="w-full" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Log Out
          </Button>
        </div>
      </div>
    </div>
  );
}
