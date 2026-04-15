"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import {
  BookOpen, LayoutDashboard, Users, LogOut,
  FolderKanban, Menu, X, UserCircle, ChevronsUpDown
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/contexts/ProfileContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const NAV = [
  { label: "Painel",       href: "/dashboard",          icon: LayoutDashboard, roles: ["*"] },
  { label: "Catálogo",     href: "/dashboard/cursos",   icon: BookOpen,        roles: ["*"] },
  { label: "Meu Perfil",   href: "/dashboard/perfil",   icon: UserCircle,      roles: ["*"] },
  { label: "Minha Equipe", href: "/dashboard/equipe",   icon: Users,           roles: ["*"] },
  { label: "Gestão",       href: "/dashboard/gestao",   icon: FolderKanban,    roles: ["ADMIN", "INSTRUTOR"] },
  { label: "Usuários",     href: "/dashboard/usuarios", icon: Users,           roles: ["ADMIN"] },
];

const TIPO_DOT: Record<string, string> = {
  SERVIDOR_ATIVO: "bg-cyan-500",
  CIDADAO:        "bg-slate-500",
  TERCEIRIZADO:   "bg-amber-500",
  ESTAGIARIO:     "bg-purple-500",
  INSTRUTOR:      "bg-blue-500",
};

function ProfileAvatar({ nome, fotoUrl, size = 8 }: { nome: string; fotoUrl: string | null; size?: number }) {
  const px = size * 4; 
  if (fotoUrl) {
    return (
      <div className={`relative w-${size} h-${size} rounded-full overflow-hidden flex-shrink-0 border border-white/5`}>
        <Image src={fotoUrl} alt={nome} fill className="object-cover" unoptimized />
      </div>
    );
  }
  return (
    <div className={`w-${size} h-${size} rounded-full bg-slate-100 text-slate-600
                     flex items-center justify-center text-[12px] font-bold uppercase flex-shrink-0 border border-slate-200`}
         style={{ width: px, height: px }}>
      {nome.charAt(0)}
    </div>
  );
}

export default function Sidebar() {
  const pathname  = usePathname();
  const router    = useRouter();
  const [open, setOpen] = useState(false);

  const { profile, isLoading } = useProfile();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Sessão encerrada.");
    router.push("/login");
  };

const filtered = NAV.filter((item) => {
    // Se a aba for liberada para todos (*)
    if (item.roles.includes("*")) return true;
    
    // Se a aba exige ADMIN e o perfil atual tem privilégios de staff no Django
    if (profile?.is_staff && item.roles.includes("ADMIN")) return true;
    
    // Se a aba exige Instrutor e ele é Instrutor
    if (item.roles.includes(profile?.tipo_usuario ?? "")) return true;
    
    return false;
  });

  const nomeExibido = profile
    ? (profile.nome_social || profile.nome_completo).split(" ")[0]
    : null;

  const NavLink = ({ item }: { item: typeof NAV[0] }) => {
    const active = item.href === '/dashboard' 
      ? pathname === '/dashboard' 
      : pathname.startsWith(item.href);

    return (
      <Link
        href={item.href}
        onClick={() => setOpen(false)}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 group",
          active
            ? "bg-primary/10 text-primary"
            : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
        )}
      >
        <item.icon className={cn(
          "w-4 h-4 flex-shrink-0 transition-colors",
          active ? "text-primary" : "text-slate-400 group-hover:text-slate-600"
        )} />
        {item.label}
      </Link>
    );
  };

  const SidebarContent = () => (
    <div className="h-full flex flex-col pt-4">
      {/* Logo Area */}
      <div className="px-6 mb-6 flex items-center gap-3 flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-sm">
          <BookOpen className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-[14px] font-bold text-slate-900 tracking-tight leading-none mb-1">Portal EGPC</p>
          <p className="text-[10px] text-slate-500 font-medium tracking-wide">ESCOLA DE GOVERNO</p>
        </div>
      </div>

      {/* Navegação */}
      <nav className="flex-1 overflow-y-auto px-3 space-y-0.5">
        <p className="px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2 mt-4">Menu</p>
        {filtered.map((item) => <NavLink key={item.href} item={item} />)}
      </nav>

      {/* Rodapé: Perfil e Logout */}
      <div className="p-3 flex-shrink-0">
        {isLoading && (
          <div className="flex items-center gap-3 p-2">
            <div className="w-8 h-8 rounded-full bg-slate-100 animate-pulse" />
            <div className="space-y-2 flex-1">
              <div className="h-2.5 bg-slate-100 rounded w-20 animate-pulse" />
              <div className="h-2 bg-slate-100 rounded w-12 animate-pulse" />
            </div>
          </div>
        )}

        {!isLoading && profile && (
          <div className="flex flex-col gap-1">
            <Link
              href="/dashboard/perfil"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors group cursor-pointer"
            >
              <div className="relative">
                <ProfileAvatar nome={nomeExibido ?? "?"} fotoUrl={profile.foto_perfil_url} size={8} />
                <div className={cn(
                  "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white",
                  TIPO_DOT[profile.tipo_usuario] || "bg-slate-500"
                )} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-slate-900 truncate group-hover:text-primary">{nomeExibido}</p>
                <p className="text-[10px] text-slate-500 truncate mt-0.5">{profile.tipo_usuario_display}</p>
              </div>
              <ChevronsUpDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600" />
            </Link>

            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors text-[13px] font-medium"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <button onClick={() => setOpen(true)} className="md:hidden fixed top-4 left-4 z-50 w-10 h-10 rounded-xl clean-card flex items-center justify-center text-slate-600">
        <Menu className="w-5 h-5" />
      </button>

      {/* Background mais escuro apenas na sidebar para destacar o conteúdo */}
      <aside className="hidden md:block w-[240px] flex-shrink-0 bg-white border-r border-slate-200">
        <SidebarContent />
      </aside>

      <AnimatePresence>
        {open && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="md:hidden fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40" onClick={() => setOpen(false)} />
            <motion.aside initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: "spring", stiffness: 320, damping: 30 }} className="md:hidden fixed top-0 left-0 h-full w-[240px] z-50 bg-white border-r border-slate-200">
              <button onClick={() => setOpen(false)} className="absolute top-4 right-3 w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"><X className="w-5 h-5" /></button>
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}