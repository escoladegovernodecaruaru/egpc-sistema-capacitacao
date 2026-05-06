"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { ProfileProvider, useProfile, perfilCompleto } from "@/contexts/ProfileContext";

/**
 * Guard interno: redireciona para /dashboard/perfil se o perfil estiver incompleto.
 * Permite sempre acessar a própria página de perfil (evitar loop infinito).
 */
function PerfilGuard({ children }: { children: React.ReactNode }) {
  const { profile, isLoading } = useProfile();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading || !profile) return;
    // Permite sempre acessar o perfil e o logout
    if (pathname === "/dashboard/perfil") return;

    if (!perfilCompleto(profile)) {
      router.replace("/dashboard/perfil?incompleto=1");
    }
  }, [profile, isLoading, pathname, router]);

  return <>{children}</>;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    // ProfileProvider garante uma única chamada /auth/me/ para toda a sessão do Dashboard.
    // PerfilGuard verifica completude e redireciona se necessário.
    <ProfileProvider>
      <PerfilGuard>
        <div className="flex h-screen bg-[var(--background)] overflow-hidden">
          <Sidebar />
          <div className="flex-1 flex flex-col overflow-hidden">
            <main className="flex-1 overflow-y-auto">
              <div className="p-6 md:p-8 space-y-6 max-w-5xl mx-auto">
                {children}
              </div>
            </main>
          </div>
        </div>
      </PerfilGuard>
    </ProfileProvider>
  );
}
