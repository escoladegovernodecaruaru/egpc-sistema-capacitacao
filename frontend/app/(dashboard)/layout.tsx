import Sidebar from "@/components/Sidebar";
import { ProfileProvider } from "@/contexts/ProfileContext";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    // ProfileProvider garante uma única chamada /auth/me/ para toda a sessão do Dashboard.
    // Sidebar e páginas consomem via useProfile() — atualizações propagam sem F5.
    <ProfileProvider>
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
    </ProfileProvider>
  );
}
