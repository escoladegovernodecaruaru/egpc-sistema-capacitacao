"use client";

import { useProfile } from "@/contexts/ProfileContext";
import { BookOpen, GraduationCap, Award, TrendingUp, ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const { profile, isLoading } = useProfile();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-light" />
      </div>
    );
  }

  if (!profile) return null;

  // Saudação Dinâmica
  const primeiroNome = (profile.nome_social || profile.nome_completo).split(" ")[0];
  const hora = new Date().getHours();
  let saudacao = "Boa noite";
  if (hora >= 5 && hora < 12) saudacao = "Bom dia";
  else if (hora >= 12 && hora < 18) saudacao = "Boa tarde";

  const isAdmin = profile.is_staff;

  return (
    <div className="space-y-8 animate-[fade-in_0.4s_ease-out]">
      
      {/* ── HEADER DE BOAS-VINDAS ── */}
      <section className="glass-card p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/3" />
        
        <div className="relative z-10">
          <h1 className="text-3xl font-bold text-slate-100 tracking-tight">
            {saudacao}, <span className="text-primary-light">{primeiroNome}</span>! 👋
          </h1>
          <p className="text-slate-400 mt-2 text-[15px] max-w-xl">
            {isAdmin 
              ? "Bem-vindo ao painel de controle da Escola de Governo. Aqui está o resumo das operações de hoje."
              : "Pronto para continuar sua jornada de aprendizado? Acompanhe seus cursos e certificados por aqui."}
          </p>
        </div>
      </section>

      {/* ── MÓDULOS (CARDS) ── */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        
        {/* Bloco 1: Jornada */}
        <div className="glass-card p-6 flex flex-col hover:border-white/20 transition-colors">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4 border border-blue-500/20">
            <GraduationCap className="w-6 h-6 text-blue-400" />
          </div>
          <h2 className="text-lg font-semibold text-slate-100">Minha Jornada</h2>
          <p className="text-sm text-slate-500 mt-1 flex-1">Você ainda não está matriculado em nenhum curso.</p>
          
          <Link href="/dashboard/cursos" className="mt-6 flex items-center gap-2 text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors group">
            Explorar Catálogo <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* Bloco 2: Certificados */}
        <div className="glass-card p-6 flex flex-col hover:border-white/20 transition-colors">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4 border border-emerald-500/20">
            <Award className="w-6 h-6 text-emerald-400" />
          </div>
          <h2 className="text-lg font-semibold text-slate-100">Meus Certificados</h2>
          <p className="text-sm text-slate-500 mt-1 flex-1">Visualize e baixe os certificados dos cursos concluídos.</p>
          
          <button disabled className="mt-6 flex items-center gap-2 text-sm font-medium text-slate-600 cursor-not-allowed">
            Nenhum certificado emitido
          </button>
        </div>

        {/* Bloco 3: Catálogo */}
        <div className="glass-card p-6 flex flex-col hover:border-white/20 transition-colors">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-4 border border-cyan-500/20">
            <BookOpen className="w-6 h-6 text-cyan-400" />
          </div>
          <h2 className="text-lg font-semibold text-slate-100">Inscrições Abertas</h2>
          <p className="text-sm text-slate-500 mt-1 flex-1">Descubra novas oportunidades de capacitação profissional.</p>
          
          <Link href="/dashboard/cursos" className="mt-6 flex items-center gap-2 text-sm font-medium text-cyan-400 hover:text-cyan-300 transition-colors group">
            Ver turmas abertas <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* Bloco ADMIN (Mostra apenas se is_staff for true) */}
        {isAdmin && (
          <div className="glass-card p-6 flex flex-col md:col-span-2 lg:col-span-3 bg-primary/5 border-primary/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/30">
                <TrendingUp className="w-5 h-5 text-primary-light" />
              </div>
              <h2 className="text-lg font-semibold text-slate-100">Visão Geral da Gestão</h2>
              <span className="px-2.5 py-1 rounded-md bg-primary text-[10px] font-bold text-white uppercase tracking-wider ml-auto">Administrador</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <p className="text-sm text-slate-400 font-medium">Turmas Ativas</p>
                <p className="text-2xl font-bold text-slate-100 mt-1">--</p>
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <p className="text-sm text-slate-400 font-medium">Aprovações Pendentes</p>
                <p className="text-2xl font-bold text-amber-400 mt-1">--</p>
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <p className="text-sm text-slate-400 font-medium">Novos Usuários (Hoje)</p>
                <p className="text-2xl font-bold text-success-light mt-1">--</p>
              </div>
            </div>
          </div>
        )}

      </section>
    </div>
  );
}