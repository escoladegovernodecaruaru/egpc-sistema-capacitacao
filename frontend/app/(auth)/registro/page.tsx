"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, Mail, Phone, Calendar, Briefcase,
  Lock, CheckCircle2, ArrowLeft, Loader2,
  AlertTriangle, ShieldCheck, UserRound,
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

// Mapeamento dos steps numéricos para IDs semânticos
//  1  → dados básicos
//  1.5→ responsável legal (< 18 anos)
//  2  → tipo de vínculo
//  3  → dados funcionais / dinâmicos
//  4  → senha
type StepId = 1 | 1.5 | 2 | 3 | 4;

interface FormState {
  cpf:             string;
  nome_completo:   string;
  email:           string;
  telefone:        string;
  data_nascimento: string;
  // Menor de idade
  responsavel_nome: string;
  responsavel_cpf:  string;
  // Tipo de vínculo
  tipo_usuario: TipoUsuario;
  // Dados funcionais dinâmicos
  matricula:   string;   // Apenas SERVIDOR_ATIVO
  empresa:     string;   // TERCEIRIZADO e ESTAGIARIO
  secretaria:  string;
  email_chefe: string;
  // Senha
  password:        string;
  passwordConfirm: string;
}

const INITIAL_FORM: FormState = {
  cpf: "", nome_completo: "", email: "", telefone: "",
  data_nascimento: "",
  responsavel_nome: "", responsavel_cpf: "",
  tipo_usuario: "CIDADAO",
  matricula: "", empresa: "", secretaria: "", email_chefe: "",
  password: "", passwordConfirm: "",
};

// ─────────────────────────────────────────────────────────────────────────────
// Componentes internos reutilizáveis
// ─────────────────────────────────────────────────────────────────────────────

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="form-label">{label}</label>
      <div className="relative input-group">{children}</div>
    </div>
  );
}

