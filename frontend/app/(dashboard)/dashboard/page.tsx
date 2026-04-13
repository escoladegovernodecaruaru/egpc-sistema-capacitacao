"use client";

import { useProfile } from "@/contexts/ProfileContext";
import { BookOpen, GraduationCap, Award, TrendingUp, ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const { profile, isLoading } = useProfile();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
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
    <div className="space-y-8 animate-[fade-in_0.4s_ease-out] text-slate-800">
      
      {/* ── HEADER DE BOAS-VINDAS ── */}
      <section className="clean-card bg-indigo-600 border-indigo-700 p-8 md:p-10 relative overflow-hidden text-white shadow-lg">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500 rounded-full blur-[60px] opacity-60 -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        
        <div className="relative z-10">
          <h1 className="text-3xl font-extrabold tracking-tight">
            {saudacao}, <span className="text-indigo-200">{primeiroNome}</span>! 👋
          </h1>
          <p className="text-indigo-100 mt-2 text-[16px] max-w-xl font-medium">
            {isAdmin 
              ? "Bem-vindo ao painel de controle da Escola de Governo. Aqui está o resumo das operações de hoje."
              : "Pronto para continuar sua jornada de aprendizado? Acompanhe seus cursos e certificados por aqui."}
          </p>
        </div>
      </section>

      {/* ── MÓDULOS (CARDS) ── */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Bloco 1: Jornada */}
        <div className="clean-card p-6 flex flex-col hover:border-indigo-200 hover:shadow-md transition-all group">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-5 border border-blue-100 group-hover:bg-blue-100 transition-colors">
            <GraduationCap className="w-6 h-6 text-blue-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">Minha Jornada</h2>
          <p className="text-sm text-slate-500 mt-1.5 flex-1 leading-relaxed">Você ainda não está matriculado em nenhum curso.</p>
          
          <Link href="/dashboard/cursos" className="mt-6 flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-500 transition-colors group/link w-fit">
            Explorar Catálogo <ArrowRight className="w-4 h-4 group-hover/link:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* Bloco 2: Certificados */}
        <div className="clean-card p-6 flex flex-col hover:border-emerald-200 hover:shadow-md transition-all group">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center mb-5 border border-emerald-100 group-hover:bg-emerald-100 transition-colors">
            <Award className="w-6 h-6 text-emerald-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">Meus Certificados</h2>
          <p className="text-sm text-slate-500 mt-1.5 flex-1 leading-relaxed">Visualize e baixe os certificados dos cursos concluídos.</p>
          
          <button disabled className="mt-6 flex items-center gap-2 text-sm font-semibold text-slate-400 cursor-not-allowed">
            Nenhum certificado emitido
          </button>
        </div>

        {/* Bloco 3: Catálogo */}
        <div className="clean-card p-6 flex flex-col hover:border-cyan-200 hover:shadow-md transition-all group">
          <div className="w-12 h-12 rounded-xl bg-cyan-50 flex items-center justify-center mb-5 border border-cyan-100 group-hover:bg-cyan-100 transition-colors">
            <BookOpen className="w-6 h-6 text-cyan-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">Inscrições Abertas</h2>
          <p className="text-sm text-slate-500 mt-1.5 flex-1 leading-relaxed">Descubra novas oportunidades de capacitação profissional.</p>
          
          <Link href="/dashboard/cursos" className="mt-6 flex items-center gap-2 text-sm font-bold text-cyan-600 hover:text-cyan-500 transition-colors group/link w-fit">
            Ver turmas abertas <ArrowRight className="w-4 h-4 group-hover/link:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* Bloco ADMIN (Mostra apenas se is_staff for true) */}
        {isAdmin && (
          <div className="clean-card p-6 md:p-8 flex flex-col md:col-span-2 lg:col-span-3 bg-slate-50 border-slate-200 shadow-none">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center border border-indigo-200">
                  <TrendingUp className="w-6 h-6 text-indigo-600" />
                </div>
                <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Visão Geral da Gestão</h2>
              </div>
              <span className="px-3 py-1.5 rounded-lg bg-indigo-600 text-xs font-bold text-white uppercase tracking-wider w-fit shadow-md shadow-indigo-600/20">Administrador</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-2">
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col">
                <p className="text-[13px] text-slate-500 font-bold uppercase tracking-wider">Turmas Ativas</p>
                <p className="text-3xl font-black text-slate-800 mt-2">--</p>
              </div>
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col">
                <p className="text-[13px] text-slate-500 font-bold uppercase tracking-wider">Aprovações Pendentes</p>
                <p className="text-3xl font-black text-amber-500 mt-2">--</p>
              </div>
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col">
                <p className="text-[13px] text-slate-500 font-bold uppercase tracking-wider">Novos Usuários (Hoje)</p>
                <p className="text-3xl font-black text-emerald-500 mt-2">--</p>
              </div>
            </div>
          </div>
        )}

      </section>
    </div>
  );
}