import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route } from "react-router-dom";
import { useAuth } from './hooks/useAuth';
import Index from "./pages/Index";
import AuthPage from "./pages/Auth";
import AdminPage from "./pages/AdminPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppContent = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // Modo offline/dev: redireciona para /auth apenas quando o usuário
  // tenta acessar /admin sem estar logado. O jogo roda sem login via
  // localStorage — sem Supabase, sem bloqueio.
  useEffect(() => {
    if (loading) return;
    const path = window.location.pathname;
    if (!user && path.startsWith('/admin')) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  return (
    <Routes>
      <Route path="/"      element={<Index />} />
      <Route path="/auth"  element={<AuthPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="*"      element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AppContent />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;