function IconInput({
  icon: Icon,
  errorMsg,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  icon?: React.ElementType;
  errorMsg?: string;
}) {
  return (
    <>
      {Icon && <Icon className="input-icon" />}
      <input
        {...props}
        className={cn(
          "input-dark",
          Icon ? "input-dark-icon" : "",
          errorMsg ? "input-dark-error" : "",
          props.className
        )}
      />
      <AnimatePresence>
        {errorMsg && (
          <motion.p
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-1.5 text-[12px] text-red-400 mt-1 ml-1 font-medium"
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
        <div
          key={i}
          className={cn(
            "h-[3px] flex-1 rounded-full transition-all duration-500",
            i + 1 <= current ? "bg-primary" : "bg-white/[0.06]"
          )}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────────────────────────

const SLIDE = {
  hidden:  { opacity: 0, x: 24, scale: 0.97 },
  visible: { opacity: 1, x: 0, scale: 1, transition: { type: "spring" as const, stiffness: 320, damping: 30 } },
  exit:    { opacity: 0, x: -24, scale: 0.97, transition: { duration: 0.15 } },
};

export default function RegistroPage() {
  const router = useRouter();
  const [step, setStep] = useState<StepId>(1);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [cpfError, setCpfError] = useState("");
  const [cpfRespError, setCpfRespError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const cpfLimpo     = form.cpf.replace(/\D/g, "");
  const cpfRespLimpo = form.responsavel_cpf.replace(/\D/g, "");
  const idade        = form.data_nascimento ? calcularIdade(form.data_nascimento) : null;
  const isMenor      = idade !== null && idade < 18;

  // Mapa de step numérico → rótulo de exibição
  const stepsVisiveis: StepId[] = isMenor
    ? [1, 1.5, 2, 3, 4]
    : [1, 2, 3, 4];

  const stepIndex = stepsVisiveis.indexOf(step);
  const totalSteps = stepsVisiveis.length;

  // ── Validação assíncrona do CPF principal ─────────────────────────────────
  const verificarCPFNoBanco = useCallback(async (cpf: string) => {
    try {
      await fetchApi("/users/auth/pre-validate/", {
        method: "POST",
        requireAuth: false,
        body: JSON.stringify({ cpf }),
      });
      // 200 = disponível
      setCpfError("");
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      if (apiErr.status === 400 && apiErr.errors?.cpf) {
        setCpfError("Este CPF já está cadastrado no sistema.");
      } else {
        setCpfError("");
      }
    }
  }, []);

  useEffect(() => {
    if (cpfLimpo.length === 11) {
      if (!validarCPF(cpfLimpo)) {
        setCpfError("CPF matematicamente inválido (dígito verificador incorreto).");
        return;
      }
      verificarCPFNoBanco(cpfLimpo);
    } else {
      setCpfError("");
    }
  }, [cpfLimpo, verificarCPFNoBanco]);

  // Validação CPF do responsável
  useEffect(() => {
    if (cpfRespLimpo.length === 11) {
      setCpfRespError(
        validarCPF(cpfRespLimpo) ? "" : "CPF do responsável é matematicamente inválido."
      );
    } else {
      setCpfRespError("");
    }
  }, [cpfRespLimpo]);

  // ── Manipulação do formulário ─────────────────────────────────────────────
  const set = (field: keyof FormState, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleNext = () => {
    if (step === 1) {
      if (!validarCPF(cpfLimpo) || cpfError) {
        toast.error("Corrija o CPF antes de continuar.");
        return;
      }
      if (!form.nome_completo || !form.email || !form.telefone || !form.data_nascimento) {
        toast.error("Preencha todos os campos obrigatórios.");
        return;
      }
      setStep(isMenor ? 1.5 : 2);
      return;
    }
    if (step === 1.5) {
      if (!form.responsavel_nome || cpfRespLimpo.length !== 11 || cpfRespError) {
        toast.error("Informe corretamente os dados do responsável legal.");
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      setStep(form.tipo_usuario === "CIDADAO" ? 4 : 3);
      return;
    }
    if (step === 3) {
      if (form.tipo_usuario === "SERVIDOR_ATIVO" && !form.matricula.trim()) {
        toast.error("A matrícula é obrigatória para Servidores Ativos.");
        return;
      }
      setStep(4);
      return;
    }
  };

  const handleBack = () => {
    if (step === 4)   { setStep(form.tipo_usuario === "CIDADAO" ? 2 : 3); return; }
    if (step === 3)   { setStep(2);          return; }
    if (step === 2)   { setStep(isMenor ? 1.5 : 1); return; }
    if (step === 1.5) { setStep(1);          return; }
  };

  // ── Finalização: Supabase → Django (com rollback lógico) ─────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.passwordConfirm) {
      toast.error("As senhas não coincidem.");
      return;
    }
    if (form.password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setIsLoading(true);

    // 1️⃣ Pré-validação no Django antes de criar qualquer conta
    try {
      await fetchApi("/users/auth/pre-validate/", {
        method: "POST",
        requireAuth: false,
        body: JSON.stringify({ cpf: cpfLimpo, email: form.email }),
      });
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      const erros  = apiErr.errors || {};
      const msg    = erros.cpf?.[0] || erros.email?.[0] || apiErr.message;
      toast.error(`Dados já em uso: ${msg}`);
      setIsLoading(false);
      return;
    }

    // 2️⃣ SignUp no Supabase
    console.log("[REGISTRO] Iniciando signUp no Supabase:", form.email);
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email:    form.email,
      password: form.password,
    });

    if (authError) {
      console.error("[REGISTRO] Erro no Supabase signUp:", authError);
      toast.error(`Falha no provedor de autenticação: ${authError.message}`);
      setIsLoading(false);
      return;
    }

    console.log("[REGISTRO] Resposta Supabase — user:", authData.user?.id, "| session:", authData.session ? "presente" : "NULA (e-mail de confirmação ativo)");

    // ⚠️ DIAGNÓSTICO: session = null significa que o Supabase exige confirmação de e-mail.
    // Nesse caso, o access_token ainda está disponível no objeto user.
    // Tentamos extraí-lo diretamente da sessão OU do campo identities como fallback.
    const accessToken = authData.session?.access_token;

    if (!accessToken) {
      // E-mail de confirmação está ATIVADO no painel Supabase.
      // O perfil Django não pode ser criado sem o JWT válido.
      // Orientação: no painel Supabase → Authentication → Settings → desative "Enable email confirmations"
      console.warn("[REGISTRO] access_token indisponível. E-mail de confirmação provavelmente ativo.");
      toast.warning(
        "Verifique sua caixa de e-mail: enviamos um link de confirmação. Após confirmar, faça login normalmente.",
        { duration: 8000 }
      );
      toast.info(
        "Se for ambiente de desenvolvimento, desative 'Email Confirmations' no painel Supabase → Auth → Settings.",
        { duration: 10000 }
      );
      setIsLoading(false);
      return;
    }

    // 3️⃣ Criar o perfil no Django usando o token recém-obtido
    const dados_servidor: Record<string, unknown> = {
      secretaria:    form.secretaria || null,
      email_chefe:   form.email_chefe || null,
      dt_nascimento: form.data_nascimento,
    };
    if (form.tipo_usuario === "SERVIDOR_ATIVO") {
      dados_servidor["matricula"] = form.matricula;
    } else if (form.tipo_usuario !== "CIDADAO") {
      dados_servidor["empresa"] = form.empresa;
    }
    if (isMenor) {
      dados_servidor["responsavel"] = { nome: form.responsavel_nome, cpf: cpfRespLimpo };
    }

    const corpoRegistro = {
      cpf:           cpfLimpo,
      nome_completo: form.nome_completo,
      email:         form.email,
      telefone:      form.telefone.replace(/\D/g, ""),
      tipo_usuario:  form.tipo_usuario,
      dados_servidor,
    };

    console.log("[REGISTRO] Enviando para o Django:", corpoRegistro);

    try {
      // Passamos o accessToken recém-obtido diretamente no header,
      // evitando depender do getSession() (que pode ainda não ter propagado).
      const resultado = await fetchApi("/users/auth/register/", {
        method: "POST",
        requireAuth: false, // Gerenciamos o header manualmente abaixo
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(corpoRegistro),
      });

      console.log("[REGISTRO] Django respondeu com sucesso:", resultado);
      toast.success("Cadastro realizado com sucesso! Bem-vindo(a) ao EGPC.");
      router.push("/dashboard");

    } catch (err: unknown) {
      const apiErr = err as ApiError;
      console.error("[REGISTRO] Django rejeito o perfil:", apiErr);

      // 🔄 ROLLBACK LÓGICO: tenta remover a conta do Supabase
      console.warn("[REGISTRO] Iniciando rollback do Supabase...");
      await supabase.auth.signOut();

      toast.error(
        `Perfil não criado: ${apiErr.message}`,
        { description: `Status HTTP ${apiErr.status}. Verifique o console para detalhes.`, duration: 8000 }
      );
      setIsLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────────────────────────────────

  const tiposVinculo = [
    { id: "CIDADAO"      as TipoUsuario, label: "Cidadão",        desc: "Público geral, acesso a cursos abertos" },
    { id: "SERVIDOR_ATIVO" as TipoUsuario, label: "Servidor Ativo", desc: "Servidor municipal ou estadual ativo" },
    { id: "TERCEIRIZADO" as TipoUsuario, label: "Terceirizado",    desc: "Colaborador via empresa ou contrato" },
    { id: "ESTAGIARIO"   as TipoUsuario, label: "Estagiário",      desc: "Estágio vinculado a órgão público" },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  // JSX
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen flex items-center justify-center p-4 py-12 relative overflow-hidden">

      {/* Fundo com luzes atmosféricas */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute -top-1/3 -right-1/4 w-1/2 h-1/2 rounded-full bg-success/10  blur-[180px]" />
        <div className="absolute -bottom-1/3 -left-1/4 w-1/2 h-1/2 rounded-full bg-primary/20 blur-[180px]" />
      </div>

      <div className="glass-card w-full max-w-lg p-8">

        {/* Cabeçalho */}
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            {step > 1 && (
              <button
                onClick={handleBack}
                className="w-9 h-9 rounded-xl bg-white/[0.05] hover:bg-white/10 border border-white/[0.06]
                           flex items-center justify-center text-zinc-400 hover:text-zinc-100
                           transition-all active:scale-95"
                title="Voltar"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <h1 className="text-xl font-bold text-zinc-100 leading-tight">Criar Conta</h1>
              <p className="text-[12px] text-zinc-500">
                Etapa {stepIndex + 1} de {totalSteps}
              </p>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary-light
                          flex items-center justify-center border border-primary/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </header>

        <StepProgress current={stepIndex + 1} total={totalSteps} />

        {/* Conteúdo animado dos slides */}
        <div className="relative">
          <AnimatePresence mode="wait">

            {/* ═══════════════════════════════════════════════════════════════
                STEP 1 – DADOS BÁSICOS
            ═══════════════════════════════════════════════════════════════ */}
            {step === 1 && (
              <motion.div key="s1" variants={SLIDE} initial="hidden" animate="visible" exit="exit" className="space-y-4">
                <FieldGroup label="CPF *">
                  <IconInput
                    icon={User}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    autoFocus
                    placeholder="000.000.000-00"
                    value={form.cpf}
                    onChange={(e) => set("cpf", mascaraCPF(e.target.value))}
                    errorMsg={cpfError}
                  />
                </FieldGroup>

                <FieldGroup label="Nome completo *">
                  <IconInput
                    icon={UserRound}
                    placeholder="Seu nome como no documento"
                    value={form.nome_completo}
                    onChange={(e) => set("nome_completo", e.target.value)}
                  />
                </FieldGroup>

                <div className="grid grid-cols-2 gap-3">
                  <FieldGroup label="Data de nascimento *">
                    <IconInput
                      icon={Calendar}
                      type="date"
                      value={form.data_nascimento}
                      onChange={(e) => set("data_nascimento", e.target.value)}
                    />
                  </FieldGroup>
                  <FieldGroup label="Telefone *">
                    <IconInput
                      icon={Phone}
                      inputMode="numeric"
                      placeholder="(00) 90000-0000"
                      value={form.telefone}
                      onChange={(e) => set("telefone", mascaraTelefone(e.target.value))}
                    />
                  </FieldGroup>
                </div>

                {/* Aviso automático para menores */}
                {isMenor && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-2 rounded-xl p-3 bg-amber-500/10 border border-amber-500/20"
                  >
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-[12px] text-amber-300 leading-relaxed">
                      Como você possui menos de 18 anos, será necessário informar dados do responsável legal na próxima etapa.
                    </p>
                  </motion.div>
                )}

                <FieldGroup label="E-mail *">
                  <IconInput
                    icon={Mail}
                    type="email"
                    placeholder="email@exemplo.com"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                  />
                </FieldGroup>

                <button onClick={handleNext} disabled={!!cpfError} className="btn-primary mt-2">
                  Continuar
                </button>

                <p className="text-center text-[13px] text-zinc-500 pt-1">
                  Já possui conta?{" "}
                  <Link href="/login" className="text-secondary hover:text-secondary-light font-medium transition-colors">
                    Faça login
                  </Link>
                </p>
              </motion.div>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                STEP 1.5 – RESPONSÁVEL LEGAL (< 18 anos)
            ═══════════════════════════════════════════════════════════════ */}
            {step === 1.5 && (
              <motion.div key="s1_5" variants={SLIDE} initial="hidden" animate="visible" exit="exit" className="space-y-5">
                <div className="text-center pb-4">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl
                                  bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-3">
                    <UserRound className="w-7 h-7" />
                  </div>
                  <h2 className="text-[16px] font-semibold text-zinc-100">Responsável Legal</h2>
                  <p className="text-[13px] text-zinc-500 mt-1 max-w-xs mx-auto leading-relaxed">
                    Por ser menor de 18 anos, precisamos dos dados do seu responsável.
                  </p>
                </div>

                <FieldGroup label="CPF do Responsável *">
                  <IconInput
                    icon={User}
                    inputMode="numeric"
                    autoFocus
                    placeholder="000.000.000-00"
                    value={form.responsavel_cpf}
                    onChange={(e) => set("responsavel_cpf", mascaraCPF(e.target.value))}
                    errorMsg={cpfRespError}
                  />
                </FieldGroup>

                <FieldGroup label="Nome completo do Responsável *">
                  <IconInput
                    icon={UserRound}
                    placeholder="Pai, mãe ou responsável legal"
                    value={form.responsavel_nome}
                    onChange={(e) => set("responsavel_nome", e.target.value)}
                  />
                </FieldGroup>

                <button
                  onClick={handleNext}
                  disabled={!!cpfRespError || cpfRespLimpo.length !== 11 || !form.responsavel_nome}
                  className="btn-primary"
                >
                  Continuar
                </button>
              </motion.div>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                STEP 2 – TIPO DE VÍNCULO
            ═══════════════════════════════════════════════════════════════ */}
            {step === 2 && (
              <motion.div key="s2" variants={SLIDE} initial="hidden" animate="visible" exit="exit" className="space-y-3">
                <div className="text-center pb-2">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl
                                  bg-primary/20 border border-primary/25 text-primary-light mb-3">
                    <Briefcase className="w-6 h-6" />
                  </div>
                  <h2 className="text-[16px] font-semibold text-zinc-100">Qual seu vínculo?</h2>
                  <p className="text-[13px] text-zinc-500 mt-1">Isso determina seus acessos no Portal.</p>
                </div>

                {tiposVinculo.map((tipo) => {
                  const isSelected = form.tipo_usuario === tipo.id;
                  return (
                    <button
                      key={tipo.id}
                      onClick={() => set("tipo_usuario", tipo.id)}
                      className={cn(
                        "w-full p-4 rounded-2xl border text-left flex items-center justify-between",
                        "transition-all duration-200 active:scale-[0.99]",
                        isSelected
                          ? "border-primary/60 bg-primary/[0.12] shadow-[0_0_20px_rgba(0,64,54,0.18)]"
                          : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10"
                      )}
                    >
                      <div>
                        <span className={cn(
                          "block text-sm font-semibold mb-0.5",
                          isSelected ? "text-zinc-100" : "text-zinc-300"
                        )}>
                          {tipo.label}
                        </span>
                        <span className="text-[12px] text-zinc-500">{tipo.desc}</span>
                      </div>
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ml-3",
                        isSelected ? "border-primary bg-primary" : "border-zinc-700"
                      )}>
                        {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                    </button>
                  );
                })}

                <button onClick={handleNext} className="btn-primary !mt-5">
                  Confirmar Vínculo
                </button>
              </motion.div>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                STEP 3 – DADOS FUNCIONAIS (condicional por tipo)
            ═══════════════════════════════════════════════════════════════ */}
            {step === 3 && (
              <motion.div key="s3" variants={SLIDE} initial="hidden" animate="visible" exit="exit" className="space-y-4">
                <div className="text-center pb-2">
                  <h2 className="text-[16px] font-semibold text-zinc-100">Dados da Lotação</h2>
                  <p className="text-[13px] text-zinc-500 mt-1">Informações sobre seu órgão ou empresa.</p>
                </div>

                {/* Matrícula → APENAS Servidor Ativo */}
                {form.tipo_usuario === "SERVIDOR_ATIVO" && (
                  <FieldGroup label="Matrícula funcional *">
                    <IconInput
                      autoFocus
                      placeholder="N° da sua matrícula"
                      value={form.matricula}
                      onChange={(e) => set("matricula", e.target.value)}
                    />
                  </FieldGroup>
                )}

                {/* Empresa/Órgão → Terceirizado e Estagiário */}
                {(form.tipo_usuario === "TERCEIRIZADO" || form.tipo_usuario === "ESTAGIARIO") && (
                  <FieldGroup label={form.tipo_usuario === "TERCEIRIZADO" ? "Empresa contratada" : "Empresa / Órgão do estágio"}>
                    <IconInput
                      autoFocus
                      placeholder={form.tipo_usuario === "TERCEIRIZADO" ? "Nome da empresa" : "Empresa ou órgão vinculante"}
                      value={form.empresa}
                      onChange={(e) => set("empresa", e.target.value)}
                    />
                  </FieldGroup>
                )}

                <FieldGroup label="Secretaria / Setor">
                  <IconInput
                    placeholder="Ex: Sec. de Educação, Saúde..."
                    value={form.secretaria}
                    onChange={(e) => set("secretaria", e.target.value)}
                  />
                </FieldGroup>

                <FieldGroup label="E-mail da chefia imediata">
                  <IconInput
                    icon={Mail}
                    type="email"
                    placeholder="Utilizado em requerimentos de curso"
                    value={form.email_chefe}
                    onChange={(e) => set("email_chefe", e.target.value)}
                  />
                </FieldGroup>

                <button onClick={handleNext} className="btn-primary mt-2">
                  Avançar para Senha
                </button>
              </motion.div>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                STEP 4 – CRIAÇÃO DE SENHA
            ═══════════════════════════════════════════════════════════════ */}
            {step === 4 && (
              <motion.form
                key="s4"
                variants={SLIDE} initial="hidden" animate="visible" exit="exit"
                onSubmit={handleSubmit}
                className="space-y-4"
              >
                <div className="text-center pb-2">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl
                                  bg-success/10 border border-success/20 text-success-light mb-3">
                    <Lock className="w-6 h-6" />
                  </div>
                  <h2 className="text-[16px] font-semibold text-zinc-100">Definir Senha</h2>
                  <p className="text-[13px] text-zinc-500 mt-1">Última etapa para proteger sua conta.</p>
                </div>

                <FieldGroup label="Senha (mínimo 6 caracteres)">
                  <IconInput
                    icon={Lock}
                    type="password"
                    autoFocus
                    placeholder="••••••••"
                    value={form.password}
                    onChange={(e) => set("password", e.target.value)}
                  />
                </FieldGroup>

                <FieldGroup label="Confirme a senha">
                  <IconInput
                    icon={Lock}
                    type="password"
                    placeholder="••••••••"
                    value={form.passwordConfirm}
                    onChange={(e) => set("passwordConfirm", e.target.value)}
                    errorMsg={
                      form.passwordConfirm && form.password !== form.passwordConfirm
                        ? "As senhas não coincidem."
                        : undefined
                    }
                  />
                </FieldGroup>

                <button
                  type="submit"
                  disabled={
                    isLoading ||
                    form.password.length < 6 ||
                    form.password !== form.passwordConfirm
                  }
                  className="btn-success relative overflow-hidden group mt-2"
                >
                  {/* Shimmer no botão de conclusão */}
                  <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent group-hover:animate-shimmer" />
                  {isLoading
                    ? <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                    : (
                      <span className="flex items-center justify-center gap-2">
                        <CheckCircle2 className="w-5 h-5" />
                        Concluir Cadastro
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
