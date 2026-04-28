"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  BookOpen, Play, CheckCircle2, Clock, BarChart2, AlertTriangle,
  Award, ChevronLeft, Loader2, Send, MessageSquare, Bell, FileWarning,
  Lock, Unlock, ChevronDown, ChevronUp, Video, ClipboardList, X
} from "lucide-react";
import Link from "next/link";
import { fetchApi } from "@/lib/api";
import { useProfile } from "@/contexts/ProfileContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/* ─── Types ─────────────────────────────────────────────────── */
interface Atividade {
  id: number;
  titulo: string;
  descricao: string | null;
  tipo: "VIDEO_YOUTUBE" | "LEITURA" | "TAREFA";
  url_video: string | null;
  carga_horaria_recompensa: number;
  ordem: number;
  concluida: boolean;
  aprovado_admin?: boolean;
}

interface Modulo {
  id: number;
  titulo: string;
  ordem: number;
  atividades: Atividade[];
}

interface SalaDeAulaData {
  turma: {
    codigo: string;
    titulo: string;
    carga_total: number;
  };
  progresso: {
    carga_adquirida: number;
    meta: number;
  };
  modulos: Modulo[];
}

interface EventoTurma {
  id: number;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  espaco: string;
}

interface InscricaoDetalhe {
  id: number;
  status: string;
  nota: number | null;
  turma: {
    id: number;
    codigo: string;
    modalidade: string;
    data_inicio: string;
    data_fim: string;
    carga_horaria: number;
    eventos: EventoTurma[];
  };
  presencas?: Record<string, string>;
}

interface ChatMsg {
  id: number;
  tipo: "aluno" | "instrutor";
  texto: string;
  timestamp: string;
}

const TABS = ["grade", "conteudo", "frequencia", "certificado"] as const;
type Tab = typeof TABS[number];

const TAB_LABELS: Record<Tab, { label: string; icon: React.ReactNode }> = {
  grade:       { label: "Grade de Aulas",   icon: <ClipboardList className="w-4 h-4" /> },
  conteudo:    { label: "Conteúdo EAD",     icon: <Play className="w-4 h-4" /> },
  frequencia:  { label: "Minha Frequência", icon: <BarChart2 className="w-4 h-4" /> },
  certificado: { label: "Certificado",      icon: <Award className="w-4 h-4" /> },
};

const ESPACO_LABELS: Record<string, string> = {
  LAB_INFO: "Laboratório de Informática",
  SALA_1: "Sala de Aula 1 - 4º andar",
  SALA_2: "Sala de Aula 2 - 5º andar",
  AUDITORIO: "Auditório - 5º andar",
  EXTERNO: "Espaço Externo",
};

/* ─── Helpers ────────────────────────────────────────────────── */
function youtubeId(url: string) {
  const match = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return match ? match[1] : null;
}

