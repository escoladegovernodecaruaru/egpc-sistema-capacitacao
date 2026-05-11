"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";

/**
 * RootPage (/)
 * 
 * Responsável por despachar o usuário para o destino correto:
 * - Se logado (token presente): /dashboard
 * - Se não logado: /login
 */
export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    // Pequeno timeout para garantir que o cliente está pronto e evitar flashes agressivos
    const checkAuth = () => {
      const token = localStorage.getItem("egpc_access_token");
      
      if (token) {
        router.replace("/dashboard");
      } else {
        router.replace("/login");
      }
    };

    // Executa imediatamente
    checkAuth();
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-slate-50">
      {/* Luzes atmosféricas de fundo para manter a identidade visual */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 rounded-full bg-primary/10 blur-[160px]" />
        <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 rounded-full bg-secondary/5 blur-[160px]" />
      </div>

      <div className="flex flex-col items-center gap-6 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl
                        bg-white border border-slate-200 shadow-sm mb-2">
          <ShieldCheck className="w-10 h-10 text-primary animate-pulse" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Portal EGPC</h1>
          <p className="text-sm text-slate-500 font-medium flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Preparando seu acesso...
          </p>
        </div>
      </div>
    </main>
  );
}

