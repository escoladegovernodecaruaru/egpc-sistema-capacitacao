"use client";

import { useEffect, useState, useCallback } from "react";
import { useProfile } from "@/contexts/ProfileContext";
import {
  BookOpen, GraduationCap, TrendingUp, ArrowRight, Loader2,
  ChevronLeft, ChevronRight, Users, DollarSign, ClipboardCheck,
  BookMarked, BarChart3, Calendar, CheckCircle2, UserX, FileWarning, Ban, Percent
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
  alunos_aprovados: number;
  desistentes: number;
  reprovados_nota: number;
  reprovados_falta: number;
}

interface AlunoStats {
  matriculas_realizadas: number;
  cursos_concluidos: number;
  total_horas_capacitacao: number;
  percentual_presenca: number;
  proxima_aula?: {
    turma_id: number;
    codigo_turma: string;
    titulo_curso: string;
    data: string;
    hora_inicio: string;
    espaco: string;
  } | null;
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
  inscrito:        { label: 'Inscrito',       className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  concluido:       { label: 'Concluído',      className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  cancelado:       { label: 'Cancelado',      className: 'bg-red-100 text-red-800 border-red-200' },
  reprovado:       { label: 'Reprovado',      className: 'bg-red-100 text-red-800 border-red-200' },
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
  const [alunoStats, setAlunoStats] = useState<AlunoStats | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);

  useEffect(() => {
    if (!profile) return;

    // 1. Carrega os dados de jornada do aluno (carousel)
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

    // 2. Carrega as métricas (Aluno para todos; Admin apenas se for staff)
    async function loadStats() {
      // Busca de aluno-stats
      try {
        const alunoData = await fetchApi<AlunoStats>('/cursos/aluno-stats/');
        setAlunoStats(alunoData);
      } catch (err) {
        console.error("Erro ao carregar estatísticas do aluno:", err);
      }

      // Busca gerencial em paralelo — erro aqui NÃO afeta o painel do aluno
      if (profile?.is_staff) {
        try {
          const adminData = await fetchApi<AdminStats>('/cursos/admin-stats/');
          setAdminStats(adminData);
        } catch (err) {
          console.error("Erro ao carregar estatísticas admin:", err);
        }
      }
    }

    loadMinhasInscricoes();
    loadStats();
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
    <div className="space-y-8 animate-[fade-in_0.4s_ease-out] text-slate-800 max-w-7xl mx-auto pb-12">

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

      {/* ── VISÃO GERAL DA GESTÃO (ADMIN) - ELEVADA AO TOPO ── */}
      {isAdmin && adminStats && (
        <section className="clean-card p-6 md:p-8 bg-slate-50 border-slate-200 shadow-none">
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

          {/* Grid Principal de Métricas */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
            {[
              { label: 'Turmas Ativas', value: adminStats.turmas_ativas, icon: <BookMarked className="w-5 h-5" />, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
              { label: 'Turmas Previstas', value: adminStats.turmas_previstas, icon: <Calendar className="w-5 h-5" />, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
              { label: 'Matrículas', value: adminStats.total_matriculas, icon: <Users className="w-5 h-5" />, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100' },
              { label: 'Aprovados', value: adminStats.alunos_aprovados, icon: <CheckCircle2 className="w-5 h-5" />, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
              { label: 'Reprov. Falta', value: adminStats.reprovados_falta, icon: <UserX className="w-5 h-5" />, color: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-200' },
              { label: 'Reprov. Nota', value: adminStats.reprovados_nota, icon: <FileWarning className="w-5 h-5" />, color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-200' },
            ].map((m) => (
              <div key={m.label} className={cn('p-4 rounded-2xl bg-white border flex flex-col gap-2', m.border)}>
                <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', m.bg, m.color)}>
                  {m.icon}
                </div>
                <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider leading-tight">{m.label}</p>
                <p className={cn('font-black text-2xl mt-auto', m.value !== undefined ? m.color : 'text-slate-300')}>
                  {m.value}
                </p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Gráfico de Eficiência (Aprovação vs Evasão/Reprovação) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-center">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest mb-4">Eficiência Geral</h3>
              
              <div className="space-y-4 w-full">
                {/* Barra Aprovação */}
                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-emerald-600">Alunos Aprovados</span>
                    <span className="text-slate-600">{adminStats.alunos_aprovados}</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.max(5, (adminStats.alunos_aprovados / Math.max(1, adminStats.total_matriculas)) * 100)}%` }} />
                  </div>
                </div>
                
                {/* Barra Reprovação Nota */}
                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-red-500">Reprovados por Nota</span>
                    <span className="text-slate-600">{adminStats.reprovados_nota}</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-red-400 rounded-full" style={{ width: `${Math.max(5, (adminStats.reprovados_nota / Math.max(1, adminStats.total_matriculas)) * 100)}%` }} />
                  </div>
                </div>

                {/* Barra Reprovação Falta */}
                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-orange-500">Reprovados por Falta</span>
                    <span className="text-slate-600">{adminStats.reprovados_falta}</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-400 rounded-full" style={{ width: `${Math.max(5, (adminStats.reprovados_falta / Math.max(1, adminStats.total_matriculas)) * 100)}%` }} />
                  </div>
                </div>

                {/* Barra Desistentes */}
                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-slate-500">Desistentes (Cancelamentos)</span>
                    <span className="text-slate-600">{adminStats.desistentes}</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-slate-400 rounded-full" style={{ width: `${Math.max(5, (adminStats.desistentes / Math.max(1, adminStats.total_matriculas)) * 100)}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Outras Infos Adicionais */}
            <div className="flex flex-col gap-4 justify-between">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <DollarSign className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest">Custo Total em Turmas</p>
                  <p className="text-xl font-black text-slate-800">{formatCurrency(adminStats.custo_total)}</p>
                </div>
              </div>

              {adminStats.aprovacoes_pendentes > 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] text-amber-600 font-bold uppercase tracking-widest mb-1">Ações Pendentes</p>
                    <p className="text-sm font-semibold text-amber-800">
                      Há {adminStats.aprovacoes_pendentes} inscrições aguardando aprovação.
                    </p>
                  </div>
                  <Link href="/dashboard/equipe" className="px-4 py-2 bg-white text-amber-700 text-xs font-bold rounded-lg border border-amber-200 hover:bg-amber-100 transition-colors shrink-0">
                    Ver Equipe
                  </Link>
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">Tudo em dia!</p>
                    <p className="text-xs text-emerald-600">Nenhuma aprovação pendente.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── VISÃO DO ALUNO (Para todos) ── */}
      {alunoStats && (
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-slate-800">Minha Jornada de Capacitação</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            <div className="clean-card p-5 flex items-center gap-4 bg-white border border-slate-200 hover:border-indigo-200 transition-colors">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl"><BookOpen className="w-6 h-6" /></div>
              <div>
                <p className="text-2xl font-black text-slate-800">{alunoStats.matriculas_realizadas}</p>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Matrículas Realizadas</p>
              </div>
            </div>

            <div className="clean-card p-5 flex items-center gap-4 bg-white border border-slate-200 hover:border-emerald-200 transition-colors">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><GraduationCap className="w-6 h-6" /></div>
              <div>
                <p className="text-2xl font-black text-slate-800">{alunoStats.cursos_concluidos}</p>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Cursos Concluídos</p>
              </div>
            </div>

            <div className="clean-card p-5 flex items-center gap-4 bg-white border border-slate-200 hover:border-blue-200 transition-colors">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Percent className="w-6 h-6" /></div>
              <div>
                <p className="text-2xl font-black text-slate-800">{alunoStats.percentual_presenca}%</p>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Média de Presença</p>
              </div>
            </div>

          </div>
        </section>
      )}

      {/* ── PRÓXIMA AULA EM DESTAQUE ── */}
      {alunoStats?.proxima_aula && (
        <section className="clean-card bg-indigo-600 border-indigo-700 text-white p-6 relative overflow-hidden shadow-md mb-6">
          <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-400 rounded-full blur-[50px] opacity-30 -translate-y-1/2 translate-x-1/4 pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-indigo-500 flex items-center justify-center shrink-0 border border-indigo-400 shadow-inner">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-indigo-200 uppercase tracking-widest mb-1 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                  Sua Próxima Aula
                </p>
                <h3 className="text-lg font-bold leading-tight">{alunoStats.proxima_aula.titulo_curso}</h3>
                <p className="text-sm text-indigo-100 mt-1">
                  Turma {alunoStats.proxima_aula.codigo_turma} • {formatData(alunoStats.proxima_aula.data)} às {alunoStats.proxima_aula.hora_inicio}
                </p>
                <div className="inline-block mt-2 bg-indigo-500/50 backdrop-blur-sm border border-indigo-400/50 rounded-md px-2.5 py-1 text-xs font-bold">
                  📍 {alunoStats.proxima_aula.espaco}
                </div>
              </div>
            </div>
            
            <Link
              href={`/dashboard/turmas/${alunoStats.proxima_aula.turma_id}`}
              className="bg-white text-indigo-700 px-5 py-2.5 rounded-lg font-bold text-sm hover:bg-indigo-50 transition-colors shadow-sm whitespace-nowrap text-center self-start md:self-center"
            >
              Abrir Sala de Aula
            </Link>
          </div>
        </section>
      )}

      {/* ── MÓDULOS (CARDS INFERIORES) ── */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        {/* ── MINHA JORNADA (carousel) ── */}
        <div className="clean-card p-6 flex flex-col hover:border-indigo-200 hover:shadow-md transition-all">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-5 border border-blue-100">
            <GraduationCap className="w-6 h-6 text-blue-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-1.5">Andamento dos Cursos</h2>

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

      </section>
    </div>
  );
}