function formatDate(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

/* ─── Component ──────────────────────────────────────────────── */
export default function SalaDeAulaPage() {
  const params = useParams();
  const router = useRouter();
  const turmaId = params.id as string;
  const { profile } = useProfile();

  const [activeTab, setActiveTab] = useState<Tab>("grade");
  const [sala, setSala] = useState<SalaDeAulaData | null>(null);
  const [inscricao, setInscricao] = useState<InscricaoDetalhe | null>(null);
  const [loading, setLoading] = useState(true);
  const [ping, setPing] = useState<number | null>(null); // atividade_id sendo assistida
  const [pingLoading, setPingLoading] = useState<number | null>(null);
  const [moduloAberto, setModuloAberto] = useState<number | null>(0);

  // Chat UI-only (mock local)
  const [mensagens, setMensagens] = useState<ChatMsg[]>([
    { id: 1, tipo: "instrutor", texto: "Olá! Deixe suas dúvidas aqui. 📚", timestamp: new Date().toISOString() }
  ]);
  const [novaMensagem, setNovaMensagem] = useState("");
  const chatRef = useRef<HTMLDivElement>(null);

  // Certificado – reporte de erro
  const [showReporte, setShowReporte] = useState(false);
  const [reporteTexto, setReporteTexto] = useState("");
  const [sendingReporte, setSendingReporte] = useState(false);

  // Integração com YouTube API (Detecção de Play/Fim)
  useEffect(() => {
    if (pingLoading === null && sala?.modulos) { 
       // usa pingLoading apenas como flag pra não dar warning, mas a lógica real:
       const ativ = sala.modulos.flatMap(m => m.atividades).find(a => a.id === ping);
       if (ativ?.tipo === "VIDEO_YOUTUBE" && ativ.url_video) {
         const videoId = ativ.url_video.split('v=')[1]?.split('&')[0] || ativ.url_video.split('/').pop();
         
         if (!window.YT) {
           const tag = document.createElement('script');
           tag.src = "https://www.youtube.com/iframe_api";
           const firstScriptTag = document.getElementsByTagName('script')[0];
           firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
         }

         window.onYouTubeIframeAPIReady = () => {
           // Procura se tem a div com id "yt-player" no DOM e embute o vídeo
           new window.YT.Player('yt-player', {
             videoId: videoId,
             events: { 
               'onStateChange': (event: any) => { if (event.data === 0) handleConcluir(ativ.id); } 
             }
           });
         };
         
         if (window.YT && window.YT.Player) {
           new window.YT.Player('yt-player', { videoId, events: { 'onStateChange': (event: any) => { if (event.data === 0) handleConcluir(ativ.id); } } });
         }
       }
    }
  }, [ping, sala]);

  useEffect(() => {
    if (!turmaId) return;
    async function load() {
      setLoading(true);
      try {
        const [salaData, inscData] = await Promise.all([
          fetchApi<SalaDeAulaData>(`/cursos/turmas/${turmaId}/sala-de-aula/`),
          fetchApi<any>(`/cursos/minhas-inscricoes/detalhes/`),
        ]);
        setSala(salaData);
        // Encontra a inscrição desta turma
        const lista = Array.isArray(inscData) ? inscData : inscData?.results || [];
        const mine = lista.find((i: any) => String(i.turma?.id) === String(turmaId));
        setInscricao(mine || null);
      } catch (err: any) {
        toast.error("Não foi possível carregar a sala de aula.");
        router.push("/dashboard");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [turmaId, router]);

  // Auto-scroll do chat
  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [mensagens]);

  const handlePing = async (atividadeId: number) => {
    setPingLoading(atividadeId);
    try {
      await fetchApi(`/cursos/atividades/${atividadeId}/ping/`, { method: "POST" });
    } catch (err: any) {
      if (err.status !== 429) toast.error("Erro ao registrar progresso.");
    } finally {
      setPingLoading(null);
    }
  };

  const handleConcluir = async (atividadeId: number) => {
    try {
      await fetchApi(`/cursos/atividades/${atividadeId}/concluir/`, { method: "POST" });
      toast.success("Atividade marcada como concluída!");
      // Atualiza localmente
      setSala(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          modulos: prev.modulos.map(m => ({
            ...m,
            atividades: m.atividades.map(a =>
              a.id === atividadeId ? { ...a, concluida: true } : a
            )
          }))
        };
      });
    } catch (err: any) {
      toast.error(err.message || "Você ainda não assistiu o tempo mínimo.");
    }
  };

  const enviarMensagem = () => {
    const txt = novaMensagem.trim();
    if (!txt) return;
    setMensagens(prev => [...prev, {
      id: Date.now(),
      tipo: "aluno",
      texto: txt,
      timestamp: new Date().toISOString(),
    }]);
    setNovaMensagem("");
    // Simula resposta automática do instrutor após 2s
    setTimeout(() => {
      setMensagens(prev => [...prev, {
        id: Date.now() + 1,
        tipo: "instrutor",
        texto: "Obrigado pela mensagem! O instrutor foi notificado e responderá em breve. 🙌",
        timestamp: new Date().toISOString(),
      }]);
    }, 2000);
  };

  const enviarReporte = async () => {
    if (!reporteTexto.trim()) return;
    setSendingReporte(true);
    // Por ora, simula envio (endpoint de suporte a ser criado futuramente)
    await new Promise(r => setTimeout(r, 1000));
    setSendingReporte(false);
    setShowReporte(false);
    setReporteTexto("");
    toast.success("Relatório de erro enviado! Nossa equipe irá verificar.");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!sala) return null;

  const cargaPct = sala.progresso.meta > 0
    ? Math.min(100, Math.round((sala.progresso.carga_adquirida / sala.progresso.meta) * 100))
    : 0;

  const eventos = inscricao?.turma?.eventos ?? [];

  // Calcula frequência a partir das presenças
  const presencas = inscricao?.presencas ?? {};
  const totalEventos = eventos.length;
  const presentes = Object.values(presencas).filter(s => s === 'PRESENTE' || s === 'JUSTIFICADA').length;
  const freqPct = totalEventos > 0 ? Math.round((presentes / totalEventos) * 100) : null;

  const isConcluido = inscricao?.status === "concluido";

  return (
    <div className="space-y-6 max-w-5xl mx-auto text-slate-800 animate-[fade-in_0.4s_ease-out] pb-12">

      {/* ── HEADER ── */}
      <div className="clean-card p-5 flex flex-col md:flex-row md:items-center gap-4 bg-white">
        <button onClick={() => router.back()} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600 transition-colors w-fit">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">{sala.turma.codigo}</p>
          <h1 className="text-xl font-extrabold text-slate-800 leading-tight">{sala.turma.titulo}</h1>
        </div>
        {/* Barra de progresso EAD */}
        {sala.progresso.meta > 0 && (
          <div className="flex flex-col gap-1 min-w-[160px]">
            <div className="flex justify-between text-[11px] font-bold text-slate-500">
              <span>Progresso EAD</span>
              <span>{sala.progresso.carga_adquirida}h / {sala.progresso.meta}h</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all"
                style={{ width: `${cargaPct}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400 text-right">{cargaPct}% concluído</p>
          </div>
        )}
      </div>

      {/* ── TABS ── */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold whitespace-nowrap transition-all flex-1 justify-center",
              activeTab === tab
                ? "bg-white text-blue-700 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            {TAB_LABELS[tab].icon}
            {TAB_LABELS[tab].label}
          </button>
        ))}
      </div>

      {/* ── GRADE DE AULAS ── */}
      {activeTab === "grade" && (
        <div className="space-y-4">
          {eventos.length === 0 ? (
            <div className="clean-card p-12 text-center bg-white text-slate-500">
              <ClipboardList className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p className="font-bold">Nenhum encontro presencial cadastrado para esta turma.</p>
              <p className="text-sm mt-1">Pode ser uma turma 100% EAD.</p>
            </div>
          ) : (
            <div className="clean-card overflow-hidden bg-white">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                <h2 className="font-bold text-slate-700 text-sm">
                  {eventos.length} encontro{eventos.length !== 1 && 's'} programado{eventos.length !== 1 && 's'}
                </h2>
              </div>
              <div className="divide-y divide-slate-50">
                {eventos.map((ev, i) => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const evDate = new Date(ev.data + "T00:00:00");
                  const isPast = evDate < today;
                  const isToday = evDate.getTime() === today.getTime();
                  return (
                    <div key={ev.id} className={cn("flex items-center gap-4 px-6 py-4 transition-colors", isToday && "bg-blue-50/60")}>
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex flex-col items-center justify-center text-center text-[10px] font-black border shrink-0",
                        isPast ? "bg-slate-100 text-slate-400 border-slate-200" :
                        isToday ? "bg-blue-600 text-white border-blue-600" :
                        "bg-white text-slate-700 border-slate-200"
                      )}>
                        <span className="text-[14px] leading-none">{ev.data.split('-')[2]}</span>
                        <span className="opacity-70">{ev.data.split('-')[1]}/{ev.data.split('-')[0].slice(2)}</span>
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-slate-800 text-[13px]">
                          Aula {i + 1}
                          {isToday && <span className="ml-2 text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-black">HOJE</span>}
                        </p>
                        <p className="text-[12px] text-slate-500">{ev.hora_inicio?.slice(0,5)} – {ev.hora_fim?.slice(0,5)} · {ESPACO_LABELS[ev.espaco] || ev.espaco}</p>
                      </div>
                      {isPast && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Notificação de alteração de datas */}
          {inscricao?.turma?.data_inicio && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
              <Bell className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[13px] text-amber-800 font-medium">
                A grade de aulas pode ser atualizada pelo instrutor a qualquer momento.
                Fique atento às notificações para não perder alterações de data ou local.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── CONTEÚDO EAD ── */}
      {activeTab === "conteudo" && (
        <div className="space-y-4">
          {sala.modulos.length === 0 ? (
            <div className="clean-card p-12 text-center bg-white text-slate-500">
              <Video className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p className="font-bold">Nenhum conteúdo disponível ainda.</p>
              <p className="text-sm mt-1">O instrutor ainda não adicionou módulos ou vídeos.</p>
            </div>
          ) : (
            sala.modulos.map((modulo, mi) => {
              const isOpen = moduloAberto === mi;
              const totalAtiv = modulo.atividades.length;
              const concluidas = modulo.atividades.filter(a => a.concluida).length;
              return (
                <div key={modulo.id} className="clean-card bg-white overflow-hidden">
                  {/* Cabeçalho do módulo */}
                  <button
                    onClick={() => setModuloAberto(isOpen ? null : mi)}
                    className="w-full flex items-center gap-4 px-6 py-4 text-left hover:bg-slate-50/80 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-sm shrink-0">
                      {mi + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-slate-800">{modulo.titulo}</p>
                      <p className="text-[11px] text-slate-500">{concluidas}/{totalAtiv} atividades concluídas</p>
                    </div>
                    {/* Mini barra de progresso */}
                    <div className="hidden sm:flex items-center gap-2 w-32">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full transition-all"
                          style={{ width: totalAtiv > 0 ? `${(concluidas / totalAtiv) * 100}%` : '0%' }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 shrink-0">
                        {totalAtiv > 0 ? Math.round((concluidas / totalAtiv) * 100) : 0}%
                      </span>
                    </div>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
                  </button>

                  {/* Lista de atividades */}
                  {isOpen && (
                    <div className="border-t border-slate-100 divide-y divide-slate-50">
                      {modulo.atividades.length === 0 ? (
                        <p className="px-6 py-4 text-sm text-slate-400">Nenhuma atividade neste módulo.</p>
                      ) : modulo.atividades.map(ativ => {
                        const isVideo = ativ.tipo === "VIDEO_YOUTUBE";
                        const vidId = ativ.url_video ? youtubeId(ativ.url_video) : null;
                        return (
                          <div key={ativ.id} className={cn("px-6 py-4 transition-colors", ativ.concluida && "bg-emerald-50/40")}>
                            <div className="flex items-start gap-3">
                              <div className={cn(
                                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                                ativ.concluida ? "bg-emerald-100 text-emerald-600" :
                                isVideo ? "bg-red-50 text-red-500" :
                                "bg-slate-100 text-slate-500"
                              )}>
                                {ativ.concluida ? <CheckCircle2 className="w-4 h-4" /> :
                                  isVideo ? <Play className="w-4 h-4" /> :
                                  <BookOpen className="w-4 h-4" />}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="font-bold text-slate-800 text-[14px]">{ativ.titulo}</p>
                                  {ativ.carga_horaria_recompensa > 0 && (
                                    <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full shrink-0">
                                      <Clock className="w-3 h-3" /> +{ativ.carga_horaria_recompensa}h CH
                                    </span>
                                  )}
                                </div>
                                {ativ.descricao && (
                                  <p className="text-[12px] text-slate-500 mt-0.5 leading-relaxed">{ativ.descricao}</p>
                                )}

                                {/* Player de vídeo embutido */}
                                {isVideo && vidId && (
                                  <div className="mt-3 rounded-xl overflow-hidden border border-slate-200 aspect-video relative bg-slate-900">
                                    <iframe
                                      src={`https://www.youtube.com/embed/${vidId}`}
                                      className="w-full h-full"
                                      allowFullScreen
                                      onPlay={() => {
                                        // Inicia o ping a cada 60s quando começa a assistir
                                        if (ping !== ativ.id) {
                                          setPing(ativ.id);
                                          handlePing(ativ.id);
                                        }
                                      }}
                                    />
                                  </div>
                                )}

                                {/* Link externo para leitura */}
                                {ativ.tipo === "LEITURA" && ativ.url_video && (
                                  <a
                                    href={ativ.url_video}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-bold text-blue-600 hover:underline"
                                  >
                                    Acessar material →
                                  </a>
                                )}

                                {/* Botão concluir */}
                                {!ativ.concluida && (
                                  <div className="flex items-center gap-2 mt-3">
                                    {isVideo && (
                                      <button
                                        onClick={() => handlePing(ativ.id)}
                                        disabled={pingLoading === ativ.id}
                                        className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-[12px] font-bold hover:bg-slate-200 transition-colors flex items-center gap-1.5 disabled:opacity-60"
                                      >
                                        {pingLoading === ativ.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Clock className="w-3 h-3" />}
                                        Registrar 1 min
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleConcluir(ativ.id)}
                                      className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[12px] font-bold hover:bg-emerald-700 transition-colors flex items-center gap-1.5"
                                    >
                                      <CheckCircle2 className="w-3 h-3" /> Marcar como concluída
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── FREQUÊNCIA ── */}
      {activeTab === "frequencia" && (
        <div className="space-y-4">
          {/* Card de resumo */}
          <div className={cn(
            "clean-card p-6 bg-white flex flex-col sm:flex-row sm:items-center gap-6",
          )}>
            {/* Gráfico circular simples em SVG */}
            <div className="relative w-28 h-28 shrink-0 mx-auto sm:mx-0">
              <svg viewBox="0 0 36 36" className="w-28 h-28 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3.5" />
                <circle
                  cx="18" cy="18" r="15.9" fill="none"
                  stroke={freqPct !== null && freqPct >= 80 ? "#10b981" : freqPct !== null && freqPct >= 60 ? "#f59e0b" : "#ef4444"}
                  strokeWidth="3.5"
                  strokeDasharray={`${freqPct ?? 0} 100`}
                  strokeLinecap="round"
                  className="transition-all duration-700"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-black text-slate-800">{freqPct ?? '--'}{freqPct !== null && '%'}</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Frequência</span>
              </div>
            </div>

            <div className="flex-1">
              <h2 className="text-lg font-extrabold text-slate-800 mb-2">Minha Frequência</h2>
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-center">
                  <p className="text-xl font-black text-emerald-600">{presentes}</p>
                  <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">Presenças</p>
                </div>
                <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-center">
                  <p className="text-xl font-black text-red-500">{Object.values(presencas).filter(s => s === 'FALTA').length}</p>
                  <p className="text-[10px] font-bold text-red-600 uppercase tracking-wide">Faltas</p>
                </div>
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-center">
                  <p className="text-xl font-black text-amber-600">{totalEventos}</p>
                  <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">Total Aulas</p>
                </div>
              </div>
              <div className="mt-3 flex gap-2 items-center">
                {freqPct !== null && freqPct < 80 && (
                  <div className="flex items-center gap-2 text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    Frequência abaixo de 80% — risco de reprovação.
                  </div>
                )}
                {freqPct !== null && freqPct >= 80 && (
                  <div className="flex items-center gap-2 text-[12px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    Frequência dentro do mínimo exigido (80%).
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tabela de presenças por aula */}
          {totalEventos > 0 && (
            <div className="clean-card bg-white overflow-hidden">
              <div className="px-6 py-3 border-b border-slate-100 bg-slate-50">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Histórico por Aula</p>
              </div>
              <div className="divide-y divide-slate-50">
                {eventos.map((ev, i) => {
                  const st = presencas[String(ev.id)];
                  return (
                    <div key={ev.id} className="flex items-center gap-4 px-6 py-3">
                      <span className="text-[11px] font-bold text-slate-400 w-14 shrink-0">Aula {i + 1}</span>
                      <span className="text-[13px] text-slate-600">{formatDate(ev.data)}</span>
                      <div className="ml-auto">
                        {!st ? (
                          <span className="text-[10px] font-bold text-slate-300 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                            Não registrada
                          </span>
                        ) : st === 'PRESENTE' ? (
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">✓ Presente</span>
                        ) : st === 'JUSTIFICADA' ? (
                          <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">↗ Justificada</span>
                        ) : (
                          <span className="text-[10px] font-bold text-red-500 bg-red-50 border border-red-200 px-2 py-0.5 rounded">✕ Falta</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CERTIFICADO ── */}
      {activeTab === "certificado" && (
        <div className="space-y-4">
          {isConcluido ? (
            <div className="clean-card bg-white p-8 flex flex-col items-center text-center gap-4">
              <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
                <Award className="w-10 h-10 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-slate-800">Parabéns, {profile?.nome_social || profile?.nome_completo?.split(' ')[0]}! 🎉</h2>
                <p className="text-slate-500 mt-1 text-sm">Você concluiu esta turma com aprovação. Seu certificado está disponível.</p>
              </div>

              <div className="bg-gradient-to-br from-primary to-blue-700 rounded-2xl p-6 w-full max-w-sm text-white text-center shadow-lg">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-2">Escola de Governo de Caruaru</p>
                <p className="text-lg font-extrabold leading-snug">{sala.turma.titulo}</p>
                <p className="text-[11px] opacity-70 mt-2">{inscricao?.turma?.carga_horaria}h · Turma {sala.turma.codigo}</p>
                <p className="text-[13px] font-bold mt-3">{profile?.nome_completo}</p>
                <p className="text-[10px] opacity-50 mt-1 font-mono">Nota: {inscricao?.nota ?? '--'}</p>
              </div>

              <button className="btn-primary !px-8 shadow-lg shadow-blue-200">
                Baixar Certificado PDF
              </button>

              {/* Reporte de erro */}
              <button
                onClick={() => setShowReporte(v => !v)}
                className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-400 hover:text-red-500 transition-colors mt-2"
              >
                <FileWarning className="w-4 h-4" />
                Reportar erro no certificado
              </button>

              {showReporte && (
                <div className="w-full max-w-sm space-y-3 bg-red-50 border border-red-200 rounded-xl p-4 text-left">
                  <p className="text-[12px] font-bold text-red-700">Descreva o erro encontrado:</p>
                  <textarea
                    value={reporteTexto}
                    onChange={e => setReporteTexto(e.target.value)}
                    placeholder="Ex: meu nome está incorreto, a carga horária está errada..."
                    className="w-full h-24 text-[13px] border border-red-200 rounded-lg p-3 resize-none focus:ring-2 focus:ring-red-300 outline-none bg-white"
                  />
                  <button
                    onClick={enviarReporte}
                    disabled={sendingReporte || !reporteTexto.trim()}
                    className="w-full py-2 rounded-lg bg-red-600 text-white text-[13px] font-bold hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    {sendingReporte ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Enviar Relatório
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="clean-card bg-white p-10 flex flex-col items-center text-center gap-4">
              <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center">
                <Lock className="w-8 h-8 text-slate-400" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-slate-700">Certificado ainda não disponível</h2>
                <p className="text-sm text-slate-500 mt-1.5 max-w-sm">
                  O certificado será liberado após o instrutor fechar o diário e confirmar sua aprovação no curso.
                  {inscricao?.status === 'reprovado' && (
                    <span className="block mt-2 text-red-600 font-semibold">Você foi reprovado nesta turma.</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2 text-[13px] text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                <span>Status atual:</span>
                <span className={cn(
                  "font-bold px-2 py-0.5 rounded",
                  inscricao?.status === 'inscrito' ? 'bg-emerald-100 text-emerald-700' :
                  inscricao?.status === 'pendente' ? 'bg-amber-100 text-amber-700' :
                  'bg-slate-200 text-slate-600'
                )}>
                  {inscricao?.status ?? 'Desconhecido'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CHAT FLUTUANTE (lateral) ── */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
        <div className="w-80 flex flex-col clean-card bg-white overflow-hidden shadow-2xl border border-slate-200 max-h-[420px]">
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-primary text-white">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              <span className="text-[13px] font-bold">Chat com o Instrutor</span>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Online" />
          </div>

          <div ref={chatRef} className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-slate-50" style={{ maxHeight: 260 }}>
            {mensagens.map(msg => (
              <div key={msg.id} className={cn("flex", msg.tipo === "aluno" ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[75%] px-3 py-2 rounded-xl text-[12px] leading-relaxed",
                  msg.tipo === "aluno"
                    ? "bg-primary text-white rounded-br-none"
                    : "bg-white border border-slate-200 text-slate-700 rounded-bl-none"
                )}>
                  {msg.texto}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 p-3 border-t border-slate-100 bg-white">
            <input
              value={novaMensagem}
              onChange={e => setNovaMensagem(e.target.value)}
              onKeyDown={e => e.key === "Enter" && enviarMensagem()}
              placeholder="Digite sua dúvida..."
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[12px] outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-300"
            />
            <button
              onClick={enviarMensagem}
              className="p-2 bg-primary text-white rounded-xl hover:bg-primary-dark transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
