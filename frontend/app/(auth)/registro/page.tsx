"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, Mail, Phone, Calendar, Briefcase,
  Lock, CheckCircle2, ArrowLeft, Loader2,
  AlertTriangle, ShieldCheck, UserRound, KeyRound, RefreshCcw
} from "lucide-react";
import { fetchApi, type ApiError } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { validarCPF, mascaraCPF, mascaraTelefone, calcularIdade } from "@/lib/validations";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

type TipoUsuario = "CIDADAO" | "SERVIDOR_ATIVO" | "TERCEIRIZADO" | "ESTAGIARIO";
type StepId = 1 | 2 | 3 | 3.5 | 4 | 5 | 6;

interface FormState {
  cpf:              string;
  email:            string;
  otp:              string;
  nome_completo:    string;
  telefone:         string;
  data_nascimento:  string;
  responsavel_nome: string;
  responsavel_cpf:  string;
  tipo_usuario:     TipoUsuario;
  matricula:        string; 
  empresa:          string; 
  secretaria:       string;
  cpf_chefe:        string;
  password:         string;
  passwordConfirm:  string;
}

const INITIAL_FORM: FormState = {
  cpf: "", email: "", otp: "", nome_completo: "", telefone: "",
  data_nascimento: "", responsavel_nome: "", responsavel_cpf: "",
  tipo_usuario: "CIDADAO", matricula: "", empresa: "", secretaria: "", cpf_chefe: "",
  password: "", passwordConfirm: "",
};

// 1min, 5min, 30min, 60min
const DELAYS = [60, 300, 1800, 3600];

// ─────────────────────────────────────────────────────────────────────────────
// Componentes internos reutilizáveis
// ─────────────────────────────────────────────────────────────────────────────

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="form-label">{label}</label>
      <div className="relative">{children}</div>
    </div>
  );
}

function IconInput({ icon: Icon, errorMsg, ...props }: any) {
  return (
    <>
      {Icon && <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />}
      <input
        {...props}
        className={cn(
          "input-light", Icon ? "pl-11" : "",
          errorMsg ? "input-error" : "", props.className
        )}
      />
      <AnimatePresence>
        {errorMsg && (
          <motion.p
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-1.5 text-[12px] text-red-500 mt-1 ml-1 font-medium"
          >
            <AlertTriangle className="w-3 h-3 flex-shrink-0" />
            {errorMsg}
          </motion.p>
        )}
      </AnimatePresence>
    </>
  );
}

function StepProgress({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={cn("h-[3px] flex-1 rounded-full transition-all duration-500", i + 1 <= current ? "bg-primary" : "bg-slate-200")} />
      ))}
    </div>
  );
}

const SLIDE = {
  hidden:  { opacity: 0, x: 24, scale: 0.97 },
  visible: { opacity: 1, x: 0, scale: 1, transition: { type: "spring" as const, stiffness: 320, damping: 30 } },
  exit:    { opacity: 0, x: -24, scale: 0.97, transition: { duration: 0.15 } },
};

// ─────────────────────────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────────────────────────

