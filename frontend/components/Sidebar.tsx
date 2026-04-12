"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import {
  BookOpen, LayoutDashboard, Users, LogOut,
  FolderKanban, Menu, X, ChevronRight, UserCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/contexts/ProfileContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

// ─── Definição dos itens de navegação ─────────────────────────────────────────

const NAV = [
  { label: "Painel",     href: "/dashboard",          icon: LayoutDashboard, roles: ["*"] },
  { label: "Catálogo",   href: "/dashboard/cursos",   icon: BookOpen,        roles: ["*"] },
  { label: "Meu Perfil", href: "/dashboard/perfil",   icon: UserCircle,      roles: ["*"] },
  { label: "Gestão",     href: "/dashboard/gestao",   icon: FolderKanban,    roles: ["SERVIDOR_ATIVO", "INSTRUTOR"] },
  { label: "Usuários",   href: "/dashboard/usuarios", icon: Users,           roles: ["SERVIDOR_ATIVO"] },
];

// ─── Cor do indicador por tipo de usuário ─────────────────────────────────────

const TIPO_DOT: Record<string, string> = {
  SERVIDOR_ATIVO: "bg-secondary",
  CIDADAO:        "bg-zinc-500",
  TERCEIRIZADO:   "bg-amber-400",
  ESTAGIARIO:     "bg-purple-400",
  INSTRUTOR:      "bg-primary-light",
};

// ─── Avatar do perfil (foto ou inicial) ───────────────────────────────────────

function ProfileAvatar({ nome, fotoUrl, size = 8 }: { nome: string; fotoUrl: string | null; size?: number }) {
  const px = size * 4; // Tailwind → pixels (aproximado)
  if (fotoUrl) {
    return (
      <div className={`relative w-${size} h-${size} rounded-full overflow-hidden flex-shrink-0`}>
        <Image
          src={fotoUrl}
          alt={`Foto de ${nome}`}
          fill
          className="object-cover"
          unoptimized
        />
      </div>
    );
  }
  return (
    <div className={`w-${size} h-${size} rounded-full bg-secondary/20 text-secondary-light
                     flex items-center justify-center text-[12px] font-bold uppercase flex-shrink-0`}
         style={{ width: px, height: px }}>
      {nome.charAt(0)}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function Sidebar() {
  const pathname  = usePathname();
  const router    = useRouter();
  const [open, setOpen] = useState(false);

  // Consome o contexto global — zero chamada duplicada ao /auth/me/
  const { profile, isLoading } = useProfile();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Sessão encerrada.");
    router.push("/login");
  };

  const filtered = NAV.filter((item) =>
    item.roles.includes("*") || item.roles.includes(profile?.tipo_usuario ?? "")
  );

  const nomeExibido = profile
    ? (profile.nome_social || profile.nome_completo).split(" ")[0]
    : null;

  // ─── NavLink ────────────────────────────────────────────────────────────────

  const NavLink = ({ item }: { item: typeof NAV[0] }) => {
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
    return (
      <Link
        href={item.href}
        onClick={() => setOpen(false)}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium",
          "transition-all duration-150 group",
          active
            ? "bg-primary text-white shadow-[0_4px_16px_rgba(0,64,54,0.35)]"
            : "text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04]"
        )}
      >
        <item.icon className={cn(
          "w-4 h-4 flex-shrink-0 transition-colors",
          active ? "text-white" : "text-zinc-600 group-hover:text-zinc-400"
        )} />
        {item.label}
        {active && <ChevronRight className="w-3 h-3 ml-auto text-white/40" />}
      </Link>
    );
  };

  // ─── Conteúdo da sidebar ────────────────────────────────────────────────────

  const SidebarContent = () => (
    <div className="h-full flex flex-col">

      {/* Logo */}
      <div className="h-[60px] px-5 flex items-center gap-3 border-b border-white/[0.05] flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-primary/30 border border-primary/30 flex items-center justify-center">
          <BookOpen className="w-4 h-4 text-primary-light" />
        </div>
        <div>
          <p className="text-[13px] font-bold text-zinc-100 leading-none">EGPC</p>
          <p className="text-[9px] text-zinc-600 mt-0.5 uppercase tracking-widest">Portal Institucional</p>
        </div>
      </div>

      {/* Navegação */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {filtered.map((item) => <NavLink key={item.href} item={item} />)}
      </nav>

      {/* Rodapé: avatar + logout */}
      <div className="p-3 border-t border-white/[0.05] space-y-1 flex-shrink-0">

        {/* Skeleton de carregamento */}
        {isLoading && (
          <div className="flex items-center gap-2.5 px-3 py-2.5 mb-1">
            <div className="w-8 h-8 rounded-full bg-white/[0.05] animate-pulse flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-2.5 bg-white/[0.05] rounded animate-pulse w-3/4" />
              <div className="h-2 bg-white/[0.04] rounded animate-pulse w-1/2" />
            </div>
          </div>
        )}

        {/* Card do perfil — clicável, leva ao /dashboard/perfil */}
        {!isLoading && profile && (
          <Link
            href="/dashboard/perfil"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl
                       bg-white/[0.03] border border-white/[0.04]
                       hover:bg-white/[0.05] transition-colors mb-1 group"
          >
            {/* Avatar com foto de perfil ou inicial */}
            <div className="relative flex-shrink-0">
              <ProfileAvatar
                nome={nomeExibido ?? "?"}
                fotoUrl={profile.foto_perfil_url}
                size={8}
              />
              {/* Indicador colorido de tipo */}
              <div className={cn(
                "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--surface)]",
                TIPO_DOT[profile.tipo_usuario] || "bg-zinc-500"
              )} />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-zinc-200 truncate group-hover:text-white transition-colors">
                {nomeExibido}
              </p>
              <p className="text-[10px] text-zinc-600 truncate uppercase tracking-wider mt-0.5">
                {profile.tipo_usuario_display}
              </p>
            </div>

            <ChevronRight className="w-3 h-3 text-zinc-700 group-hover:text-zinc-500 flex-shrink-0 transition-colors" />
          </Link>
        )}

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                     text-zinc-600 hover:text-red-400 hover:bg-red-500/[0.06]
                     transition-all text-[13px] font-medium"
        >
          <LogOut className="w-4 h-4" />
          Sair do Portal
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Botão hambúrguer mobile */}
      <button
        onClick={() => setOpen(true)}
        className="md:hidden fixed top-4 left-4 z-50 w-9 h-9 rounded-xl glass-card
                   flex items-center justify-center text-zinc-400 hover:text-zinc-100 transition-colors"
        title="Menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Sidebar desktop */}
      <aside className="hidden md:block w-56 flex-shrink-0 border-r border-white/[0.05] bg-[var(--surface)]">
        <SidebarContent />
      </aside>

      {/* Drawer mobile */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              onClick={() => setOpen(false)}
            />
            <motion.aside
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              className="md:hidden fixed top-0 left-0 h-full w-56 z-50
                         border-r border-white/[0.05] bg-[var(--surface)]"
            >
              <button
                onClick={() => setOpen(false)}
                className="absolute top-4 right-3 w-7 h-7 flex items-center justify-center
                           rounded-lg text-zinc-500 hover:text-zinc-100 hover:bg-white/[0.05]"
              >
                <X className="w-4 h-4" />
              </button>
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
