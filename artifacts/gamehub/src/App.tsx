import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/Layout";
import { AuthProvider, useAuth, isAdminOrAbove } from "@/context/AuthContext";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Units from "@/pages/Units";
import ActiveRentals from "@/pages/ActiveRentals";
import Products from "@/pages/Products";
import Transactions from "@/pages/Transactions";
import Expenses from "@/pages/Expenses";
import Packages from "@/pages/Packages";
import Laporan from "@/pages/Laporan";
import UsersPage from "@/pages/Users";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 10_000, retry: 1 },
  },
});

function ProtectedApp() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Memuat...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Login />;

  const isAdmin = isAdminOrAbove(user.role);

  return (
    <Layout>
      <Switch>
        <Route path="/" component={isAdmin ? Dashboard : Units} />
        {isAdmin && <Route path="/dashboard" component={Dashboard} />}
        <Route path="/units" component={Units} />
        <Route path="/active-rentals" component={ActiveRentals} />
        <Route path="/products" component={Products} />
        {isAdmin && <Route path="/transactions" component={Transactions} />}
        {isAdmin && <Route path="/expenses" component={Expenses} />}
        {isAdmin && <Route path="/packages" component={Packages} />}
        {isAdmin && <Route path="/laporan" component={Laporan} />}
        {isAdmin && <Route path="/users" component={UsersPage} />}
        {!isAdmin && <Route path="/dashboard"><Redirect to="/" /></Route>}
        {!isAdmin && <Route path="/transactions"><Redirect to="/" /></Route>}
        {!isAdmin && <Route path="/expenses"><Redirect to="/" /></Route>}
        {!isAdmin && <Route path="/laporan"><Redirect to="/" /></Route>}
        {!isAdmin && <Route path="/users"><Redirect to="/" /></Route>}
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <ProtectedApp />
          </WouterRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
