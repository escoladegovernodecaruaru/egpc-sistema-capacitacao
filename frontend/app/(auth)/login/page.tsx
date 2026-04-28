"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Lock, ArrowRight, Loader2, ShieldCheck, Eye, EyeOff, KeyRound, Mail, CheckCircle2 } from "lucide-react";
import { fetchApi, type ApiError } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { mascaraCPF } from "@/lib/validations";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Step = 1 | 2 | 3 | 4;

export default function LoginPage() {
  const router = useRouter();

  const [step, setStep]             = useState<Step>(1);
  const [cpf, setCpf]               = useState("");
  const [emailReal, setEmailReal]   = useState(""); // e-mail obtido do Django
  const [password, setPassword]     = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading]   = useState(false);
  const [recoveryOtp, setRecoveryOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [otpAttempts, setOtpAttempts] = useState(0);

  const cpfLimpo = cpf.replace(/\D/g, "");

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cpfLimpo.length !== 11) {
      toast.error("Informe um CPF com 11 dígitos.");
      return;
    }
    if (!password) {
      toast.error("Informe a senha.");
      return;
    }

    setIsLoading(true);

    try {
      let resolvedEmail = emailReal;
      // Se não buscamos ainda, busca o e-mail real no Django
      if (!resolvedEmail) {
        const data = await fetchApi<{ email: string; email_real: string }>("/users/auth/lookup-email/", {
          method:      "POST",
          requireAuth: false,
          body:        JSON.stringify({ cpf: cpfLimpo }),
        });
        // email_real é usado para autenticação; email é a versão mascarada para exibição
        resolvedEmail = data.email_real;
        setEmailReal(resolvedEmail);
      }

      // Faz login no Supabase
      const { error } = await supabase.auth.signInWithPassword({
        email:    resolvedEmail,
        password: password,
      });

      if (error) {
        if (error.message.toLowerCase().includes("invalid")) {
          toast.error("Credenciais incorretas.", { description: "Verifique seu CPF e senha." });
        } else {
          toast.error(`Erro no login: ${error.message}`);
        }
        return;
      }

      toast.success("Bem-vindo(a) ao Portal EGPC!");
      router.push("/dashboard");

    } catch (err: unknown) {
      const apiErr = err as ApiError;
      if (apiErr.status === 404) {
        toast.error("CPF não encontrado.", {
          description: "Verifique o número digitado ou realize seu cadastro.",
          action: { label: "Cadastrar", onClick: () => router.push("/registro") },
          duration: 7000,
        });
      } else {
        toast.error(apiErr.message || "Falha ao verificar o CPF.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ─── FLUXO DE RECUPERAÇÃO DE SENHA ─────────────────────────────────────────
  const handleRequestPasswordReset = async () => {
    if (cpfLimpo.length !== 11) return toast.error("Informe seu CPF primeiro para recuperar a senha.");
    setIsResetting(true);
    
    try {
      let resolvedEmail = emailReal;
      if (!resolvedEmail) {
        const data = await fetchApi<{ email: string; email_real: string }>("/users/auth/lookup-email/", { method: "POST", requireAuth: false, body: JSON.stringify({ cpf: cpfLimpo }) });
        // Guarda o e-mail real para uso no Supabase; o mascarado é apenas para feedback na UI
        resolvedEmail = data.email_real;
        setEmailReal(resolvedEmail);
      }

      const { error } = await supabase.auth.resetPasswordForEmail(resolvedEmail, {
        redirectTo: `${window.location.origin}/login`,
      });
      
      if (error) {
        toast.error(`Erro ao solicitar código: ${error.message}`);
      } else {
        // Mostra o e-mail mascarado ao usuário só para feedback
        const [nome, dominio] = resolvedEmail.split("@");
        const emailMascarado = `${nome.substring(0, 2)}${"*".repeat(Math.max(nome.length - 2, 3))}@${dominio}`;
        toast.success("Código enviado!", { description: `Verifique o e-mail ${emailMascarado}` });
        setStep(3);
      }
    } catch (err) {
      toast.error("Erro ao verificar CPF.");
    } finally {
      setIsResetting(false);
    }
  };

  const handleVerifyRecoveryOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (recoveryOtp.length !== 6) return;
    
    setIsLoading(true);
    // Verifica se o código digitado bate com o enviado pro e-mail
    const { error } = await supabase.auth.verifyOtp({ email: emailReal, token: recoveryOtp, type: 'recovery' });
    setIsLoading(false);

    if (error) {
      setOtpAttempts(a => a + 1);
      toast.error(otpAttempts >= 2 ? "Código expirado ou inválido. Volte e solicite outro." : "Código incorreto. Tente novamente.");
    } else {
      toast.success("Identidade confirmada!", { description: "Crie sua nova senha agora." });
      setStep(4); // Vai para a tela de nova senha
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) return toast.error("A senha deve ter pelo menos 6 caracteres.");
    if (newPassword !== newPasswordConfirm) return toast.error("As senhas não coincidem.");

    setIsLoading(true);
    // Como o verifyOtp (acima) criou uma sessão temporária, agora podemos atualizar a senha
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setIsLoading(false);

    if (error) {
      toast.error(`Erro ao atualizar senha: ${error.message}`);
    } else {
      toast.success("Senha atualizada com sucesso!", { description: "Você já pode acessar o portal." });
      setPassword(newPassword); // Preenche a senha no form para facilitar o login imediato
      setStep(1); // Volta para a tela de login
      setRecoveryOtp("");
      setNewPassword("");
      setNewPasswordConfirm("");
    }
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

        {/* Barra de progresso das etapas — só exibida no login normal (steps 1–2) */}
        {(step === 1 || step === 2) && (
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
        )}

        <AnimatePresence mode="wait">

          {/* ─── STEP 1: CPF E SENHA ─────────────────────────────────────────────── */}
          {step === 1 && (
            <motion.form
              key="login"
              variants={slideIn} initial="hidden" animate="visible" exit="exit"
              onSubmit={handleLoginSubmit}
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
                    autoComplete="username"
                    autoFocus
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={(e) => setCpf(mascaraCPF(e.target.value))}
                    className="input-light pl-11"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label htmlFor="password" className="form-label !mb-0">Senha de acesso</label>
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete="current-password"
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
              
              <div className="flex justify-end -mt-2 mb-2">
                <button
                  type="button"
                  onClick={handleRequestPasswordReset}
                  disabled={isResetting || isLoading}
                  className="text-[12px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  {isResetting ? "Enviando código..." : "Esqueci minha senha"}
                </button>
              </div>

              <button
                type="submit"
                disabled={cpfLimpo.length !== 11 || !password || isLoading}
                className="btn-primary group w-full"
              >
                {isLoading
                  ? <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  : (
                    <span className="flex items-center justify-center gap-2">
                      Entrar no Portal
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



          {/* ─── STEP 3: DIGITAR CÓDIGO OTP ─────────────────────────────────── */}
          {step === 3 && (
            <motion.form key="otp" variants={slideIn} initial="hidden" animate="visible" exit="exit" onSubmit={handleVerifyRecoveryOtp} className="space-y-5">
              <div className="text-center pb-2">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 text-primary mb-3">
                  <Mail className="w-7 h-7" />
                </div>
                <h2 className="text-[18px] font-bold text-slate-900">Verifique seu E-mail</h2>
                <p className="text-[13px] text-slate-500 mt-2">Digite o código de 6 números enviado para você.</p>
              </div>

              <div>
                <div className="relative">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="000000"
                    autoFocus
                    value={recoveryOtp}
                    onChange={(e) => setRecoveryOtp(e.target.value.replace(/\D/g, ""))}
                    className="input-light pl-11 text-center tracking-[1em] font-mono text-xl h-14"
                  />
                </div>
              </div>

              <button type="submit" disabled={recoveryOtp.length !== 6 || isLoading} className="btn-primary w-full mt-2 h-12">
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Validar Código"}
              </button>

              <p className="text-center text-[12px] text-slate-500 pt-2">
                Lembrou a senha? <button type="button" onClick={() => setStep(1)} className="text-primary font-bold hover:underline">Voltar ao Login</button>
              </p>
            </motion.form>
          )}

          {/* ─── STEP 4: NOVA SENHA ───────────────────────────────────────── */}
          {step === 4 && (
            <motion.form key="newpwd" variants={slideIn} initial="hidden" animate="visible" exit="exit" onSubmit={handleUpdatePassword} className="space-y-5">
              <div className="text-center pb-2">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-50 text-emerald-500 mb-3">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h2 className="text-[18px] font-bold text-slate-900">Criar Nova Senha</h2>
              </div>

              <div>
                <label className="form-label">Nova Senha</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input type="password" placeholder="Mínimo 6 caracteres" autoFocus value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="input-light pl-11" />
                </div>
              </div>

              <div>
                <label className="form-label">Confirmar Senha</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input type="password" placeholder="Repita a senha" value={newPasswordConfirm} onChange={(e) => setNewPasswordConfirm(e.target.value)} className={cn("input-light pl-11", newPasswordConfirm && newPassword !== newPasswordConfirm ? "border-red-400" : "")} />
                </div>
              </div>

              <button type="submit" disabled={!newPassword || newPassword !== newPasswordConfirm || isLoading} className="btn-success w-full mt-2 h-12">
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Salvar Nova Senha"}
              </button>
            </motion.form>
          )}

        </AnimatePresence>
      </div>
    </main>
  );
}
