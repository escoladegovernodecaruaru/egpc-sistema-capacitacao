"use client";

import { useEffect, useState } from "react";
import {
  BookOpen, CalendarDays, CheckCircle2, ChevronLeft, Save, Loader2,
  ClipboardList, AlertCircle, XCircle, FileText, FolderOpen,
  Play, Plus, Trash2, Video, ToggleLeft, ToggleRight, Clock, Award, ShieldCheck
} from "lucide-react";
import { fetchApi } from "@/lib/api";
import { useProfile } from "@/contexts/ProfileContext";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

/* ─── Types ─────────────────────────────────────────────────── */
interface AlunoDiario {
  inscricao_id: number;
  nome: string;
  cpf: string;
  nota: number | null | string;
  status: string;
  presencas: Record<string, string>;
}

interface TurmaInstrutor {
  id: number;
  codigo_turma: string;
  status: string;
  curso: { titulo: string; tipo: string };
  eventos?: { id: number; data: string }[];
}

/* ─── Helpers ────────────────────────────────────────────────── */
const formatDateToBR = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}`;
};

/* ─── Page ───────────────────────────────────────────────────── */
export default function DiarioPage() {
  const { profile } = useProfile();

  // Navegação em 3 camadas: cursos → turmas → diario/conteudo
  type View = 'cursos' | 'turmas' | 'diario';
  const [currentView, setCurrentView] = useState<View>('cursos');
  const [minhasTurmas, setMinhasTurmas] = useState<TurmaInstrutor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cursosAgrupados, setCursosAgrupados] = useState<{ titulo: string; turmas: TurmaInstrutor[] }[]>([]);
  const [cursoSelecionado, setCursoSelecionado] = useState<string>('');
  const [turmasFiltradas, setTurmasFiltradas] = useState<TurmaInstrutor[]>([]);

  // Estados do Diário Específico
  const [turmaId, setTurmaId] = useState<number | null>(null);
  const [turmaInfo, setTurmaInfo] = useState<{ codigo: string; status: string; titulo?: string; tipo?: string } | null>(null);
  const [eventos, setEventos] = useState<{ id: number; data: string }[]>([]);
  const [alunos, setAlunos] = useState<AlunoDiario[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Sub-tabs do diário: frequencia | conteudo
  const [diarioTab, setDiarioTab] = useState<'frequencia' | 'conteudo'>('frequencia');

  // Gestão de Conteúdo LMS (dentro do diário)
  const [modulos, setModulos] = useState<any[]>([]);
  const [loadingModulos, setLoadingModulos] = useState(false);
  const [novoModuloTitulo, setNovoModuloTitulo] = useState('');
  const [savingModulo, setSavingModulo] = useState(false);

  // Nova atividade
  const [novaAtiv, setNovaAtiv] = useState<{
    modulo_id: number | null;
    titulo: string;
    tipo: 'VIDEO_YOUTUBE' | 'LEITURA' | 'TAREFA';
    url_video: string;
    descricao: string;
    carga_horaria_recompensa: number;
    contarCH: boolean;
  }>({
    modulo_id: null,
    titulo: '',
    tipo: 'VIDEO_YOUTUBE',
    url_video: '',
    descricao: '',
    carga_horaria_recompensa: 0,
    contarCH: false,
  });

  /* ─── Load ─────────────────────────────────────────────── */
  useEffect(() => {
    carregarTurmas();
  }, []);

  useEffect(() => {
    if (minhasTurmas.length > 0) {
      // Agrupa turmas por curso
      const map: Record<string, TurmaInstrutor[]> = {};
      minhasTurmas.forEach(t => {
        const key = t.curso?.titulo || 'Sem Título';
        if (!map[key]) map[key] = [];
        map[key].push(t);
      });
      setCursosAgrupados(Object.entries(map).map(([titulo, turmas]) => ({ titulo, turmas })));
    }
  }, [minhasTurmas]);

  const carregarTurmas = async () => {
    setIsLoading(true);
    try {
      const res = await fetchApi<any>("/cursos/turmas/instrutor/");
      setMinhasTurmas(Array.isArray(res) ? res : res?.results || []);
    } catch {
      toast.error("Erro ao carregar suas turmas.");
    } finally {
      setIsLoading(false);
    }
  };

  const selecionarCurso = (titulo: string, turmas: TurmaInstrutor[]) => {
    setCursoSelecionado(titulo);
    setTurmasFiltradas(turmas);
    setCurrentView('turmas');
  };

  const abrirDiario = async (id: number) => {
    setTurmaId(id);
    setCurrentView('diario');
    setDiarioTab('frequencia');
    setIsLoading(true);
    try {
      const data = await fetchApi<any>(`/cursos/diario/${id}/`);
      setTurmaInfo({ ...data.turma, titulo: data.turma?.titulo, tipo: data.turma?.tipo });
      setEventos(data.eventos);
      const alunosNormalizados = data.alunos.map((a: AlunoDiario) => {
        const p = { ...a.presencas };
        data.eventos.forEach((e: any) => {
          if (!(e.id in p)) p[e.id] = '';
        });
        return { ...a, presencas: p };
      });
      setAlunos(alunosNormalizados);
    } catch {
      toast.error("Erro ao carregar dados do diário.");
      setCurrentView('turmas');
    } finally {
      setIsLoading(false);
    }
  };

/* ─── Carregar módulos (aba Conteúdo) ─────────────────── */
  const carregarModulos = async () => {
    if (!turmaId) return;
    setLoadingModulos(true);
    try {
      // CORREÇÃO: Puxa os dados direto da rota da Sala de Aula, que já vem com a árvore completa!
      const data = await fetchApi<any>(`/cursos/turmas/${turmaId}/sala-de-aula/`);
      setModulos(data.modulos || []);
    } catch {
      toast.error("Erro ao carregar módulos.");
    } finally {
      setLoadingModulos(false);
    }
  };

  useEffect(() => {
    if (currentView === 'diario' && diarioTab === 'conteudo') {
      carregarModulos();
    }
  }, [currentView, diarioTab, turmaId]);

  /* ─── Presença / Nota ─────────────────────────────────── */
  const togglePresenca = (idxAluno: number, eventoId: number) => {
    const statusAtual = alunos[idxAluno].presencas[eventoId];
    let next = 'PRESENTE';
    if (statusAtual === 'PRESENTE') next = 'FALTA';
    else if (statusAtual === 'FALTA') next = 'JUSTIFICADA';
    else if (statusAtual === 'JUSTIFICADA') next = 'PRESENTE';
    setAlunos(prev =>
      prev.map((aluno, idx) =>
        idx === idxAluno ? { ...aluno, presencas: { ...aluno.presencas, [eventoId]: next } } : aluno
      )
    );
  };

  const setNota = (idxAluno: number, valor: string) => {
    setAlunos(prev =>
      prev.map((aluno, idx) => idx === idxAluno ? { ...aluno, nota: valor } : aluno)
    );
  };

  const salvarDiario = async (fechar: boolean = false) => {
    if (fechar && !confirm("Atenção! Fechar o diário calculará as aprovações de forma definitiva. Deseja continuar?")) {
      return;
    }
    setIsSaving(true);
    try {
      await fetchApi(`/cursos/diario/${turmaId}/`, {
        method: "POST",
        body: JSON.stringify({ alunos, fechar_diario: fechar })
      });
      toast.success(fechar ? "Diário finalizado!" : "Rascunho salvo!");
      if (fechar) {
        setCurrentView('turmas');
        carregarTurmas();
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar o diário.");
    } finally {
      setIsSaving(false);
    }
  };

  const podeFecharDiario = () => {
    if (profile?.is_staff) return true;
    if (!eventos || eventos.length === 0) return true;
    const ultimoEvento = eventos[eventos.length - 1];
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const dataUltimo = new Date(ultimoEvento.data + "T00:00:00"); dataUltimo.setHours(0, 0, 0, 0);
    return hoje >= dataUltimo;
  };

  /* ─── LMS: Criar módulo ─────────────────────────────── */
  const criarModulo = async () => {
    if (!novoModuloTitulo.trim()) return;
    setSavingModulo(true);
    try {
      await fetchApi(`/cursos/turmas/${turmaId}/modulos/`, {
        method: 'POST',
        body: JSON.stringify({ titulo: novoModuloTitulo, ordem: modulos.length + 1 })
      });
      setNovoModuloTitulo('');
      await carregarModulos();
      toast.success("Módulo criado!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar módulo.");
    } finally {
      setSavingModulo(false);
    }
  };

  /* ─── LMS: Criar atividade ──────────────────────────── */
  const criarAtividade = async () => {
    if (!novaAtiv.modulo_id || !novaAtiv.titulo.trim()) {
      toast.error("Preencha o módulo e o título da atividade.");
      return;
    }
    setSavingModulo(true);
    try {
      await fetchApi(`/cursos/modulos/${novaAtiv.modulo_id}/atividades/`, {
        method: 'POST',
        body: JSON.stringify({
          titulo: novaAtiv.titulo,
          tipo: novaAtiv.tipo,
          url_video: novaAtiv.url_video || null,
          descricao: novaAtiv.descricao || null,
          carga_horaria_recompensa: novaAtiv.contarCH ? novaAtiv.carga_horaria_recompensa : 0,
          ordem: 0,
        })
      });
      setNovaAtiv({ modulo_id: novaAtiv.modulo_id, titulo: '', tipo: 'VIDEO_YOUTUBE', url_video: '', descricao: '', carga_horaria_recompensa: 0, contarCH: false });
      await carregarModulos();
      toast.success(novaAtiv.contarCH
        ? "Atividade criada! Aguardando aprovação do administrador para contar na CH."
        : "Atividade criada!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar atividade.");
    } finally {
      setSavingModulo(false);
    }
  };

  const excluirAtividade = async (atividadeId: number) => {
    if (!confirm("Excluir esta atividade?")) return;
    try {
      await fetchApi(`/cursos/atividades/${atividadeId}/detalhe/`, { method: 'DELETE' });
      await carregarModulos();
      toast.success("Atividade excluída.");
    } catch {
      toast.error("Erro ao excluir atividade.");
    }
  };

  const isTipoEAD = turmaInfo?.tipo === 'REMOTO' || turmaInfo?.tipo === 'HIBRIDO';

  /* ─── Render ─────────────────────────────────────────── */
  return (
    <div className="space-y-6 max-w-[1400px] w-full mx-auto text-slate-800 animate-[fade-in_0.4s_ease-out]">

      {/* HEADER */}
      <div className="clean-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shadow-sm">
            <ClipboardList className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Diário do Instrutor</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">Gerencie frequência, notas e conteúdo das suas turmas.</p>
          </div>
        </div>
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-[12px] text-slate-400 font-medium">
          <button onClick={() => setCurrentView('cursos')} className={cn("hover:text-emerald-600 transition-colors", currentView === 'cursos' && 'text-slate-700 font-bold')}>Cursos</button>
          {currentView !== 'cursos' && (
            <>
              <span>/</span>
              <button onClick={() => setCurrentView('turmas')} className={cn("hover:text-emerald-600 transition-colors", currentView === 'turmas' && 'text-slate-700 font-bold')}>{cursoSelecionado}</button>
            </>
          )}
          {currentView === 'diario' && (
            <>
              <span>/</span>
              <span className="text-slate-700 font-bold">Turma {turmaInfo?.codigo}</span>
            </>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">

        {/* ── VIEW 1: LISTA DE CURSOS ── */}
        {currentView === 'cursos' && (
          <motion.div key="cursos" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>
            ) : cursosAgrupados.length === 0 ? (
              <div className="clean-card p-16 text-center flex flex-col items-center bg-white border-dashed border-2 border-slate-200">
                <BookOpen className="w-12 h-12 text-slate-300 mb-4" />
                <p className="text-[15px] font-bold text-slate-600">Nenhuma turma atribuída</p>
                <p className="text-[13px] text-slate-400 mt-1">Você não está vinculado como instrutor em nenhuma turma ativa.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {cursosAgrupados.map(({ titulo, turmas }) => (
                  <div
                    key={titulo}
                    onClick={() => selecionarCurso(titulo, turmas)}
                    className="clean-card p-6 bg-white border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-4">
                      <FolderOpen className="w-5 h-5 text-emerald-600" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 leading-snug">{titulo}</h3>
                    <div className="mt-4 flex items-center justify-between text-sm text-slate-500 border-t border-slate-100 pt-4">
                      <span className="flex items-center gap-1.5 font-medium">
                        <CalendarDays className="w-4 h-4" />
                        {turmas.length} turma{turmas.length !== 1 && 's'}
                      </span>
                      <span className="text-emerald-600 font-bold group-hover:translate-x-1 transition-transform">Ver Turmas →</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ── VIEW 2: LISTA DE TURMAS DO CURSO ── */}
        {currentView === 'turmas' && (
          <motion.div key="turmas" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
            <div className="flex items-center gap-3 mb-4">
              <button onClick={() => setCurrentView('cursos')} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:border-emerald-300 hover:text-emerald-600 transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h2 className="text-lg font-bold text-slate-700">{cursoSelecionado}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {turmasFiltradas.map(turma => (
                <div
                  key={turma.id}
                  onClick={() => abrirDiario(turma.id)}
                  className="clean-card p-6 bg-white border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 px-2.5 py-1 rounded-md">
                      Turma {turma.codigo_turma}
                    </span>
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border",
                      turma.status === 'CONCLUIDA' || turma.status === 'FINALIZADA'
                        ? 'bg-slate-100 text-slate-500 border-slate-200'
                        : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                    )}>
                      {turma.status}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 leading-snug">{turma.curso?.titulo || "Curso sem título"}</h3>
                  <div className="mt-6 flex items-center justify-between text-sm text-slate-500 border-t border-slate-100 pt-4">
                    <span className="flex items-center gap-1.5 font-medium">
                      <CalendarDays className="w-4 h-4" />
                      {turma.eventos?.length || 0} Encontros
                    </span>
                    <span className="text-emerald-600 font-bold group-hover:translate-x-1 transition-transform">Abrir Diário →</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── VIEW 3: DIÁRIO (Frequência + Conteúdo) ── */}
        {currentView === 'diario' && (
          <motion.div key="diario" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="space-y-4">

            {/* Header da Turma */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-800 p-5 rounded-2xl shadow-lg">
              <div className="flex items-center gap-4">
                <button onClick={() => setCurrentView('turmas')} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-colors">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="text-lg font-bold text-white">Turma {turmaInfo?.codigo}</h2>
                  <p className="text-[12px] text-slate-400 font-medium">{turmaInfo?.titulo}</p>
                </div>
              </div>
              {/* Botões de salvar só aparecem na aba de frequência */}
              {diarioTab === 'frequencia' && (
                <div className="flex items-center gap-3">
                  <button onClick={() => salvarDiario(false)} disabled={isSaving || turmaInfo?.status === 'CONCLUIDA'} className="px-5 py-2.5 rounded-xl text-[13px] font-bold text-white bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-50 flex items-center gap-2">
                    <Save className="w-4 h-4" /> Salvar Rascunho
                  </button>
                  {podeFecharDiario() && (
                    <button onClick={() => salvarDiario(true)} disabled={isSaving || turmaInfo?.status === 'CONCLUIDA'} className="btn-success !px-6 flex items-center gap-2">
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      Fechar Diário
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Sub-tabs */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto">
              {(['frequencia', 'conteudo'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setDiarioTab(tab)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-bold whitespace-nowrap transition-all flex-1 justify-center",
                    diarioTab === tab ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  {tab === 'frequencia' ? <><ClipboardList className="w-4 h-4" /> Frequência e Notas</> : <><Play className="w-4 h-4" /> Conteúdo LMS</>}
                </button>
              ))}
            </div>

            {/* ABA: FREQUÊNCIA */}
            {diarioTab === 'frequencia' && (
              isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>
              ) : alunos.length === 0 ? (
                <div className="clean-card p-12 text-center bg-white border border-slate-200">
                  <AlertCircle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
                  <p className="font-bold text-slate-700">Nenhum aluno ativo nesta turma.</p>
                </div>
              ) : (
                <div className="clean-card bg-white border border-slate-200 overflow-hidden shadow-sm">
                  {/* Legenda */}
                  <div className="bg-slate-50 border-b border-slate-100 px-6 py-3 flex gap-6 flex-wrap">
                    {[
                      { icon: <CheckCircle2 className="w-3 h-3" />, label: "Presente", bg: "bg-emerald-100 text-emerald-600" },
                      { icon: <XCircle className="w-3 h-3" />, label: "Falta", bg: "bg-red-50 text-red-400" },
                      { icon: <FileText className="w-3 h-3" />, label: "Justificada", bg: "bg-amber-100 text-amber-600" },
                    ].map(l => (
                      <div key={l.label} className="flex items-center gap-2 text-[11px] font-bold text-slate-600 uppercase">
                        <span className={cn("w-4 h-4 rounded flex items-center justify-center", l.bg)}>{l.icon}</span>
                        {l.label}
                      </div>
                    ))}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-4 font-extrabold text-[11px] uppercase tracking-widest text-slate-500 min-w-[250px]">Aluno</th>
                          {eventos.map((e, i) => (
                            <th key={e.id} className="px-3 py-4 text-center font-extrabold text-[11px] uppercase tracking-widest text-slate-500 border-l border-slate-100">
                              {formatDateToBR(e.data)}<br /><span className="font-medium text-[9px] opacity-60">Aula {i + 1}</span>
                            </th>
                          ))}
                          <th className="px-6 py-4 text-center font-extrabold text-[11px] uppercase tracking-widest text-indigo-600 bg-indigo-50/50 border-l border-slate-200 w-32">Nota</th>
                          <th className="px-6 py-4 text-center font-extrabold text-[11px] uppercase tracking-widest text-slate-500 border-l border-slate-200">Situação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {alunos.map((aluno, idxAluno) => (
                          <tr key={aluno.inscricao_id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-3">
                              <p className="font-bold text-slate-700 text-[13px]">{aluno.nome}</p>
                              <p className="text-[10px] font-mono text-slate-400 mt-0.5">{aluno.cpf}</p>
                            </td>
                            {eventos.map(e => {
                              const st = aluno.presencas[e.id];
                              return (
                                <td key={e.id} className="px-3 py-3 text-center border-l border-slate-50">
                                  <button
                                    onClick={() => togglePresenca(idxAluno, e.id)}
                                    title={`Status: ${st || 'Não registrado'}`}
                                    className={cn(
                                      "w-7 h-7 rounded flex items-center justify-center mx-auto transition-all shadow-sm border",
                                      st === 'PRESENTE' ? "bg-emerald-100 text-emerald-600 border-emerald-200 hover:bg-emerald-200" :
                                      st === 'FALTA' ? "bg-red-50 text-red-500 border-red-200 hover:bg-red-100" :
                                      st === 'JUSTIFICADA' ? "bg-amber-100 text-amber-600 border-amber-200 hover:bg-amber-200" :
                                      "bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100" // Estado Vazio (-)
                                    )}
                                  >
                                    {st === 'PRESENTE' ? <CheckCircle2 className="w-4 h-4" /> :
                                    st === 'FALTA' ? <XCircle className="w-4 h-4" /> :
                                    st === 'JUSTIFICADA' ? <FileText className="w-4 h-4" /> :
                                    <span className="font-black">-</span>}
                                  </button>
                                </td>
                              );
                            })}
                            <td className="px-6 py-3 border-l border-slate-200 bg-indigo-50/10">
                              <input
                                type="number" step="0.1" min="0" max="10"
                                value={aluno.nota !== null ? aluno.nota : ""}
                                onChange={e => setNota(idxAluno, e.target.value)}
                                placeholder="--"
                                className="w-16 mx-auto block text-center font-bold text-indigo-700 bg-white border border-slate-300 rounded-lg py-1.5 text-[13px] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none"
                              />
                            </td>
                            <td className="px-6 py-3 text-center border-l border-slate-200">
                              <span className={cn("px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-widest",
                                aluno.status === 'concluido' ? "bg-emerald-100 text-emerald-700" :
                                aluno.status === 'reprovado' ? "bg-red-100 text-red-700" :
                                "bg-slate-100 text-slate-500"
                              )}>
                                {aluno.status === 'concluido' ? 'Aprovado' : aluno.status === 'reprovado' ? 'Reprovado' : 'Pendente'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            )}

            {/* ABA: CONTEÚDO LMS */}
            {diarioTab === 'conteudo' && (
              <div className="space-y-6">

                {/* Aviso de CH */}
                <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                  <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                  <p className="text-[13px] text-indigo-800 leading-relaxed font-medium">
                    Atividades que <strong>somam carga horária</strong> precisam ser aprovadas pelo Administrador antes de ficarem visíveis para os alunos.{!isTipoEAD && " Vídeos só contam como CH em turmas Híbridas ou EAD."}
                  </p>
                </div>

                {/* Criar módulo */}
                <div className="clean-card p-5 bg-white border border-slate-200">
                  <h3 className="text-[13px] font-bold text-slate-700 mb-3 flex items-center gap-2"><Plus className="w-4 h-4 text-emerald-600" /> Novo Módulo</h3>
                  <div className="flex gap-3">
                    <input
                      value={novoModuloTitulo}
                      onChange={e => setNovoModuloTitulo(e.target.value)}
                      placeholder="Ex: Módulo 1 — Introdução ao tema"
                      className="flex-1 input-light"
                    />
                    <button
                      onClick={criarModulo}
                      disabled={savingModulo || !novoModuloTitulo.trim()}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[13px] font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {savingModulo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Criar
                    </button>
                  </div>
                </div>

                {/* Lista de módulos */}
                {loadingModulos ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
                ) : modulos.length === 0 ? (
                  <div className="clean-card p-10 text-center bg-white text-slate-400 border-dashed border-2 border-slate-200">
                    <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="font-bold">Nenhum módulo criado ainda.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {modulos.map(modulo => (
                      <div key={modulo.id} className="clean-card bg-white border border-slate-200 overflow-hidden">
                        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                          <p className="font-bold text-slate-800 text-sm">{modulo.titulo}</p>
                          <span className="text-[11px] text-slate-400">{modulo.atividades?.length || 0} atividades</span>
                        </div>

                        {/* Atividades existentes */}
                        {modulo.atividades?.length > 0 && (
                          <div className="divide-y divide-slate-50">
                            {modulo.atividades.map((ativ: any) => (
                              <div key={ativ.id} className="flex items-center gap-4 px-5 py-3">
                                <div className={cn(
                                  "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                                  ativ.tipo === 'VIDEO_YOUTUBE' ? "bg-red-50 text-red-500" : "bg-slate-100 text-slate-500"
                                )}>
                                  {ativ.tipo === 'VIDEO_YOUTUBE' ? <Video className="w-3.5 h-3.5" /> : <BookOpen className="w-3.5 h-3.5" />}
                                </div>
                                <div className="flex-1">
                                  <p className="text-[13px] font-bold text-slate-700">{ativ.titulo}</p>
                                  {ativ.carga_horaria_recompensa > 0 && (
                                    <span className={cn(
                                      "text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5 inline-flex items-center gap-1",
                                      ativ.aprovado_admin
                                        ? "bg-emerald-50 text-emerald-600"
                                        : "bg-amber-50 text-amber-600"
                                    )}>
                                      {ativ.aprovado_admin ? <Award className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                      +{ativ.carga_horaria_recompensa}h CH — {ativ.aprovado_admin ? "Aprovado" : "Pendente Admin"}
                                    </span>
                                  )}
                                </div>
                                <button
                                  onClick={() => excluirAtividade(ativ.id)}
                                  className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Formulário de nova atividade neste módulo */}
                        {novaAtiv.modulo_id === modulo.id ? (
                          <div className="border-t border-dashed border-slate-200 p-5 space-y-3 bg-slate-50/50">
                            <p className="text-[12px] font-bold text-slate-600 mb-2">Adicionar atividade:</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <input
                                value={novaAtiv.titulo}
                                onChange={e => setNovaAtiv(p => ({ ...p, titulo: e.target.value }))}
                                placeholder="Título"
                                className="input-light text-[13px]"
                              />
                              <select
                                value={novaAtiv.tipo}
                                onChange={e => setNovaAtiv(p => ({ ...p, tipo: e.target.value as any }))}
                                className="input-light text-[13px] font-bold text-slate-600"
                              >
                                <option value="VIDEO_YOUTUBE">📹 Vídeo YouTube</option>
                                <option value="LEITURA">📖 Leitura / Link</option>
                                <option value="TAREFA">📝 Tarefa</option>
                              </select>
                            </div>
                            {(novaAtiv.tipo === 'VIDEO_YOUTUBE' || novaAtiv.tipo === 'LEITURA') && (
                              <input
                                value={novaAtiv.url_video}
                                onChange={e => setNovaAtiv(p => ({ ...p, url_video: e.target.value }))}
                                placeholder={novaAtiv.tipo === 'VIDEO_YOUTUBE' ? "https://youtube.com/watch?v=..." : "URL do material"}
                                className="input-light text-[13px] w-full"
                              />
                            )}
                            <textarea
                              value={novaAtiv.descricao}
                              onChange={e => setNovaAtiv(p => ({ ...p, descricao: e.target.value }))}
                              placeholder="Descrição ou instruções (opcional)"
                              rows={2}
                              className="input-light text-[13px] w-full resize-none"
                            />

                            {/* Toggle CH */}
                            <label className={cn(
                              "flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors",
                              novaAtiv.contarCH ? "bg-indigo-50 border-indigo-200" : "bg-white border-slate-200"
                            )}>
                              <button
                                type="button"
                                onClick={() => setNovaAtiv(p => ({ ...p, contarCH: !p.contarCH }))}
                                className={cn("transition-colors", novaAtiv.contarCH ? "text-indigo-600" : "text-slate-300")}
                              >
                                {novaAtiv.contarCH ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                              </button>
                              <div>
                                <p className="text-[13px] font-bold text-slate-700">Conta como carga horária</p>
                                <p className="text-[11px] text-slate-500">
                                  {novaAtiv.tipo === 'VIDEO_YOUTUBE' && !isTipoEAD
                                    ? "⚠️ Disponível apenas em turmas Híbridas ou EAD."
                                    : "Precisa de aprovação do Administrador para ativar."}
                                </p>
                              </div>
                            </label>

                            {novaAtiv.contarCH && (isTipoEAD || novaAtiv.tipo !== 'VIDEO_YOUTUBE') && (
                              <div className="flex items-center gap-3">
                                <label className="text-[13px] font-bold text-slate-600 whitespace-nowrap">Horas de CH:</label>
                                <input
                                  type="number" min={0} step={0.5}
                                  value={novaAtiv.carga_horaria_recompensa}
                                  onChange={e => setNovaAtiv(p => ({ ...p, carga_horaria_recompensa: Number(e.target.value) }))}
                                  className="input-light w-24 text-[13px]"
                                />
                              </div>
                            )}

                            <div className="flex gap-3">
                              <button
                                onClick={criarAtividade}
                                disabled={savingModulo}
                                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[13px] font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
                              >
                                {savingModulo ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Salvar Atividade
                              </button>
                              <button
                                onClick={() => setNovaAtiv(p => ({ ...p, modulo_id: null }))}
                                className="px-4 py-2 text-slate-500 hover:bg-slate-200 rounded-xl text-[13px] font-bold transition-colors"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setNovaAtiv(p => ({ ...p, modulo_id: modulo.id }))}
                            className="w-full flex items-center justify-center gap-2 py-3 text-[12px] font-bold text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors border-t border-dashed border-slate-200"
                          >
                            <Plus className="w-4 h-4" /> Adicionar atividade neste módulo
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}