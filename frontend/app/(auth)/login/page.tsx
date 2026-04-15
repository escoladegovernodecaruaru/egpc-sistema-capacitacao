"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Lock, ArrowRight, Loader2, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { fetchApi, type ApiError } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { mascaraCPF } from "@/lib/validations";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Step = 1 | 2;

export default function LoginPage() {
  const router = useRouter();

  const [step, setStep]             = useState<Step>(1);
  const [cpf, setCpf]               = useState("");
  const [emailReal, setEmailReal]   = useState(""); // e-mail obtido do Django
  const [password, setPassword]     = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading]   = useState(false);

  const cpfLimpo = cpf.replace(/\D/g, "");

  // ─── PASSO 1: busca o e-mail real no Django pelo CPF ─────────────────────
  const handleCpfSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cpfLimpo.length !== 11) {
      toast.error("Informe um CPF com 11 dígitos.");
      return;
    }

    setIsLoading(true);

    try {
      // Endpoint dedicado: retorna o e-mail real vinculado ao CPF no Django
      const data = await fetchApi<{ email: string }>("/users/auth/lookup-email/", {
        method:      "POST",
        requireAuth: false,
        body:        JSON.stringify({ cpf: cpfLimpo }),
      });

      // Armazena o e-mail real para usar no signInWithPassword
      setEmailReal(data.email);
      setStep(2);

    } catch (err: unknown) {
      const apiErr = err as ApiError;

      if (apiErr.status === 404) {
        // CPF não cadastrado → direciona ao cadastro
        toast.error("CPF não encontrado.", {
          description: "Verifique o número digitado ou realize seu cadastro.",
          action: {
            label: "Cadastrar",
            onClick: () => router.push("/registro"),
          },
          duration: 7000,
        });
      } else {
        toast.error(apiErr.message || "Falha ao verificar o CPF.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ─── PASSO 2: login via Supabase com o e-mail real ───────────────────────
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !emailReal) return;

    setIsLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email:    emailReal,
      password: password,
    });

    setIsLoading(false);

    if (error) {
      // "Invalid login credentials" → senha incorreta
      if (error.message.toLowerCase().includes("invalid")) {
        toast.error("Senha incorreta.", {
          description: "Verifique sua senha e tente novamente.",
        });
      } else {
        toast.error(`Erro no login: ${error.message}`);
      }
      return;
    }

    toast.success("Bem-vindo(a) ao Portal EGPC!");
    router.push("/dashboard");
  };

  // ─── Animações ────────────────────────────────────────────────────────────
  const slideIn = {
    hidden:  { opacity: 0, x: 20 },
    visible: { opacity: 1, x: 0, transition: { type: "spring" as const, stiffness: 300, damping: 28 } },
    exit:    { opacity: 0, x: -20, transition: { duration: 0.18 } },
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">

      {/* Luzes atmosféricas de fundo */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 rounded-full bg-primary/20 blur-[160px]" />
        <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 rounded-full bg-secondary/10 blur-[160px]" />
      </div>

      <div className="clean-card w-full max-w-md p-8">

        {/* Cabeçalho da marca */}
        <header className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4
                          bg-primary/10 border border-primary/20 text-primary
                          shadow-sm">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-[22px] font-bold text-slate-900 tracking-tight">Portal EGPC</h1>
          <p className="text-[13px] text-slate-500 mt-1">Escola de Governo de Caruaru</p>
        </header>

        {/* Barra de progresso das etapas */}
        <div className="flex items-center gap-2 mb-8">
          {([1, 2] as Step[]).map((s) => (
            <div
              key={s}
              className={cn(
                "h-[3px] flex-1 rounded-full transition-all duration-500",
                step >= s ? "bg-primary" : "bg-slate-200"
              )}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">

          {/* ─── STEP 1: CPF ─────────────────────────────────────────────── */}
          {step === 1 && (
            <motion.form
              key="cpf"
              variants={slideIn} initial="hidden" animate="visible" exit="exit"
              onSubmit={handleCpfSubmit}
              className="space-y-5"
            >
              <div>
                <label htmlFor="cpf" className="form-label">CPF</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    id="cpf"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    autoFocus
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={(e) => setCpf(mascaraCPF(e.target.value))}
                    className="input-light pl-11"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={cpfLimpo.length !== 11 || isLoading}
                className="btn-primary group w-full"
              >
                {isLoading
                  ? <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  : (
                    <span className="flex items-center justify-center gap-2">
                      Continuar
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </span>
                  )}
              </button>

              <p className="text-center text-[13px] text-slate-500 pt-2">
                Não tem conta?{" "}
                <Link href="/registro" className="text-primary font-medium hover:text-primary-dark transition-colors">
                  Cadastre-se aqui
                </Link>
              </p>
            </motion.form>
          )}

          {/* ─── STEP 2: SENHA ───────────────────────────────────────────── */}
          {step === 2 && (
            <motion.form
              key="senha"
              variants={slideIn} initial="hidden" animate="visible" exit="exit"
              onSubmit={handleLoginSubmit}
              className="space-y-5"
            >
              {/* Info: mostra qual CPF foi encontrado (sem expor o e-mail) */}
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-primary/5 border border-primary/20">
                <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0" />
                <p className="text-[13px] text-slate-700">
                  CPF identificado. Insira sua senha para continuar.
                </p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label htmlFor="password" className="form-label !mb-0">Senha de acesso</label>
                  <button
                    type="button"
                    onClick={() => { setStep(1); setPassword(""); setEmailReal(""); }}
                    className="text-[12px] text-slate-500 hover:text-slate-800 transition-colors"
                  >
                    Alterar CPF
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    autoFocus
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-light pl-11 pr-11"
                  />
                  {/* Toggle visibilidade da senha */}
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600 transition-colors"
                    tabIndex={-1}
                    title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword
                      ? <EyeOff className="w-4 h-4" />
                      : <Eye    className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={!password || isLoading}
                className="btn-primary w-full"
              >
                {isLoading
                  ? <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  : "Acessar o Portal"}
              </button>

              <p className="text-center text-[13px] text-slate-500 pt-2">
                Não tem conta?{" "}
                <Link href="/registro" className="text-primary font-medium hover:text-primary-dark transition-colors">
                  Cadastre-se aqui
                </Link>
              </p>
            </motion.form>
          )}

        </AnimatePresence>
      </div>
    </main>
  );
}