export default function RegistroPage() {
  const router = useRouter();
  const [step, setStep] = useState<StepId>(1);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [cpfError, setCpfError] = useState("");
  const [cpfRespError, setCpfRespError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // ── ESTADOS DE SEGURANÇA (OTP) ──
  const [otpAttempts, setOtpAttempts] = useState(0);
  const [resendCount, setResendCount] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [lastSentEmail, setLastSentEmail] = useState("");

  const cpfLimpo     = form.cpf.replace(/\D/g, "");
  const cpfRespLimpo = form.responsavel_cpf.replace(/\D/g, "");
  const idade        = form.data_nascimento ? calcularIdade(form.data_nascimento) : null;
  const isMenor      = idade !== null && idade < 18;

  const stepsVisiveis: StepId[] = isMenor ? [1, 2, 3, 3.5, 4, 5, 6] : [1, 2, 3, 4, 5, 6];
  const stepIndex = stepsVisiveis.indexOf(step);
  const totalSteps = stepsVisiveis.length;

  const set = (field: keyof FormState, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // ── LIMPEZA TOTAL (Resolve Problema de Sessão Presa/F5) ──
  const handleResetRegistration = async () => {
    localStorage.removeItem("egpc_otp_cooldown");
    localStorage.removeItem("egpc_partial_reg");
    await supabase.auth.signOut();
    setForm(INITIAL_FORM);
    setStep(1);
    setCountdown(0);
    setLastSentEmail("");
    toast.success("Progresso limpo. Você pode iniciar um novo cadastro.");
  };

  // ── PERSISTÊNCIA DO FORMULÁRIO NO F5 ──
  useEffect(() => {
    if (!isInitializing) {
      localStorage.setItem("egpc_partial_reg", JSON.stringify({ form, step }));
    }
  }, [form, step, isInitializing]);

  // ── INICIALIZAÇÃO E VALIDAÇÃO REAL DA SESSÃO ──
  useEffect(() => {
    const initialize = async () => {
      const savedReg = localStorage.getItem("egpc_partial_reg");
      if (savedReg) {
        try {
          const { form: savedForm, step: savedStep } = JSON.parse(savedReg);
          setForm(savedForm);
          setStep(savedStep);
        } catch(e) {}
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) {
          await handleResetRegistration();
        } else if (step < 3) {
          set("email", user.email || "");
          setStep(3);
        }
      }

      const storedCooldown = localStorage.getItem("egpc_otp_cooldown");
      if (storedCooldown) {
        try {
          const { nextTime, count, email } = JSON.parse(storedCooldown);
          const diff = Math.floor((nextTime - Date.now()) / 1000);
          if (diff > 0) {
            setCountdown(diff);
            setResendCount(count);
            setLastSentEmail(email);
          }
        } catch(e) {}
      }
      setIsInitializing(false);
    };
    initialize();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // ── RECUPERAÇÃO DE SESSÃO (CROSS-TAB) ──
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && step === 2) {
        toast.success("E-mail verificado automaticamente pelo link!");
        setStep(3); 
      }
    });

    return () => subscription.unsubscribe();
  }, [step]);

  // ── VALIDAÇÕES ──
  const verificarCPFNoBanco = useCallback(async (cpf: string) => {
    try {
      await fetchApi("/users/auth/pre-validate/", { method: "POST", requireAuth: false, body: JSON.stringify({ cpf }) });
      setCpfError("");
    } catch (err: any) {
      if (err.status === 400 && err.errors?.cpf) setCpfError("Este CPF já está cadastrado.");
      else setCpfError("");
    }
  }, []);

  useEffect(() => {
    if (cpfLimpo.length === 11) {
      if (!validarCPF(cpfLimpo)) setCpfError("CPF matematicamente inválido.");
      else verificarCPFNoBanco(cpfLimpo);
    } else setCpfError("");
  }, [cpfLimpo, verificarCPFNoBanco]);

  useEffect(() => {
    if (cpfRespLimpo.length === 11) {
      if (!validarCPF(cpfRespLimpo)) {
        setCpfRespError("CPF do responsável é inválido.");
      } else if (cpfRespLimpo === cpfLimpo) {
        setCpfRespError("O CPF do responsável não pode ser igual ao seu.");
      } else {
        setCpfRespError("");
      }
    } else {
      setCpfRespError("");
    }
  }, [cpfRespLimpo, cpfLimpo]);

  // ── LÓGICA OTP ──
  const handleRequestOTP = async (isResend = false) => {
    if (!validarCPF(cpfLimpo) || cpfError) return toast.error("Corrija o CPF antes de continuar.");
    if (!form.email) return toast.error("Preencha o e-mail.");

    if (!isResend && form.email === lastSentEmail) {
      setStep(2);
      return;
    }

    if (isResend && countdown > 0) return;

    setIsLoading(true);
    try {
      if (form.email !== lastSentEmail) {
        await fetchApi("/users/auth/pre-validate/", {
          method: "POST", requireAuth: false, body: JSON.stringify({ cpf: cpfLimpo, email: form.email }),
        });
      }

      const redirectUrl = typeof window !== 'undefined' ? `${window.location.origin}/registro` : undefined;
      const { error } = await supabase.auth.signInWithOtp({ 
        email: form.email,
        options: { emailRedirectTo: redirectUrl }
      });
      
      if (error) throw error;

      toast.success(isResend ? "Novo código enviado!" : "Código enviado! Verifique seu e-mail.");
      setStep(2);
      setLastSentEmail(form.email);

      const currentCount = isResend ? resendCount : 0;
      const delayIndex = Math.min(currentCount, DELAYS.length - 1);
      const delay = DELAYS[delayIndex];

      setCountdown(delay);
      setResendCount(currentCount + 1);
      setOtpAttempts(0);
      set("otp", "");

      if (typeof window !== "undefined") {
        localStorage.setItem("egpc_otp_cooldown", JSON.stringify({
          nextTime: Date.now() + delay * 1000,
          count: currentCount + 1,
          email: form.email
        }));
      }
    } catch (err: any) {
      toast.error(err.errors?.email?.[0] || err.message || "Erro ao solicitar código.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (form.otp.length !== 6) return;
    
    if (otpAttempts >= 3) {
      toast.error("Muitas tentativas falhas. Por segurança, solicite um novo código.");
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.auth.verifyOtp({ email: form.email, token: form.otp, type: "email" });
    setIsLoading(false);

    if (error) {
      const newAttempts = otpAttempts + 1;
      setOtpAttempts(newAttempts);
      
      if (newAttempts >= 3) {
        toast.error("Você errou o código 3 vezes. Aguarde e solicite um novo envio.");
      } else {
        toast.error(`Código inválido. Você tem mais ${3 - newAttempts} tentativa(s).`);
      }
    } else {
      toast.success("E-mail verificado com sucesso!");
      setStep(3);
    }
  };

  // ── CONTROLE DE PASSOS ──
  const handleNext = () => {
    if (step === 3) {
      if (!form.nome_completo || !form.telefone || !form.data_nascimento) return toast.error("Preencha todos os campos obrigatórios.");
      setStep(isMenor ? 3.5 : 4); return;
    }
    if (step === 3.5) {
      if (!form.responsavel_nome || cpfRespLimpo.length !== 11 || cpfRespError) {
        return toast.error("Informe corretamente os dados do responsável.");
      }
      if (cpfRespLimpo === cpfLimpo) {
        return toast.error("Você não pode ser o seu próprio responsável legal.");
      }
      if (form.tipo_usuario === "SERVIDOR_ATIVO" || form.tipo_usuario === "TERCEIRIZADO") {
        set("tipo_usuario", "CIDADAO");
      }
      setStep(4); return;
    }
    if (step === 4) return setStep(form.tipo_usuario === "CIDADAO" ? 6 : 5);
    if (step === 5) {
      if (form.tipo_usuario === "SERVIDOR_ATIVO" && !form.matricula.trim()) return toast.error("A matrícula é obrigatória para Servidores.");
      setStep(6); return;
    }
  };

  const handleBack = () => {
    if (step === 6)   return setStep(form.tipo_usuario === "CIDADAO" ? 4 : 5);
    if (step === 5)   return setStep(4);
    if (step === 4)   return setStep(isMenor ? 3.5 : 3);
    if (step === 3.5) return setStep(3);
    if (step === 3)   return setStep(2);
    if (step === 2)   return setStep(1);
  };

  // ── FINALIZAÇÃO ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.passwordConfirm) return toast.error("As senhas não coincidem.");
    if (form.password.length < 6) return toast.error("A senha deve ter pelo menos 6 caracteres.");
    
    setIsLoading(true);
    const { error: pwdError } = await supabase.auth.updateUser({ password: form.password });
    
    if (pwdError) {
      toast.error("Erro ao salvar senha no provedor de segurança.");
      setIsLoading(false); return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Sessão de segurança perdida. Faça login novamente.");
      setIsLoading(false); return;
    }

    const dados_servidor: any = { secretaria: form.secretaria || null, cpf_chefe: form.cpf_chefe ? form.cpf_chefe.replace(/\D/g, "") : null, dt_nascimento: form.data_nascimento };
    if (form.tipo_usuario === "SERVIDOR_ATIVO") dados_servidor.matricula = form.matricula;
    else if (form.tipo_usuario !== "CIDADAO") dados_servidor.empresa = form.empresa;

    const corpoRegistro = {
      cpf: cpfLimpo, nome_completo: form.nome_completo, email: form.email,
      telefone: form.telefone.replace(/\D/g, ""), tipo_usuario: form.tipo_usuario, dados_servidor,
    };

    try {
      await fetchApi("/users/auth/register/", {
        method: "POST", requireAuth: false, headers: { Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify(corpoRegistro),
      });
      toast.success("Cadastro realizado com sucesso! Bem-vindo(a) ao EGPC.");
      // Limpa os caches locais pois o cadastro finalizou com sucesso
      localStorage.removeItem("egpc_partial_reg");
      localStorage.removeItem("egpc_otp_cooldown");
      router.push("/dashboard");
    } catch (err: any) {
      await supabase.auth.signOut();
      toast.error(`Perfil não criado: ${err.message}`);
      setIsLoading(false);
    }
  };

  const formatTempo = (segundos: number) => {
    const m = Math.floor(segundos / 60).toString().padStart(2, '0');
    const s = (segundos % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const todosVinculos = [
    { id: "CIDADAO"        as TipoUsuario, label: "Cidadão",        desc: "Público geral sem vínculo em orgão da Prefeitura de Caruaru, acesso a cursos abertos" },
    { id: "SERVIDOR_ATIVO" as TipoUsuario, label: "Servidor Ativo", desc: "Servidor municipal de Caruaru com matrícula ativa" },
    { id: "TERCEIRIZADO"   as TipoUsuario, label: "Terceirizado",   desc: "Colaborador via empresa ou contrato em órgão da Prefeitura de Caruaru" },
    { id: "ESTAGIARIO"     as TipoUsuario, label: "Estagiário",     desc: "Estágio vinculado a órgão da Prefeitura de Caruaru" },
  ];

  const tiposVinculo = isMenor
    ? todosVinculos.filter(t => t.id === "CIDADAO" || t.id === "ESTAGIARIO")
    : todosVinculos;

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 py-12 relative overflow-hidden">
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute -top-1/3 -right-1/4 w-1/2 h-1/2 rounded-full bg-success/5 blur-[180px]" />
        <div className="absolute -bottom-1/3 -left-1/4 w-1/2 h-1/2 rounded-full bg-primary/10 blur-[180px]" />
      </div>

      <div className="clean-card w-full max-w-lg p-8">
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            {step > 1 && (
              <button
                onClick={handleBack}
                className="w-9 h-9 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200
                           flex items-center justify-center text-slate-500 hover:text-slate-700 transition-all active:scale-95"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <h1 className="text-xl font-bold text-slate-900 leading-tight">Criar Conta</h1>
              <p className="text-[12px] text-slate-500">Etapa {stepIndex + 1} de {totalSteps}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {step > 1 && (
              <button onClick={handleResetRegistration} title="Recomeçar do zero" className="w-10 h-10 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 transition-all">
                <RefreshCcw className="w-4 h-4" />
              </button>
            )}
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
        </header>

        <StepProgress current={stepIndex + 1} total={totalSteps} />

        <div className="relative">
          <AnimatePresence mode="wait">

            {/* ── STEP 1: IDENTIFICAÇÃO ── */}
            {step === 1 && (
              <motion.div key="s1" variants={SLIDE} initial="hidden" animate="visible" exit="exit" className="space-y-4">
                <FieldGroup label="CPF *">
                  <IconInput icon={User} type="text" inputMode="numeric" autoFocus placeholder="000.000.000-00" value={form.cpf} onChange={(e: any) => set("cpf", mascaraCPF(e.target.value))} errorMsg={cpfError} />
                </FieldGroup>
                
                <FieldGroup label="E-mail *">
                  <IconInput icon={Mail} type="email" placeholder="email@exemplo.com" value={form.email} onChange={(e: any) => set("email", e.target.value)} />
                </FieldGroup>

                <button onClick={() => handleRequestOTP(false)} disabled={!!cpfError || !form.email || isLoading} className="btn-primary w-full mt-2">
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Validar E-mail"}
                </button>

                <p className="text-center text-[13px] text-slate-500 pt-1">
                  Já possui conta? <Link href="/login" className="text-primary hover:text-primary-dark font-medium transition-colors">Faça login</Link>
                </p>
              </motion.div>
            )}

            {/* ── STEP 2: CÓDIGO OTP (Com Reenvio) ── */}
            {step === 2 && (
              <motion.div key="s2" variants={SLIDE} initial="hidden" animate="visible" exit="exit" className="space-y-4">
                <div className="text-center pb-2">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 text-primary mb-3">
                    <Mail className="w-7 h-7" />
                  </div>
                  <h2 className="text-[18px] font-bold text-slate-900">Verifique seu E-mail</h2>
                  <p className="text-[14px] text-slate-500 mt-2 leading-relaxed">
                    Nós enviamos um código para <br/><strong className="text-slate-800">{form.email}</strong>
                  </p>
                  <button onClick={() => setStep(1)} className="text-[12px] text-slate-500 hover:text-slate-800 underline underline-offset-2 mt-1">
                    E-mail incorreto? Alterar
                  </button>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl mb-4 text-center">
                  <p className="text-[13px] text-slate-600">
                    Abra seu e-mail (celular ou computador), veja o <strong>código de 6 números</strong> e digite abaixo:
                  </p>
                </div>

                <FieldGroup label="">
                  <IconInput 
                    icon={KeyRound} type="text" maxLength={6} placeholder="000000" 
                    autoFocus
                    className="text-center tracking-[1em] font-mono text-xl h-14" 
                    value={form.otp} onChange={(e: any) => set("otp", e.target.value.replace(/\D/g, ""))} 
                  />
                </FieldGroup>

                <button 
                  onClick={handleVerifyOTP} 
                  disabled={form.otp.length !== 6 || isLoading || otpAttempts >= 3} 
                  className="btn-primary w-full mt-2 h-12"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Confirmar Código"}
                </button>

                <div className="text-center mt-2">
                  <button
                    type="button"
                    onClick={() => handleRequestOTP(true)}
                    disabled={countdown > 0 || isLoading}
                    className="text-[13px] font-medium text-slate-500 hover:text-slate-800 disabled:opacity-50 disabled:hover:text-slate-500 transition-colors"
                  >
                    {countdown > 0 
                      ? `Reenviar código em ${formatTempo(countdown)}`
                      : "Não recebeu? Reenviar código"
                    }
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── STEP 3: DADOS PESSOAIS ── */}
            {step === 3 && (
              <motion.div key="s3" variants={SLIDE} initial="hidden" animate="visible" exit="exit" className="space-y-4">
                <FieldGroup label="Nome completo *">
                  <IconInput icon={UserRound} autoFocus placeholder="Nome como no documento" value={form.nome_completo} onChange={(e: any) => set("nome_completo", e.target.value)} />
                </FieldGroup>

                <div className="grid grid-cols-2 gap-3">
                  <FieldGroup label="Data de nascimento *">
                    <IconInput icon={Calendar} type="date" value={form.data_nascimento} onChange={(e: any) => set("data_nascimento", e.target.value)} />
                  </FieldGroup>
                  <FieldGroup label="Telefone *">
                    <IconInput icon={Phone} inputMode="numeric" placeholder="(00) 90000-0000" value={form.telefone} onChange={(e: any) => set("telefone", mascaraTelefone(e.target.value))} />
                  </FieldGroup>
                </div>

                {isMenor && (
                  <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-2 rounded-xl p-3 bg-amber-50 border border-amber-200">
                    <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-[12px] text-amber-800 leading-relaxed">
                      Como você possui menos de 18 anos, informaremos dados do responsável na próxima etapa.
                    </p>
                  </motion.div>
                )}

                <button onClick={handleNext} className="btn-primary w-full mt-2">Continuar</button>
              </motion.div>
            )}

            {/* ── STEP 3.5: RESPONSÁVEL LEGAL ── */}
            {step === 3.5 && (
              <motion.div key="s3_5" variants={SLIDE} initial="hidden" animate="visible" exit="exit" className="space-y-5">
                <div className="text-center pb-4">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-warning-light border border-warning/20 text-warning mb-3">
                    <UserRound className="w-7 h-7" />
                  </div>
                  <h2 className="text-[16px] font-semibold text-slate-900">Responsável Legal</h2>
                </div>

                <FieldGroup label="CPF do Responsável *">
                  <IconInput icon={User} inputMode="numeric" autoFocus placeholder="000.000.000-00" value={form.responsavel_cpf} onChange={(e: any) => set("responsavel_cpf", mascaraCPF(e.target.value))} errorMsg={cpfRespError} />
                </FieldGroup>

                <FieldGroup label="Nome completo do Responsável *">
                  <IconInput icon={UserRound} placeholder="Pai, mãe ou responsável legal" value={form.responsavel_nome} onChange={(e: any) => set("responsavel_nome", e.target.value)} />
                </FieldGroup>

                <button onClick={handleNext} disabled={!!cpfRespError || cpfRespLimpo.length !== 11 || !form.responsavel_nome} className="btn-primary w-full">Continuar</button>
              </motion.div>
            )}

            {/* ── STEP 4: VÍNCULO ── */}
            {step === 4 && (
              <motion.div key="s4" variants={SLIDE} initial="hidden" animate="visible" exit="exit" className="space-y-3">
                <div className="text-center pb-2">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 text-primary mb-3">
                    <Briefcase className="w-6 h-6" />
                  </div>
                  <h2 className="text-[16px] font-semibold text-slate-900">Qual seu vínculo?</h2>
                  <p className="text-[13px] text-slate-500 mt-1">Isso determina seus acessos no Portal.</p>
                </div>

                {tiposVinculo.map((tipo) => {
                  const isSelected = form.tipo_usuario === tipo.id;
                  return (
                    <button key={tipo.id} onClick={() => set("tipo_usuario", tipo.id)} className={cn("w-full p-4 rounded-2xl border text-left flex items-center justify-between transition-all duration-200 active:scale-[0.99]", isSelected ? "border-primary bg-primary/5 shadow-sm" : "border-slate-200 bg-white hover:bg-slate-50")}>
                      <div>
                        <span className={cn("block text-sm font-semibold mb-0.5", isSelected ? "text-slate-900" : "text-slate-700")}>{tipo.label}</span>
                        <span className="text-[12px] text-slate-500">{tipo.desc}</span>
                      </div>
                      <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ml-3", isSelected ? "border-primary bg-primary" : "border-slate-300")}>
                        {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                    </button>
                  );
                })}
                <button onClick={handleNext} className="btn-primary w-full !mt-5">Confirmar Vínculo</button>
              </motion.div>
            )}

            {/* ── STEP 5: DADOS FUNCIONAIS ── */}
            {step === 5 && (
              <motion.div key="s5" variants={SLIDE} initial="hidden" animate="visible" exit="exit" className="space-y-4">
                <div className="text-center pb-2">
                  <h2 className="text-[16px] font-semibold text-slate-900">Dados da Lotação</h2>
                  <p className="text-[13px] text-slate-500 mt-1">Informações sobre seu órgão ou empresa.</p>
                </div>
                {form.tipo_usuario === "SERVIDOR_ATIVO" && (
                  <FieldGroup label="Matrícula funcional *">
                    <IconInput autoFocus placeholder="N° da sua matrícula" value={form.matricula} onChange={(e: any) => set("matricula", e.target.value)} />
                  </FieldGroup>
                )}
                {(form.tipo_usuario === "TERCEIRIZADO" || form.tipo_usuario === "ESTAGIARIO") && (
                  <FieldGroup label={form.tipo_usuario === "TERCEIRIZADO" ? "Empresa contratada" : "Empresa / Órgão do estágio"}>
                    <IconInput autoFocus placeholder={form.tipo_usuario === "TERCEIRIZADO" ? "Nome da empresa" : "Empresa ou órgão vinculante"} value={form.empresa} onChange={(e: any) => set("empresa", e.target.value)} />
                  </FieldGroup>
                )}
                <FieldGroup label="Secretaria / Setor">
                  <IconInput placeholder="Ex: Sec. de Educação, Saúde..." value={form.secretaria} onChange={(e: any) => set("secretaria", e.target.value)} />
                </FieldGroup>
                <FieldGroup label="CPF da Chefia Imediata">
                  <IconInput icon={User} type="text" inputMode="numeric" placeholder="000.000.000-00" value={form.cpf_chefe} onChange={(e: any) => set("cpf_chefe", mascaraCPF(e.target.value))} />
                  <p className="text-[12px] text-slate-500 mt-1">Por questões de privacidade (LGPD), o sistema não exibirá o nome da chefia. O vínculo será feito de forma segura.</p>
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                    <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wide mb-0.5">Termo de Responsabilidade</p>
                    <p className="text-[11px] text-amber-700 leading-relaxed text-left">
                      Ao informar o CPF, você assume total responsabilidade pela exatidão do dado de sua chefia imediata. 
                      O uso de dados falsos ou incorretos resultará em responsabilização administrativa.
                      O credencial gerado é intransferível.
                    </p>
                  </motion.div>
                </FieldGroup>
                <button onClick={() => {
                  const cpfChefeLimpo = form.cpf_chefe.replace(/\D/g, "");
                  if (cpfChefeLimpo && (cpfChefeLimpo.length !== 11 || !validarCPF(cpfChefeLimpo))) {
                    return toast.error("CPF da chefia inválido.");
                  }
                  handleNext();
                }} className="btn-primary w-full mt-2">Avançar para Senha</button>
              </motion.div>
            )}

            {/* ── STEP 6: SENHA ── */}
            {step === 6 && (
              <motion.form key="s6" variants={SLIDE} initial="hidden" animate="visible" exit="exit" onSubmit={handleSubmit} className="space-y-4">
                <div className="text-center pb-2">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-success/10 border border-success/20 text-success mb-3">
                    <Lock className="w-6 h-6" />
                  </div>
                  <h2 className="text-[16px] font-semibold text-slate-900">Definir Senha</h2>
                  <p className="text-[13px] text-slate-500 mt-1">Sua conta já está validada. Finalize criando a senha.</p>
                </div>
                <FieldGroup label="Senha (mínimo 6 caracteres)">
                  <IconInput icon={Lock} type="password" autoFocus placeholder="••••••••" value={form.password} onChange={(e: any) => set("password", e.target.value)} />
                </FieldGroup>
                <FieldGroup label="Confirme a senha">
                  <IconInput icon={Lock} type="password" placeholder="••••••••" value={form.passwordConfirm} onChange={(e: any) => set("passwordConfirm", e.target.value)} errorMsg={form.passwordConfirm && form.password !== form.passwordConfirm ? "As senhas não coincidem." : undefined} />
                </FieldGroup>
                <button type="submit" disabled={isLoading || form.password.length < 6 || form.password !== form.passwordConfirm} className="btn-success w-full relative overflow-hidden group mt-2">
                  <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent group-hover:animate-shimmer" />
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (
                    <span className="flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-5 h-5" /> Concluir Cadastro
                    </span>
                  )}
                </button>
              </motion.form>
            )}

          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}