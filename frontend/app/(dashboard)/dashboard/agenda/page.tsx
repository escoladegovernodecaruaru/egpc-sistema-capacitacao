"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Calendar as CalendarIcon, Plus, MapPin, Clock, CheckCircle2,
  Loader2, ChevronLeft, ChevronRight, Trash2, CalendarDays,
  Building2, User, Info, X, AlertTriangle, FileText, Send
} from "lucide-react";
import { fetchApi } from "@/lib/api";
import { useProfile } from "@/contexts/ProfileContext";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

/* ─── TIPOS ───────────────────────────────────────────────── */
type Turno = "MANHA" | "TARDE" | "NOITE";

interface EventoAgenda {
  id: string;
  tipo: "AULA" | "RESERVA_AVULSA";
  titulo: string;
  data: string;
  turno: Turno;
  local: string;
  hora_inicio?: string;
  hora_fim?: string;
  status: string;
  origin_tipo?: "TURMA" | "SOLICITACAO";
  origin_id?: string | number;
  origin_desc?: string;
  origin_solicitante?: string;
}

interface ItemSolicitacao {
  id: string;
  espaco: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  conflito: boolean;
  turno_calculado?: Turno;
}

/* ─── CONSTANTES ──────────────────────────────────────────── */
const ESPACOS = [
  { key: "AUDITORIO", label: "Auditório", andar: "5º andar", vagas: 60 },
  { key: "SALA_2",    label: "Sala de Aula 2", andar: "5º andar", vagas: 33 },
  { key: "SALA_1",    label: "Sala de Aula 1", andar: "4º andar", vagas: 21 },
  { key: "LAB_INFO",  label: "Laboratório de Informática", andar: "4º andar", vagas: 30 },
];

const ESPACOS_CORES: Record<string, string> = {
  SALA_1:    "bg-blue-500",
  SALA_2:    "bg-purple-500",
  LAB_INFO:  "bg-emerald-500",
  AUDITORIO: "bg-orange-500",
  EXTERNO:   "bg-slate-400",
};
const ESPACOS_LABEL: Record<string, string> = {
  SALA_1:    "Sala 1",
  SALA_2:    "Sala 2",
  LAB_INFO:  "Lab. Info",
  AUDITORIO: "Auditório",
  EXTERNO:   "Externo",
};

const TURNOS_HORARIOS: Record<Turno, { inicio: string; fim: string; label: string; color: string }> = {
  MANHA: { inicio: "08:00", fim: "12:00", label: "Manhã",  color: "text-amber-600 bg-amber-50 border-amber-200" },
  TARDE: { inicio: "13:00", fim: "17:00", label: "Tarde",  color: "text-blue-600 bg-blue-50 border-blue-200" },
  NOITE: { inicio: "18:00", fim: "22:00", label: "Noite",  color: "text-indigo-600 bg-indigo-50 border-indigo-200" },
};

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const DIAS_SEMANA = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

/* ─── HELPERS ─────────────────────────────────────────────── */
function calcularTurno(horaInicio: string): Turno {
  const [h] = horaInicio.split(":").map(Number);
  if (h < 13) return "MANHA";
  if (h < 18) return "TARDE";
  return "NOITE";
}

function horaParaMinutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

