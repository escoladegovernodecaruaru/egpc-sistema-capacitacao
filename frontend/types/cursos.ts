// frontend/types/cursos.ts

export type StatusTurma = "PREVISTA" | "EM_ANDAMENTO" | "CONCLUIDA" | "ADIADA" | "CANCELADA" | "SEM_TURMAS";
export type ModalidadeTurma = "PRESENCIAL" | "EAD" | "HIBRIDO";

export interface Turma {
  id: number;
  codigo: string;
  modalidade: ModalidadeTurma;
  data_inicio: string | null;
  data_fim: string | null;
  hora_inicio: string | null;
  hora_fim: string | null;
  vagas_totais: number;
  vagas_disponiveis: number;
  instrutor_nome: string | null;
  status: StatusTurma;
}

export interface Curso {
  id: number;
  titulo: string;
  slug: string;
  descricao: string;
  carga_horaria: number;
  eixo_tematico: string;
  categoria: number;
  categoria_nome?: string;
  status_geral: StatusTurma;
  turmas?: Turma[];
}