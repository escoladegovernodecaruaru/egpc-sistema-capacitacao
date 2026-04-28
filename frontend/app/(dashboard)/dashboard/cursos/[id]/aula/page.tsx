"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { fetchApi } from "@/lib/api";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { PlayCircle, CheckCircle2, ChevronLeft, Lock, Loader2, BookOpen, Clock, Video } from "lucide-react";
import { cn } from "@/lib/utils";

declare global {
  interface Window { onYouTubeIframeAPIReady: () => void; YT: any; }
}

export default function SalaDeAulaPage() {
  const { id: turmaId } = useParams();
  const router = useRouter();
  const [dados, setDados] = useState<any>(null);
  const [atividadeAtiva, setAtividadeAtiva] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const playerRef = useRef<any>(null);

  const carregarSala = async () => {
    try {
      const res = await fetchApi<any>(`/cursos/turmas/${turmaId}/sala-de-aula/`);
      setDados(res);
      // Seleciona a primeira atividade automaticamente se não houver uma ativa
      if (!atividadeAtiva && res.modulos?.[0]?.atividades?.[0]) {
        setAtividadeAtiva(res.modulos[0].atividades[0]);
      }
    } catch (err) {
      toast.error("Acesso negado ou turma não encontrada.");
      router.push("/dashboard/cursos");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { carregarSala(); }, [turmaId]);

  // Integração com YouTube API para detetar fim do vídeo
  useEffect(() => {
    if (atividadeAtiva?.tipo === "VIDEO_YOUTUBE" && atividadeAtiva.url_video) {
      const videoId = atividadeAtiva.url_video.split('v=')[1]?.split('&')[0] || atividadeAtiva.url_video.split('/').pop();
      
      if (!window.YT) {
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      }

      window.onYouTubeIframeAPIReady = () => {
        playerRef.current = new window.YT.Player('player-lms', {
          height: '100%',
          width: '100%',
          videoId: videoId,
          events: { 'onStateChange': onPlayerStateChange }
        });
      };

      if (window.YT && window.YT.Player) {
        if (playerRef.current) playerRef.current.destroy();
        playerRef.current = new window.YT.Player('player-lms', {
          videoId: videoId,
          events: { 'onStateChange': onPlayerStateChange }
        });
      }
      
      // Cleanup de memória ao trocar atividade ou desmontar
      return () => {
        if (playerRef.current) {
          playerRef.current.destroy();
          playerRef.current = null;
        }
      };
    }
  }, [atividadeAtiva]);

  // Ping Anti-Cheat de 60s
  useEffect(() => {
    let interval: any;
    if (atividadeAtiva?.tipo === "VIDEO_YOUTUBE") {
      interval = setInterval(async () => {
        if (playerRef.current?.getPlayerState && playerRef.current.getPlayerState() === 1) { // 1 = PLAYING
          try {
            await fetchApi(`/cursos/atividades/${atividadeAtiva.id}/ping/`, { method: "POST" });
          } catch (e) {
            console.error(e);
          }
        }
      }, 60000);
    }
    return () => clearInterval(interval);
  }, [atividadeAtiva]);

  const onPlayerStateChange = async (event: any) => {
    // 0 = YT.PlayerState.ENDED
    if (event.data === 0) {
      try {
        await fetchApi(`/cursos/atividades/${atividadeAtiva.id}/concluir/`, { method: "POST" });
        toast.success("Aula concluída! Carga horária somada.");
        carregarSala(); // Atualiza o progresso visual
      } catch (e) { console.error("Erro ao salvar progresso."); }
    }
  };

  if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-primary w-10 h-10"/></div>;

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-2rem)] gap-4 animate-[fade-in_0.4s_ease-out]">
      
      {/* LADO ESQUERDO: PLAYER E CONTEÚDO */}
      <div className="flex-1 flex flex-col gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500"><ChevronLeft/></button>
          <div>
            <h1 className="font-bold text-slate-800 leading-tight">{dados.turma.titulo}</h1>
            <p className="text-xs text-slate-500">Turma {dados.turma.codigo} • {dados.progresso.carga_adquirida}h de {dados.turma.carga_total}h conquistadas</p>
          </div>
        </div>

        <div className="aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl border-4 border-white">
          {atividadeAtiva?.tipo === "VIDEO_YOUTUBE" ? (
            <div id="player-lms" className="w-full h-full"></div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-white p-10 text-center">
              <BookOpen className="w-16 h-16 mb-4 opacity-20"/>
              <h2 className="text-xl font-bold">{atividadeAtiva?.titulo}</h2>
              <p className="text-slate-400 mt-2">{atividadeAtiva?.descricao || "Siga as instruções do instrutor para esta atividade."}</p>
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200">
           <h2 className="font-bold text-lg text-slate-800 mb-2">{atividadeAtiva?.titulo}</h2>
           <div className="flex items-center gap-4 text-xs font-bold text-slate-500 mb-4">
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5"/> +{atividadeAtiva?.carga_horaria_recompensa}h ao concluir</span>
              <span className="bg-indigo-50 text-indigo-600 px-2 py-1 rounded">Módulo: {dados.modulos.find((m:any) => m.atividades.some((a:any) => a.id === atividadeAtiva.id))?.titulo}</span>
           </div>
           <p className="text-sm text-slate-600 leading-relaxed">{atividadeAtiva?.descricao}</p>
        </div>
      </div>

      {/* LADO DIREITO: PLAYLIST DE MÓDULOS */}
      <div className="w-full lg:w-[380px] flex flex-col gap-4">
        <div className="bg-slate-900 text-white p-6 rounded-3xl">
           <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-1">O seu progresso</p>
           <div className="flex justify-between items-end mb-2">
              <span className="text-2xl font-black">{dados.progresso.meta > 0 ? Math.round((dados.progresso.carga_adquirida / dados.progresso.meta) * 100) : 0}%</span>
              <span className="text-xs font-medium text-slate-400">{dados.progresso.carga_adquirida}/{dados.progresso.meta} horas</span>
           </div>
           <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${dados.progresso.meta > 0 ? (dados.progresso.carga_adquirida / dados.progresso.meta) * 100 : 0}%` }} className="h-full bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]"/>
           </div>
        </div>

        <div className="flex-1 bg-white rounded-3xl border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-bold text-slate-800 text-sm">Conteúdo do Curso</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {dados.modulos.map((modulo: any) => (
              <div key={modulo.id} className="space-y-2">
                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-2">{modulo.titulo}</h4>
                <div className="space-y-1">
                  {modulo.atividades.map((aula: any) => (
                    <button 
                      key={aula.id} 
                      onClick={() => setAtividadeAtiva(aula)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-2xl text-left transition-all group",
                        atividadeAtiva?.id === aula.id ? "bg-indigo-50 border border-indigo-100 shadow-sm" : "hover:bg-slate-50 border border-transparent"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
                        aula.concluida ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400 group-hover:bg-white"
                      )}>
                        {aula.concluida ? <CheckCircle2 className="w-5 h-5"/> : <PlayCircle className="w-5 h-5"/>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={cn("text-[13px] font-bold truncate", atividadeAtiva?.id === aula.id ? "text-indigo-700" : "text-slate-700")}>{aula.titulo}</p>
                        <p className="text-[10px] text-slate-500">{aula.carga_horaria_recompensa}h • {aula.tipo.replace('_', ' ')}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}