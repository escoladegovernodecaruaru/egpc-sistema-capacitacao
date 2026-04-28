"use client";

import { useEffect, useState, useCallback } from "react";
import { useProfile } from "@/contexts/ProfileContext";
import {
  BookOpen, GraduationCap, TrendingUp, ArrowRight, Loader2,
  ChevronLeft, ChevronRight, Users, DollarSign, ClipboardCheck,
  BookMarked, BarChart3, Calendar
} from "lucide-react";
import Link from "next/link";
import { fetchApi } from "@/lib/api";
import BookLoader from "@/components/ui/BookLoader";
import { cn } from "@/lib/utils";

interface AdminStats {
  turmas_ativas: number;
  turmas_previstas: number;
  turmas_concluidas: number;
  aprovacoes_pendentes: number;
  novos_usuarios_hoje: number;
  total_matriculas: number;
  total_usuarios: number;
  custo_total: number;
}

interface InscricaoDetalhe {
  id: number;
  status: string;
  data_inscricao: string;
  titulo_curso: string;
  codigo_turma: string;
  data_inicio: string;
  data_termino: string;
  modalidade: string;
  carga_horaria: number;
  turma?: { id: number };
}

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  pendente:        { label: 'Pendente',       className: 'bg-amber-100 text-amber-800 border-amber-200' },
  aprovado_chefia: { label: 'Aprov. Chefia',  className: 'bg-amber-100 text-amber-800 border-amber-200' },
  inscrito:        { label: 'Inscrito',        className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  concluido:       { label: 'Concluído',       className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  cancelado:       { label: 'Cancelado',       className: 'bg-red-100 text-red-800 border-red-200' },
  reprovado:       { label: 'Reprovado',       className: 'bg-red-100 text-red-800 border-red-200' },
};

const MODALIDADE_MAP: Record<string, { label: string; color: string }> = {
  PRESENCIAL: { label: 'Presencial', color: 'text-blue-500' },
  REMOTO:     { label: 'EAD',        color: 'text-purple-500' },
  HIBRIDO:    { label: 'Híbrido',    color: 'text-teal-500' },
};

const formatData = (d: string) => {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y.slice(2)}`;
};

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export default function DashboardPage() {
  const { profile, isLoading } = useProfile();

  const [inscricoes, setInscricoes] = useState<InscricaoDetalhe[]>([]);
  const [loadingJornada, setLoadingJornada] = useState(true);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);

  useEffect(() => {
    if (!profile) return;

    async function loadMinhasInscricoes() {
      try {
        const res = await fetchApi<any>('/cursos/minhas-inscricoes/detalhes/');
        const data = Array.isArray(res) ? res : res?.results || [];
        setInscricoes(data);
      } catch (err) {
        console.error("Erro ao carregar jornada:", err);
      } finally {
        setLoadingJornada(false);
      }
    }

    async function loadAdminStats() {
      if (!profile || !profile.is_staff) return;
      try {
        const stats = await fetchApi<AdminStats>('/cursos/admin-stats/');
        setAdminStats(stats);
      } catch (err) {
        console.error("Erro ao carregar stats de admin:", err);
      }
    }

    loadMinhasInscricoes();
    loadAdminStats();
  }, [profile]);

  const prevCard = useCallback(() => {
    setCarouselIndex(i => Math.max(0, i - 1));
  }, []);

  const nextCard = useCallback(() => {
    setCarouselIndex(i => Math.min(inscricoes.length - 1, i + 1));
  }, [inscricoes.length]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <BookLoader size={80} message="Carregando painel..." />
      </div>
    );
  }

  if (!profile) return null;

  const primeiroNome = (profile.nome_social || profile.nome_completo).split(" ")[0];
  const hora = new Date().getHours();
  let saudacao = "Boa noite";
  if (hora >= 5 && hora < 12) saudacao = "Bom dia";
  else if (hora >= 12 && hora < 18) saudacao = "Boa tarde";

  const isAdmin = profile.is_staff;
  const inscricaoAtual = inscricoes[carouselIndex];

  return (
    <div className="space-y-8 animate-[fade-in_0.4s_ease-out] text-slate-800">

      {/* ── HEADER DE BOAS-VINDAS ── */}
      <section className="clean-card bg-primary border-primary-dark p-8 md:p-10 relative overflow-hidden text-white shadow-lg">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-light rounded-full blur-[60px] opacity-60 -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="relative z-10">
          <h1 className="text-3xl font-extrabold tracking-tight">
            {saudacao}, <span className="text-primary-muted">{primeiroNome}</span>! 👋
          </h1>
          <p className="text-primary-muted mt-2 text-[16px] max-w-xl font-medium">
            {isAdmin
              ? "Bem-vindo ao painel de controle da Escola de Governo. Aqui está o resumo das operações de hoje."
              : "Pronto para continuar sua jornada de aprendizado? Acompanhe seus cursos e certificados por aqui."}
          </p>
        </div>
      </section>

      {/* ── MÓDULOS (CARDS) ── */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        {/* ── MINHA JORNADA (carousel) ── */}
        <div className="clean-card p-6 flex flex-col hover:border-indigo-200 hover:shadow-md transition-all">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-5 border border-blue-100">
            <GraduationCap className="w-6 h-6 text-blue-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-1.5">Minha Jornada</h2>

          <div className="flex-1 flex flex-col">
            {loadingJornada ? (
              <div className="py-4 flex items-center text-blue-600">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="ml-2 text-sm text-slate-500">Carregando...</span>
              </div>
            ) : inscricoes.length === 0 ? (
              <p className="text-sm text-slate-500 mt-1.5 leading-relaxed flex-1">
                Você ainda não está matriculado em nenhum curso.
              </p>
            ) : (
              <div className="flex-1 flex flex-col gap-3">
                {/* Card único do carousel */}
                {inscricaoAtual && (() => {
                  const badge = STATUS_MAP[inscricaoAtual.status] ?? { label: inscricaoAtual.status, className: 'bg-slate-100 text-slate-600 border-slate-200' };
                  const mod = MODALIDADE_MAP[inscricaoAtual.modalidade];
                  return (
                    <div className="rounded-xl border border-slate-100 bg-gradient-to-br from-blue-50/60 to-indigo-50/30 p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-bold text-slate-800 text-[13px] leading-tight line-clamp-2" title={inscricaoAtual.titulo_curso}>
                          {inscricaoAtual.titulo_curso}
                        </h3>
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold whitespace-nowrap border ${badge.className}`}>
                          {badge.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap mt-1">
                        <span className="text-[11px] font-bold text-slate-600 bg-white px-1.5 py-0.5 rounded shadow-sm border border-slate-200">
                          {inscricaoAtual.codigo_turma}
                        </span>
                        {mod && <span className={`text-[11px] font-semibold ${mod.color}`}>{mod.label}</span>}
                        <span className="text-[11px] text-slate-500">
                          {formatData(inscricaoAtual.data_inicio)} → {formatData(inscricaoAtual.data_termino)}
                        </span>
                      </div>
                      {inscricaoAtual.carga_horaria > 0 && (
                        <p className="text-[11px] text-slate-400 mt-1.5">{inscricaoAtual.carga_horaria}h de carga horária</p>
                      )}
                      {/* Link para Sala de Aula */}
                      {inscricaoAtual.turma?.id && (
                        <Link
                          href={`/dashboard/turmas/${inscricaoAtual.turma.id}`}
                          className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-bold text-blue-600 hover:text-blue-500 transition-colors"
                        >
                          Abrir Sala de Aula <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      )}
                    </div>
                  );
                })()}

                {/* Controles de paginação do carousel */}
                {inscricoes.length > 1 && (
                  <div className="flex items-center justify-between mt-1">
                    <button
                      onClick={prevCard}
                      disabled={carouselIndex === 0}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-[11px] font-bold text-slate-400">
                      {carouselIndex + 1} de {inscricoes.length} matrículas
                    </span>
                    <button
                      onClick={nextCard}
                      disabled={carouselIndex === inscricoes.length - 1}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <Link
            href="/dashboard/cursos"
            className="mt-5 flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-500 transition-colors group/link w-fit"
          >
            Explorar Catálogo <ArrowRight className="w-4 h-4 group-hover/link:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* ── CATÁLOGO ── */}
        <div className="clean-card p-6 flex flex-col hover:border-cyan-200 hover:shadow-md transition-all group">
          <div className="w-12 h-12 rounded-xl bg-cyan-50 flex items-center justify-center mb-5 border border-cyan-100 group-hover:bg-cyan-100 transition-colors">
            <BookOpen className="w-6 h-6 text-cyan-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">Inscrições Abertas</h2>
          <p className="text-sm text-slate-500 mt-1.5 flex-1 leading-relaxed">Descubra novas oportunidades de capacitação profissional disponíveis para você.</p>
          <Link
            href="/dashboard/cursos"
            className="mt-6 flex items-center gap-2 text-sm font-bold text-cyan-600 hover:text-cyan-500 transition-colors group/link w-fit"
          >
            Ver turmas abertas <ArrowRight className="w-4 h-4 group-hover/link:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* ── AGENDA ── */}
        <div className="clean-card p-6 flex flex-col hover:border-violet-200 hover:shadow-md transition-all group">
          <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center mb-5 border border-violet-100 group-hover:bg-violet-100 transition-colors">
            <Calendar className="w-6 h-6 text-violet-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">Agenda Institucional</h2>
          <p className="text-sm text-slate-500 mt-1.5 flex-1 leading-relaxed">Visualize eventos, reservas de espaços e calendário de aulas da escola.</p>
          <Link
            href="/dashboard/agenda"
            className="mt-6 flex items-center gap-2 text-sm font-bold text-violet-600 hover:text-violet-500 transition-colors group/link w-fit"
          >
            Ver agenda <ArrowRight className="w-4 h-4 group-hover/link:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* ── ADMIN STATS ── Visão Geral da Gestão (apenas para Admin) */}
        {isAdmin && (
          <div className="clean-card p-6 md:p-8 flex flex-col md:col-span-2 lg:col-span-3 bg-slate-50 border-slate-200 shadow-none">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary-muted flex items-center justify-center border border-primary/20">
                  <TrendingUp className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Visão Geral da Gestão</h2>
                  <p className="text-[12px] text-slate-500 mt-0.5">Métricas consolidadas do portal</p>
                </div>
              </div>
              <span className="px-3 py-1.5 rounded-lg bg-primary text-xs font-bold text-white uppercase tracking-wider w-fit shadow-md shadow-primary/20">
                Administrador
              </span>
            </div>

            {/* Grid de métricas 3x2 */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
              {[
                {
                  label: 'Turmas Ativas',
                  value: adminStats?.turmas_ativas,
                  icon: <BookMarked className="w-5 h-5" />,
                  color: 'text-emerald-600',
                  bg: 'bg-emerald-50',
                  border: 'border-emerald-100',
                },
                {
                  label: 'Turmas Previstas',
                  value: adminStats?.turmas_previstas,
                  icon: <Calendar className="w-5 h-5" />,
                  color: 'text-blue-600',
                  bg: 'bg-blue-50',
                  border: 'border-blue-100',
                },
                {
                  label: 'Turmas Concluídas',
                  value: adminStats?.turmas_concluidas,
                  icon: <ClipboardCheck className="w-5 h-5" />,
                  color: 'text-slate-600',
                  bg: 'bg-slate-100',
                  border: 'border-slate-200',
                },
                {
                  label: 'Total Gasto',
                  value: adminStats ? formatCurrency(adminStats.custo_total) : undefined,
                  icon: <DollarSign className="w-5 h-5" />,
                  color: 'text-amber-600',
                  bg: 'bg-amber-50',
                  border: 'border-amber-100',
                  small: true,
                },
                {
                  label: 'Matrículas',
                  value: adminStats?.total_matriculas,
                  icon: <BarChart3 className="w-5 h-5" />,
                  color: 'text-indigo-600',
                  bg: 'bg-indigo-50',
                  border: 'border-indigo-100',
                },
                {
                  label: 'Usuários',
                  value: adminStats?.total_usuarios,
                  icon: <Users className="w-5 h-5" />,
                  color: 'text-violet-600',
                  bg: 'bg-violet-50',
                  border: 'border-violet-100',
                },
              ].map((m) => (
                <div key={m.label} className={cn('p-4 rounded-2xl bg-white border flex flex-col gap-2', m.border)}>
                  <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', m.bg, m.color)}>
                    {m.icon}
                  </div>
                  <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider leading-tight">{m.label}</p>
                  <p className={cn('font-black mt-auto', m.small ? 'text-lg' : 'text-2xl', m.value !== undefined ? m.color : 'text-slate-300')}>
                    {m.value !== undefined
                      ? m.value
                      : <Loader2 className="w-5 h-5 animate-spin inline" />}
                  </p>
                </div>
              ))}
            </div>

            {/* Aprovações Pendentes — alertinha */}
            {adminStats && adminStats.aprovacoes_pendentes > 0 && (
              <div className="mt-4 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <span className="w-6 h-6 rounded-full bg-amber-400 text-white text-[11px] font-black flex items-center justify-center shrink-0">
                  {adminStats.aprovacoes_pendentes}
                </span>
                <p className="text-[13px] font-semibold text-amber-800">
                  {adminStats.aprovacoes_pendentes === 1 ? 'Há 1 inscrição pendente' : `Há ${adminStats.aprovacoes_pendentes} inscrições pendentes`} de aprovação da chefia.
                </p>
                <Link href="/dashboard/equipe" className="ml-auto text-[12px] font-bold text-amber-700 hover:text-amber-600 whitespace-nowrap">
                  Ver agora →
                </Link>
              </div>
            )}
          </div>
        )}

      </section>
    </div>
  );
}