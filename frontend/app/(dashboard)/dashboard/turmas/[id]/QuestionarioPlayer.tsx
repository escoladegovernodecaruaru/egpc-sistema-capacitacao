import { useState, useEffect } from "react";
import { fetchApi } from "@/lib/api";
import { Loader2, ArrowLeft, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function QuestionarioPlayer({ atividadeId, onConcluir, onBack }: { atividadeId: number, onConcluir: () => void, onBack: () => void }) {
  const [questionario, setQuestionario] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [tempoRestante, setTempoRestante] = useState<number | null>(null);
  const [resultado, setResultado] = useState<any>(null);
  const [erroFatal, setErroFatal] = useState<string | null>(null);

  useEffect(() => {
    fetchApi<any>(`/cursos/atividades/${atividadeId}/questionario/`)
      .then(res => {
         if (!res || !res.id) {
             setErroFatal("Questionário não configurado pelo instrutor.");
             return;
         }
         setQuestionario(res);
         if (res.tempo_limite_minutos > 0) {
            setTempoRestante(res.tempo_limite_minutos * 60);
         }
      })
      .catch(e => setErroFatal("Erro ao carregar o questionário"))
      .finally(() => setLoading(false));
  }, [atividadeId]);

  useEffect(() => {
    if (tempoRestante === null || tempoRestante <= 0 || resultado) return;
    const t = setInterval(() => setTempoRestante(v => v! - 1), 1000);
    return () => clearInterval(t);
  }, [tempoRestante, resultado]);

  useEffect(() => {
     if (tempoRestante === 0 && !resultado && !submitting) {
         toast.error("Tempo esgotado! Submetendo automaticamente...");
         handleSubmit();
     }
  }, [tempoRestante]);

  const handleSelect = (questaoId: string, opcaoId: string) => {
     setRespostas(prev => ({...prev, [questaoId]: opcaoId}));
  };

  const handleSubmit = async () => {
     setSubmitting(true);
     const payload = {
        respostas: Object.entries(respostas).map(([q, op]) => ({ questao_id: q, opcao_id: op }))
     };
     try {
        const res = await fetchApi<any>(`/cursos/atividades/${atividadeId}/submeter-questionario/`, {
           method: "POST", body: JSON.stringify(payload)
        });
        setResultado(res);
        toast.success(`Submetido! ${res.detail}`);
        if (res.nota >= (questionario.nota_minima_aprovacao || 0)) {
           onConcluir();
        }
     } catch (e: any) {
        toast.error(e.message || "Erro ao submeter. Verifique suas tentativas ou tente novamente.");
     } finally {
        setSubmitting(false);
     }
  };

  const formatTempo = (segs: number) => {
     const m = Math.floor(segs / 60).toString().padStart(2, '0');
     const s = (segs % 60).toString().padStart(2, '0');
     return `${m}:${s}`;
  };

  if (loading) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin w-8 h-8 text-primary"/></div>;
  
  if (erroFatal) {
      return (
         <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center space-y-4 max-w-lg mx-auto mt-8">
            <AlertTriangle className="w-12 h-12 mx-auto text-amber-500" />
            <h2 className="text-xl font-bold">Indisponível</h2>
            <p className="text-slate-500">{erroFatal}</p>
            <button onClick={onBack} className="btn-primary mt-4">Voltar</button>
         </div>
      );
  }

  if (resultado) {
      const aprovado = resultado.nota >= questionario.nota_minima_aprovacao;
      return (
         <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center space-y-4 max-w-lg mx-auto mt-8">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${aprovado ? 'bg-emerald-100 text-emerald-500' : 'bg-red-100 text-red-500'}`}>
                {aprovado ? <CheckCircle2 className="w-8 h-8"/> : <AlertTriangle className="w-8 h-8"/>}
            </div>
            <h2 className="text-xl font-bold">Avaliação Finalizada</h2>
            <p className="text-slate-500">Média necessária para aprovação: {questionario.nota_minima_aprovacao}</p>
            <p className="text-slate-500">Sua nota normalizada de 0 a 10:</p>
            <p className={`text-5xl font-black ${aprovado ? 'text-emerald-600' : 'text-red-500'}`}>{resultado.nota}</p>
            
            {aprovado ? (
                <div className="p-3 bg-emerald-50 text-emerald-700 text-sm font-bold rounded-lg border border-emerald-100 mt-4">
                    Aprovado nesta atividade! 🎉
                </div>
            ) : (
                <div className="p-3 bg-red-50 text-red-700 text-sm font-bold rounded-lg border border-red-100 mt-4">
                    Não alcançou a média mínima. Você usou {resultado.tentativa_numero} de {questionario.tentativas_permitidas} tentativas.
                </div>
            )}
            
            <button onClick={onBack} className="btn-primary w-full mt-4">Voltar para Sala de Aula</button>
         </div>
      );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden max-w-3xl mx-auto mt-6">
       <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center sticky top-0 z-10">
          <div className="flex items-center gap-4">
             <button onClick={onBack} className="p-2 hover:bg-slate-200 rounded-lg transition-colors"><ArrowLeft className="w-5 h-5 text-slate-500"/></button>
             <div>
                <h2 className="font-bold text-slate-800">{questionario.titulo}</h2>
                <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">{questionario.questoes.length} Questões • Média {questionario.nota_minima_aprovacao}</p>
             </div>
          </div>
          {tempoRestante !== null && (
             <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold text-sm ${tempoRestante < 60 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-slate-200 text-slate-700'}`}>
                <Clock className="w-4 h-4"/> {formatTempo(tempoRestante)}
             </div>
          )}
       </div>

       <div className="p-6 space-y-8">
          {questionario.descricao && (
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-sm text-slate-600 leading-relaxed mb-6">
                  {questionario.descricao}
              </div>
          )}
          {questionario.questoes.map((q: any, i: number) => (
             <div key={q.id} className="space-y-4 pb-6 border-b border-slate-100 last:border-0 last:pb-0">
                <p className="font-bold text-slate-800 text-base leading-relaxed">
                   <span className="text-primary mr-2">#{i+1}</span>{q.enunciado}
                </p>
                <div className="space-y-2 sm:pl-6">
                   {q.opcoes.map((op: any) => (
                      <label key={op.id} className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${respostas[q.id] === op.id ? 'border-indigo-400 bg-indigo-50/50 shadow-sm' : 'border-slate-200 hover:bg-slate-50'}`}>
                         <input type="radio" name={`q_${q.id}`} value={op.id} checked={respostas[q.id] === op.id} onChange={() => handleSelect(q.id, op.id)} className="w-4 h-4 text-indigo-600 mt-0.5" />
                         <span className="text-[14px] font-medium text-slate-700 leading-snug">{op.texto}</span>
                      </label>
                   ))}
                </div>
             </div>
          ))}
       </div>

       <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end items-center gap-4">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{Object.keys(respostas).length} de {questionario.questoes.length} respondidas</span>
          <button onClick={handleSubmit} disabled={submitting || Object.keys(respostas).length < questionario.questoes.length} className="btn-primary px-8 h-12 shadow-md">
             {submitting ? <Loader2 className="w-5 h-5 animate-spin"/> : "Finalizar e Submeter"}
          </button>
       </div>
    </div>
  )
}