function formatDateBR(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

/* ─── PAGE ────────────────────────────────────────────────── */
export default function AgendaPage() {
  const { profile } = useProfile();

  type View = "quadro" | "nova" | "minhas" | "gestao";
  const [currentView, setCurrentView] = useState<View>("quadro");
  const [eventos, setEventos] = useState<EventoAgenda[]>([]);
  const [minhasSolicitacoes, setMinhasSolicitacoes] = useState<any[]>([]);
  const [adminSolicitacoes, setAdminSolicitacoes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calendário
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);

  // Filtros do quadro
  const [filtrosSala, setFiltrosSala] = useState<string[]>([]);
  const [filtrosTurno, setFiltrosTurno] = useState<Turno[]>([]);

  // Admin: negar solicitação
  const [showNegar, setShowNegar] = useState<string | null>(null);
  const [justificativaReserva, setJustificativaReserva] = useState("");

  // Nova solicitação (AGORA COM PRESETS)
  const [novoPedido, setNovoPedido] = useState({ titulo: "", descricao: "" });
  const [prefEspaco, setPrefEspaco] = useState("AUDITORIO");
  const [presetInicio, setPresetInicio] = useState("08:00");
  const [presetFim, setPresetFim] = useState("12:00");
  const [itensSolicitacao, setItensSolicitacao] = useState<ItemSolicitacao[]>([]);

  /* ─── Fetch ─────────────────────────────────────────────── */
  const carregarDados = async () => {
    setIsLoading(true);
    try {
      const agendaData = await fetchApi<EventoAgenda[]>("/cursos/agenda/").catch(() => []);
      setEventos(Array.isArray(agendaData) ? agendaData : []);

      const minhasData = await fetchApi<any[]>("/cursos/minhas-solicitacoes/").catch(() => []);
      setMinhasSolicitacoes(Array.isArray(minhasData) ? minhasData : []);

      if (profile?.is_staff) {
        const adminData = await fetchApi<any[]>("/cursos/admin-solicitacoes/").catch(() => []);
        setAdminSolicitacoes(Array.isArray(adminData) ? adminData : []);
      }
    } catch {
      toast.error("Erro ao sincronizar a agenda.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  /* ─── Calendário helpers ─────────────────────────────────── */
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDay = new Date(calYear, calMonth, 1).getDay();

  const prevMonth = () => { setDiaSelecionado(null); calMonth === 0 ? (setCalMonth(11), setCalYear(y => y - 1)) : setCalMonth(m => m - 1); };
  const nextMonth = () => { setDiaSelecionado(null); calMonth === 11 ? (setCalMonth(0), setCalYear(y => y + 1)) : setCalMonth(m => m + 1); };

  const makeDate = (day: number) => `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const toggleFiltro = (set: React.Dispatch<React.SetStateAction<any[]>>, val: any) =>
    set((prev: any[]) => prev.includes(val) ? prev.filter((v: any) => v !== val) : [...prev, val]);

  /* ─── Eventos processados ─────────────────────────────────── */
  const eventosFiltrados = useMemo(() => {
    return eventos.filter(e => {
      if (filtrosSala.length > 0 && !filtrosSala.includes(e.local)) return false;
      if (filtrosTurno.length > 0 && !filtrosTurno.includes(e.turno)) return false;
      return true;
    });
  }, [eventos, filtrosSala, filtrosTurno]);

  const eventosDoMes = useMemo(() => {
    return eventosFiltrados.filter(e => {
      const d = new Date(e.data + "T00:00:00");
      return d.getMonth() === calMonth && d.getFullYear() === calYear;
    });
  }, [eventosFiltrados, calMonth, calYear]);

  const eventosNoDia = useMemo(() => {
    if (!diaSelecionado) return [];
    return eventosFiltrados.filter(e => e.data === diaSelecionado);
  }, [eventosFiltrados, diaSelecionado]);

  /* ─── Verificação de conflito por item ────────────────────── */
  const verificarConflito = (item: Omit<ItemSolicitacao, "id" | "conflito">): boolean => {
    const turno = calcularTurno(item.hora_inicio);
    return eventosDoMes.some(e =>
      e.data === item.data &&
      e.local === item.espaco &&
      e.turno === turno &&
      e.status === "APROVADA"
    );
  };

  /* ─── Clicar no Calendário (NOVO FLUXO RÁPIDO) ────────────── */
  const handleDayClick = (day: number) => {
    const dateStr = makeDate(day);
    const existingIndex = itensSolicitacao.findIndex(i => i.data === dateStr && i.espaco === prefEspaco);

    if (existingIndex >= 0) {
      // Se já clicou e estava na lista, ele remove. (Permite desmarcar fácil)
      removerItem(itensSolicitacao[existingIndex].id);
    } else {
      // Valida hora
      if (horaParaMinutos(presetFim) <= horaParaMinutos(presetInicio)) {
         toast.error("O horário padrão de fim deve ser após o de início.");
         return;
      }

      const itemBase = {
        espaco: prefEspaco,
        data: dateStr,
        hora_inicio: presetInicio,
        hora_fim: presetFim,
        turno_calculado: calcularTurno(presetInicio)
      };

      const conflito = verificarConflito(itemBase);
      const novoItem: ItemSolicitacao = {
        ...itemBase,
        id: Math.random().toString(36).slice(2, 9),
        conflito,
      };

      setItensSolicitacao(prev =>
        [...prev, novoItem].sort((a, b) => a.data.localeCompare(b.data) || a.hora_inicio.localeCompare(b.hora_inicio))
      );

      if (conflito) {
        toast.error("Conflito de agenda!", {
          description: `${ESPACOS_LABEL[itemBase.espaco]} já tem eventos aprovados no dia ${formatDateBR(dateStr)}.`
        });
      }
    }
  };

  const atualizarItemLista = (id: string, campo: keyof ItemSolicitacao, valor: string) => {
     setItensSolicitacao(prev => prev.map(item => {
        if (item.id === id) {
           const updated = { ...item, [campo]: valor };
           if (campo === 'hora_inicio' || campo === 'hora_fim' || campo === 'espaco') {
              updated.turno_calculado = calcularTurno(updated.hora_inicio);
              updated.conflito = verificarConflito(updated);
           }
           return updated;
        }
        return item;
     }));
  };

  const removerItem = (id: string) => setItensSolicitacao(prev => prev.filter(i => i.id !== id));

  const temConflito = itensSolicitacao.some(i => i.conflito);

  /* ─── Enviar solicitação ─────────────────────────────────── */
  const enviarSolicitacao = async () => {
    if (!novoPedido.titulo.trim()) return toast.error("Dê um título ao seu evento.");
    if (itensSolicitacao.length === 0) return toast.error("Adicione pelo menos uma reserva.");
    if (temConflito) return toast.error("Resolva os conflitos em vermelho antes de enviar.");

    setIsSubmitting(true);
    try {
      await fetchApi("/cursos/minhas-solicitacoes/", {
        method: "POST",
        body: JSON.stringify({
          titulo: novoPedido.titulo,
          descricao: novoPedido.descricao,
          itens: itensSolicitacao.map(i => ({
            espaco: i.espaco,
            data: i.data,
            hora_inicio: i.hora_inicio,
            hora_fim: i.hora_fim,
          }))
        })
      });
      toast.success("Solicitação enviada!", {
        description: profile?.is_staff ? "Aprovada automaticamente." : "Aguardando aprovação da gestão."
      });
      setNovoPedido({ titulo: "", descricao: "" });
      setItensSolicitacao([]);
      setCurrentView("minhas");
      carregarDados();
    } catch (err: any) {
      toast.error("Conflito de Agenda", { description: err.message || "Erro ao processar o pedido.", duration: 6000 });
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ─── Cancelar pedido ─────────────────────────────────── */
  const handleCancelar = async (id: string) => {
    if (!confirm("Tem certeza que deseja cancelar esta solicitação? Os espaços serão liberados imediatamente.")) return;
    try {
      await fetchApi(`/cursos/solicitacoes/${id}/cancelar/`, { method: "POST" });
      toast.success("Reserva cancelada com sucesso!");
      carregarDados();
    } catch (err: any) {
      toast.error(err.message || "Erro ao cancelar a reserva.");
    }
  };

  /* ─── Avaliar solicitação (admin) ─────────────────────── */
  const handleAvaliar = async (id: string, acao: "aprovar" | "negar") => {
    if (acao === "negar" && !justificativaReserva.trim()) return toast.error("A justificativa é obrigatória.");
    try {
      await fetchApi(`/cursos/solicitacoes/${id}/avaliar/`, {
        method: "POST",
        body: JSON.stringify({ acao, justificativa: justificativaReserva })
      });
      toast.success(`Solicitação ${acao === "aprovar" ? "aprovada" : "recusada"} com sucesso!`);
      setShowNegar(null);
      setJustificativaReserva("");
      carregarDados();
    } catch (err: any) {
      toast.error(err.message || "Erro ao avaliar solicitação.");
    }
  };

  /* ─── STATUS HELPERS ──────────────────────────────────── */
  const statusBadge = (status: string) => {
    switch (status) {
      case "APROVADA":  return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "RECUSADA":  return "bg-red-100 text-red-700 border-red-200";
      case "CANCELADA": return "bg-slate-100 text-slate-500 border-slate-200";
      default:          return "bg-amber-100 text-amber-700 border-amber-200";
    }
  };
  const statusLabel = (s: string) => s === "PENDENTE" ? "Em Análise" : s;

  const isAdmin = profile?.is_staff;
  const canSolicitar = isAdmin || profile?.is_solicitante;

  /* ─── RENDER ──────────────────────────────────────────── */
  return (
    <div className="space-y-5 animate-[fade-in_0.4s_ease-out] text-slate-800 pb-12">

      {/* HEADER + TABS */}
      <div className="clean-card p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shadow-sm shrink-0">
            <CalendarIcon className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-slate-800 tracking-tight">Gestão de Espaços</h1>
            <p className="text-[12px] text-slate-500 mt-0.5">Visualize a ocupação e solicite reservas para eventos.</p>
          </div>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 overflow-x-auto gap-1">
          <button
            onClick={() => setCurrentView("quadro")}
            className={cn("px-4 py-2 rounded-xl text-[13px] font-bold whitespace-nowrap transition-all flex items-center gap-1.5",
              currentView === "quadro" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700")}
          >
            <CalendarDays className="w-4 h-4" /> Calendário
          </button>

          {canSolicitar && (
            <button
              onClick={() => setCurrentView("nova")}
              className={cn("px-4 py-2 rounded-xl text-[13px] font-bold whitespace-nowrap transition-all flex items-center gap-1.5",
                currentView === "nova" ? "bg-primary text-white shadow-md" : "text-slate-500 hover:text-slate-700")}
            >
              <Plus className="w-4 h-4" /> Nova Solicitação
            </button>
          )}

          <button
            onClick={() => setCurrentView("minhas")}
            className={cn("px-4 py-2 rounded-xl text-[13px] font-bold whitespace-nowrap transition-all flex items-center gap-1.5",
              currentView === "minhas" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700")}
          >
            <FileText className="w-4 h-4" /> Meus Pedidos
          </button>

          {isAdmin && (
            <button
              onClick={() => setCurrentView("gestao")}
              className={cn("px-4 py-2 rounded-xl text-[13px] font-bold whitespace-nowrap transition-all flex items-center gap-1.5",
                currentView === "gestao" ? "bg-indigo-600 text-white shadow-md" : "text-indigo-500 hover:text-indigo-700")}
            >
              <Building2 className="w-4 h-4" />
              Validar
              {adminSolicitacoes.filter(s => s.status === "PENDENTE").length > 0 && (
                <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center">
                  {adminSolicitacoes.filter(s => s.status === "PENDENTE").length}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">

        {/* ═══════════════════════════════════════════════════════
            VISTA 1 — CALENDÁRIO
        ═══════════════════════════════════════════════════════ */}
        {currentView === "quadro" && (
          <motion.div key="quadro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="grid grid-cols-1 xl:grid-cols-4 gap-5">

            {/* Grade principal */}
            <div className="xl:col-span-3 clean-card p-5 md:p-7 bg-white">

              {/* Filtros */}
              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                {/* Filtro de salas */}
                <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-1">
                    <MapPin className="inline w-3 h-3 mb-0.5 mr-0.5" />Salas
                  </span>
                  {ESPACOS.map(e => {
                    const ativo = filtrosSala.length === 0 || filtrosSala.includes(e.key);
                    return (
                      <button
                        key={e.key}
                        onClick={() => toggleFiltro(setFiltrosSala, e.key)}
                        className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all",
                          ativo ? "bg-white border-slate-300 text-slate-700 shadow-sm" : "bg-transparent border-transparent opacity-40 hover:opacity-70")}
                      >
                        <span className={cn("w-2 h-2 rounded-full shrink-0", ESPACOS_CORES[e.key])} />
                        {e.label}
                      </button>
                    );
                  })}
                  {isAdmin && (
                    <button
                      onClick={() => toggleFiltro(setFiltrosSala, "EXTERNO")}
                      className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all",
                        filtrosSala.length === 0 || filtrosSala.includes("EXTERNO") ? "bg-white border-slate-300 text-slate-700 shadow-sm" : "bg-transparent border-transparent opacity-40 hover:opacity-70")}
                    >
                      <span className="w-2 h-2 rounded-full shrink-0 bg-slate-400" />Externo
                    </button>
                  )}
                </div>

                {/* Filtro de turnos */}
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-1">
                    <Clock className="inline w-3 h-3 mb-0.5 mr-0.5" />Turno
                  </span>
                  {(["MANHA", "TARDE", "NOITE"] as Turno[]).map(t => {
                    const ativo = filtrosTurno.length === 0 || filtrosTurno.includes(t);
                    return (
                      <button
                        key={t}
                        onClick={() => toggleFiltro(setFiltrosTurno, t)}
                        className={cn("px-3 py-1 rounded-lg border text-[11px] font-bold uppercase transition-all",
                          ativo ? "bg-white border-slate-300 text-slate-700 shadow-sm" : "bg-transparent border-transparent opacity-40 hover:opacity-70")}
                      >
                        {t === "MANHA" ? "Manhã" : t === "TARDE" ? "Tarde" : "Noite"}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Navegação de mês */}
              <div className="flex items-center justify-between mb-5">
                <button onClick={prevMonth} className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-500 transition-colors">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="font-extrabold text-slate-800 text-lg tracking-wide capitalize">{MESES[calMonth]} {calYear}</span>
                <button onClick={nextMonth} className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-500 transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {isLoading ? (
                <div className="h-72 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
              ) : (
                <div className="grid grid-cols-7 gap-1.5">
                  {/* Cabeçalho */}
                  {DIAS_SEMANA.map(d => (
                    <div key={d} className="text-center text-[10px] font-black text-slate-400 uppercase pb-2">{d}</div>
                  ))}

                  {/* Dias vazios */}
                  {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}

                  {/* Dias do mês */}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const dateStr = makeDate(day);
                    const isToday = dateStr === todayStr();
                    const isSelected = diaSelecionado === dateStr;
                    const evtsDoDia = eventosDoMes.filter(e => e.data === dateStr);

                    // Agrupa por turno
                    const byTurno: Record<Turno, string[]> = { MANHA: [], TARDE: [], NOITE: [] };
                    evtsDoDia.forEach(e => byTurno[e.turno]?.push(e.local));

                    return (
                      <button
                        key={day}
                        onClick={() => setDiaSelecionado(isSelected ? null : dateStr)}
                        className={cn(
                          "relative flex flex-col items-center pt-2 pb-1 rounded-2xl border transition-all duration-200 min-h-[5.5rem] shadow-sm overflow-hidden",
                          isSelected ? "bg-indigo-50 border-indigo-500 ring-2 ring-indigo-100" :
                          isToday ? "border-indigo-400 bg-indigo-50/30" :
                          "bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                        )}
                      >
                        <span className={cn("text-[13px] font-extrabold z-10 mb-1",
                          isToday || isSelected ? "text-indigo-700" : "text-slate-500"
                        )}>
                          {day}
                          {isToday && <span className="ml-0.5 w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block align-middle mb-0.5" />}
                        </span>

                        {/* Faixas de turno coloridas */}
                        <div className="absolute inset-x-1 bottom-1 top-7 flex flex-col gap-[2px]">
                          {(["MANHA", "TARDE", "NOITE"] as Turno[]).map(t => (
                            <div
                              key={t}
                              className={cn("flex-1 rounded-sm flex items-center justify-center gap-0.5 overflow-hidden px-0.5",
                                byTurno[t].length > 0 ? "bg-slate-100/80" : "bg-transparent")}
                            >
                              {Array.from(new Set(byTurno[t])).slice(0, 3).map((loc, idx) => (
                                <span
                                  key={idx}
                                  title={`${t}: ${ESPACOS_LABEL[loc] || loc}`}
                                  className={cn("rounded-full shrink-0", ESPACOS_CORES[loc] || "bg-slate-400")}
                                  style={{ width: 6, height: 6 }}
                                />
                              ))}
                            </div>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Painel lateral de detalhes */}
            <div className="clean-card p-5 flex flex-col max-h-[780px] bg-white">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <h3 className="text-[12px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-indigo-500" />
                  {diaSelecionado ? formatDateBR(diaSelecionado) : "Selecione um dia"}
                </h3>
                {diaSelecionado && (
                  <button onClick={() => setDiaSelecionado(null)} className="text-slate-300 hover:text-slate-500 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {!diaSelecionado ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400 gap-2">
                  <MapPin className="w-10 h-10 opacity-50" />
                  <p className="text-[13px] font-medium">Clique em uma data para ver a ocupação detalhada.</p>
                </div>
              ) : eventosNoDia.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center gap-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                  <p className="font-bold text-slate-700">Agenda Livre</p>
                  <p className="text-[12px] text-slate-400">Nenhum evento neste dia para os filtros ativos.</p>
                </div>
              ) : (
                <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                  {eventosNoDia.map((evt, idx) => {
                    const turnoInfo = TURNOS_HORARIOS[evt.turno];
                    return (
                      <div key={idx} className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
                        {/* Color bar lateral */}
                        <div className={cn("h-1 w-full", ESPACOS_CORES[evt.local] || "bg-slate-400")} />
                        <div className="p-3.5">
                          {/* Tipo */}
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                              {evt.tipo === "AULA" ? "AULA OFICIAL" : "RESERVA AVULSA"}
                            </span>
                            <span className={cn("text-[9px] px-2 py-0.5 rounded-full border font-black uppercase tracking-wide", turnoInfo.color)}>
                              {turnoInfo.label}
                            </span>
                          </div>

                          <p className="font-bold text-slate-800 text-[13px] leading-snug mb-2">{evt.titulo}</p>

                          <div className="space-y-1.5">
                            <p className="text-[11px] text-slate-600 flex items-center gap-1.5">
                              <MapPin className="w-3 h-3 text-indigo-400 shrink-0" />
                              {ESPACOS_LABEL[evt.local] || evt.local}
                            </p>
                            {evt.hora_inicio && (
                              <p className="text-[11px] text-slate-600 flex items-center gap-1.5">
                                <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                                {evt.hora_inicio} — {evt.hora_fim}
                              </p>
                            )}
                          </div>

                          {/* Info de origem (somente admin) */}
                          {isAdmin && evt.origin_tipo && (
                            <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1">
                              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-1">Origem</p>
                              <p className="text-[11px] font-bold text-slate-700">{evt.origin_desc}</p>
                              {evt.origin_solicitante && (
                                <p className="text-[11px] text-slate-500 flex items-center gap-1">
                                  <User className="w-3 h-3 shrink-0" />{evt.origin_solicitante}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ═══════════════════════════════════════════════════════
            VISTA 2 — NOVA SOLICITAÇÃO (RÁPIDA)
        ═══════════════════════════════════════════════════════ */}
        {currentView === "nova" && (
          <motion.div key="nova" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-5">

            {/* Coluna esquerda — Formulário e Presets */}
            <div className="lg:col-span-5 space-y-4">

              <div className="clean-card p-4 flex items-center gap-3 bg-white">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-black text-lg shrink-0">
                  {profile?.nome_completo?.charAt(0)}
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Solicitante</p>
                  <p className="text-[13px] font-bold text-slate-700">{profile?.nome_completo}</p>
                </div>
              </div>

              <div className="clean-card p-5 space-y-4 bg-white">
                <div>
                  <label className="form-label">Título do Evento *</label>
                  <input
                    type="text"
                    value={novoPedido.titulo}
                    onChange={e => setNovoPedido(p => ({ ...p, titulo: e.target.value }))}
                    className="input-light"
                    placeholder="Ex: Treinamento de Novos Servidores..."
                    autoFocus
                  />
                </div>
                <div>
                  <label className="form-label">Descrição <span className="text-slate-400 font-normal">(opcional)</span></label>
                  <textarea
                    value={novoPedido.descricao}
                    onChange={e => setNovoPedido(p => ({ ...p, descricao: e.target.value }))}
                    className="input-light resize-none h-20 text-[13px]"
                    placeholder="Público alvo, necessidades especiais..."
                  />
                </div>
              </div>

              <div className="clean-card p-5 space-y-4 bg-slate-50 border-indigo-200">
                <h3 className="text-[12px] font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2">
                  <Building2 className="w-4 h-4" /> PASSO 1 — Escolher Espaço
                </h3>
                <div className="grid grid-cols-1 gap-2">
                  {ESPACOS.map(e => (
                    <label
                      key={e.key}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                        prefEspaco === e.key ? "bg-indigo-50 border-indigo-300" : "bg-white border-slate-200 hover:border-slate-300"
                      )}
                    >
                      <input
                        type="radio"
                        name="espaco"
                        value={e.key}
                        checked={prefEspaco === e.key}
                        onChange={() => setPrefEspaco(e.key)}
                        className="w-4 h-4 text-indigo-600"
                      />
                      <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", ESPACOS_CORES[e.key])} />
                      <div className="flex-1">
                        <p className={cn("text-[13px] font-bold", prefEspaco === e.key ? "text-indigo-800" : "text-slate-700")}>{e.label}</p>
                        <p className="text-[11px] text-slate-400">{e.andar} · {e.vagas} vagas</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Coluna direita — Calendário e Lista */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              
              <div className="clean-card p-5 bg-white">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-100">
                  <div className="flex flex-col">
                     <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Horário Padrão</label>
                     <div className="flex items-center gap-2">
                        <input type="time" value={presetInicio} onChange={e => setPresetInicio(e.target.value)} className="input-light py-1.5 px-2 text-xs font-bold text-center w-24" />
                        <span className="text-slate-300 font-bold">-</span>
                        <input type="time" value={presetFim} onChange={e => setPresetFim(e.target.value)} className="input-light py-1.5 px-2 text-xs font-bold text-center w-24" />
                     </div>
                  </div>
                  <p className="text-[11px] text-slate-500 max-w-[200px] leading-relaxed">
                     <strong className="text-indigo-600">Dica:</strong> Defina o horário e saia clicando nos dias abaixo para adicionar à lista.
                  </p>
                </div>

                <div className="flex items-center justify-between mb-4 px-2">
                  <button onClick={prevMonth} type="button" className="p-1.5 bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 border border-slate-200">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-bold text-slate-700 text-sm uppercase tracking-widest">{MESES[calMonth]} {calYear}</span>
                  <button onClick={nextMonth} type="button" className="p-1.5 bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 border border-slate-200">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {DIAS_SEMANA.map(d => <div key={d} className="text-center text-[9px] font-black text-slate-400 uppercase pb-1">{d}</div>)}
                  {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const dateStr = makeDate(day);
                    const isSelected = itensSolicitacao.some(it => it.data === dateStr && it.espaco === prefEspaco);

                    const turnosOcupados = eventosDoMes
                      .filter(e => e.data === dateStr && e.local === prefEspaco && e.status === "APROVADA")
                      .map(e => e.turno);
                    const allBloqueado = turnosOcupados.length >= 3;

                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => handleDayClick(day)}
                        disabled={allBloqueado}
                        className={cn(
                          "relative py-3 rounded-lg text-[13px] font-bold transition-all border",
                          isSelected ? "bg-indigo-600 text-white border-indigo-700 shadow-md transform scale-105" :
                          allBloqueado ? "bg-red-50 text-red-400 border-red-200 cursor-not-allowed opacity-60" :
                          turnosOcupados.length > 0 ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100" :
                          "bg-white border-slate-100 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                        )}
                        title={allBloqueado ? "Bloqueado" : "Clique para selecionar"}
                      >
                        {day}
                        {turnosOcupados.length > 0 && !allBloqueado && (
                          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-amber-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Lista Editável das Solicitações */}
              <div className="flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[14px] font-bold text-slate-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                    Lista de Reservas
                  </h3>
                  <div className="flex items-center gap-2">
                    {temConflito && (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded-lg">
                        <AlertTriangle className="w-3.5 h-3.5" /> Conflitos na lista
                      </span>
                    )}
                    <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[11px] font-bold">{itensSolicitacao.length} iten(s)</span>
                  </div>
                </div>

                {itensSolicitacao.length === 0 ? (
                  <div className="clean-card flex-1 flex flex-col items-center justify-center py-10 border-dashed border-2 border-slate-200 bg-slate-50 text-slate-400 gap-2">
                    <CalendarIcon className="w-8 h-8 opacity-50" />
                    <p className="text-[13px] font-medium">Clique nos dias do calendário para adicionar à lista.</p>
                  </div>
                ) : (
                  <div className="clean-card bg-white border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto max-h-72 overflow-y-auto">
                      <table className="w-full text-left text-[13px] whitespace-nowrap">
                        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                          <tr>
                            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">Data</th>
                            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">Espaço</th>
                            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-center">Horário</th>
                            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">Turno</th>
                            <th className="px-4 py-3" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {itensSolicitacao.map(item => {
                            const turnoInfo = item.turno_calculado ? TURNOS_HORARIOS[item.turno_calculado] : null;
                            return (
                              <tr
                                key={item.id}
                                className={cn("transition-colors", item.conflito ? "bg-red-50 hover:bg-red-50/80" : "hover:bg-slate-50/50")}
                              >
                                <td className="px-4 py-3 font-semibold text-slate-700">{formatDateBR(item.data)}</td>
                                <td className="px-4 py-3 text-slate-600">
                                  <span className="flex items-center gap-1.5 text-[11px] font-bold">
                                    <span className={cn("w-2 h-2 rounded-full shrink-0", ESPACOS_CORES[item.espaco])} />
                                    {ESPACOS_LABEL[item.espaco] || item.espaco}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-center">
                                   {/* Edição direta no form */}
                                   <div className="flex items-center justify-center gap-1">
                                      <input type="time" value={item.hora_inicio} onChange={e => atualizarItemLista(item.id, 'hora_inicio', e.target.value)} className="input-light py-1 px-1.5 text-[11px] font-bold text-center w-16" />
                                      <span className="text-slate-400 font-bold">-</span>
                                      <input type="time" value={item.hora_fim} onChange={e => atualizarItemLista(item.id, 'hora_fim', e.target.value)} className="input-light py-1 px-1.5 text-[11px] font-bold text-center w-16" />
                                   </div>
                                </td>
                                <td className="px-4 py-3">
                                  {turnoInfo && (
                                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", turnoInfo.color)}>
                                      {turnoInfo.label}
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <div className="flex items-center gap-2 justify-end">
                                    {item.conflito && (
                                      <span title="Conflito de turno!" className="text-red-500">
                                        <AlertTriangle className="w-4 h-4" />
                                      </span>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => removerItem(item.id)}
                                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <button
                  onClick={enviarSolicitacao}
                  disabled={isSubmitting || itensSolicitacao.length === 0 || temConflito}
                  className={cn(
                    "mt-4 w-full py-3.5 rounded-2xl font-bold text-[15px] shadow-lg transition-all flex items-center justify-center gap-2",
                    temConflito
                      ? "bg-red-100 text-red-500 border border-red-200 cursor-not-allowed"
                      : "btn-success"
                  )}
                >
                  {isSubmitting
                    ? <Loader2 className="w-5 h-5 animate-spin" />
                    : temConflito
                    ? <><AlertTriangle className="w-5 h-5" /> Conflitos vermelhos impedem o envio</>
                    : <><Send className="w-5 h-5" /> Enviar Solicitação</>
                  }
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══════════════════════════════════════════════════════
            VISTA 3 — MEUS PEDIDOS
        ═══════════════════════════════════════════════════════ */}
        {currentView === "minhas" && (
          <motion.div key="minhas" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-500" /> Meus Protocolos
              </h2>
              {canSolicitar && (
                <button onClick={() => setCurrentView("nova")} className="btn-primary w-auto px-5 py-2 flex items-center gap-2 text-sm">
                  <Plus className="w-4 h-4" /> Nova Solicitação
                </button>
              )}
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
            ) : minhasSolicitacoes.length === 0 ? (
              <div className="clean-card p-16 text-center flex flex-col items-center bg-white border-dashed border-2">
                <Info className="w-12 h-12 text-slate-300 mb-3" />
                <p className="font-bold text-slate-600">Nenhum protocolo encontrado</p>
                <p className="text-[13px] text-slate-400 mt-1">Você ainda não realizou nenhuma solicitação de espaço.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {minhasSolicitacoes.map(sol => (
                  <div key={sol.id} className="clean-card bg-white overflow-hidden shadow-sm border border-slate-200">
                    {/* Header do protocolo */}
                    <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Protocolo</p>
                        <p className="text-lg font-black text-indigo-600">#{sol.protocolo.split('-').pop()}</p>
                        <p className="text-[13px] font-bold text-slate-700 mt-0.5">{sol.titulo}</p>
                      </div>
                      <div className="flex flex-wrap gap-2 items-center">
                        <span className={cn("px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border", statusBadge(sol.status))}>
                          {statusLabel(sol.status)}
                        </span>
                        {sol.status === "PENDENTE" && (
                          <button
                            onClick={() => handleCancelar(sol.id)}
                            className="px-3 py-1 rounded-lg text-[11px] font-bold text-red-500 border border-red-200 hover:bg-red-50 flex items-center gap-1 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" /> Cancelar
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="p-5">
                      {sol.descricao && <p className="text-[13px] text-slate-600 mb-4">{sol.descricao}</p>}
                      {sol.justificativa_recusa && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl">
                          <p className="text-[10px] font-black uppercase text-red-500 mb-1">Motivo da Recusa</p>
                          <p className="text-[12px] text-red-700">{sol.justificativa_recusa}</p>
                        </div>
                      )}

                      {/* Tabela de itens */}
                      <div className="rounded-xl border border-slate-100 overflow-hidden">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                          <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                            <tr>
                              <th className="px-4 py-2.5">Data</th>
                              <th className="px-4 py-2.5">Espaço</th>
                              <th className="px-4 py-2.5">Horário</th>
                              <th className="px-4 py-2.5 text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50 text-[13px]">
                            {sol.itens?.map((item: any, idx: number) => (
                              <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-4 py-3 font-semibold">{formatDateBR(item.data)}</td>
                                <td className="px-4 py-3 text-slate-600">
                                  <span className="flex items-center gap-1.5">
                                    <span className={cn("w-2 h-2 rounded-full shrink-0", ESPACOS_CORES[item.espaco])} />
                                    {ESPACOS_LABEL[item.espaco] || item.espaco}
                                  </span>
                                </td>
                                <td className="px-4 py-3 font-mono text-slate-600">{item.hora_inicio} – {item.hora_fim}</td>
                                <td className="px-4 py-3 text-right">
                                  <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", statusBadge(sol.status))}>
                                    {statusLabel(sol.status)}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ═══════════════════════════════════════════════════════
            VISTA 4 — ADMIN: VALIDAR PEDIDOS
        ═══════════════════════════════════════════════════════ */}
        {currentView === "gestao" && isAdmin && (
          <motion.div key="gestao" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-500" /> Pedidos da Comunidade
            </h2>

            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
            ) : adminSolicitacoes.length === 0 ? (
              <div className="clean-card p-16 text-center flex flex-col items-center border-dashed border-2">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-3" />
                <p className="font-bold text-slate-600">Nenhum pedido pendente</p>
                <p className="text-[13px] text-slate-400 mt-1">A caixa de solicitações está limpa.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {adminSolicitacoes.map(sol => (
                  <div key={sol.id} className={cn("clean-card bg-white overflow-hidden shadow-sm border transition-all",
                    sol.status === "PENDENTE" ? "border-amber-300 ring-2 ring-amber-50" : "border-slate-200"
                  )}>
                    {/* Header */}
                    <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold shrink-0">
                          {sol.solicitante_nome?.charAt(0)}
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
                            Protocolo #{sol.protocolo?.split("-").pop()} · {sol.solicitante_nome}
                          </p>
                          <p className="text-[15px] font-bold text-slate-800">{sol.titulo}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 items-center">
                        <span className={cn("px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border", statusBadge(sol.status))}>
                          {statusLabel(sol.status)}
                        </span>
                        {sol.status === "PENDENTE" && (
                          <>
                            <button
                              onClick={() => setShowNegar(showNegar === sol.id ? null : sol.id)}
                              className="px-4 py-1.5 rounded-xl text-[12px] font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors"
                            >
                              Recusar
                            </button>
                            <button
                              onClick={() => handleAvaliar(sol.id, "aprovar")}
                              className="px-4 py-1.5 rounded-xl text-[12px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-colors"
                            >
                              ✓ Aprovar
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="p-5 space-y-4">
                      {sol.descricao && <p className="text-[13px] text-slate-600">{sol.descricao}</p>}

                      {/* Form de justificativa */}
                      <AnimatePresence>
                        {showNegar === sol.id && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                            className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
                            <p className="text-[12px] font-bold text-red-700">Justificativa de recusa *</p>
                            <textarea
                              value={justificativaReserva}
                              onChange={e => setJustificativaReserva(e.target.value)}
                              placeholder="Explique o motivo da recusa..."
                              rows={3}
                              className="w-full border border-red-200 rounded-xl p-3 text-[13px] resize-none focus:ring-2 focus:ring-red-300 outline-none bg-white"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleAvaliar(sol.id, "negar")}
                                className="px-4 py-2 bg-red-600 text-white rounded-xl text-[13px] font-bold hover:bg-red-700 transition-colors"
                              >
                                Confirmar Recusa
                              </button>
                              <button
                                onClick={() => { setShowNegar(null); setJustificativaReserva(""); }}
                                className="px-4 py-2 text-slate-500 hover:bg-slate-200 rounded-xl text-[13px] font-bold transition-colors"
                              >
                                Cancelar
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Tabela de itens */}
                      <div className="rounded-xl border border-slate-100 overflow-hidden">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                          <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                            <tr>
                              <th className="px-4 py-2.5">Data</th>
                              <th className="px-4 py-2.5">Espaço</th>
                              <th className="px-4 py-2.5">Horário</th>
                              <th className="px-4 py-2.5 text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50 text-[13px]">
                            {sol.itens?.map((item: any, idx: number) => (
                              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3 font-semibold">{formatDateBR(item.data)}</td>
                                <td className="px-4 py-3 text-slate-700 font-bold">
                                  <span className="flex items-center gap-1.5">
                                    <span className={cn("w-2 h-2 rounded-full shrink-0", ESPACOS_CORES[item.espaco])} />
                                    {ESPACOS_LABEL[item.espaco] || item.espaco}
                                  </span>
                                </td>
                                <td className="px-4 py-3 font-mono text-slate-600">{item.hora_inicio} – {item.hora_fim}</td>
                                <td className="px-4 py-3 text-right">
                                  <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border",
                                    sol.status === "PENDENTE" ? "bg-amber-50 text-amber-600 border-amber-200" :
                                    sol.status === "APROVADA" ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
                                    "bg-slate-100 text-slate-500 border-slate-200"
                                  )}>
                                    {sol.status === "PENDENTE" ? "Em Análise" : sol.status === "APROVADA" ? "Confirmado" : "Liberado"}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}