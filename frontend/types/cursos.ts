/**
 * types/cursos.ts
 * ──────────────
 * Tipos que espelham os serializers do backend (cursos/serializers.py).
 */

export type StatusTurma =
  | 'PREVISTA'
  | 'EM_ANDAMENTO'
  | 'CONCLUIDA'
  | 'FINALIZADA'
  | 'ADIADA'
  | 'CANCELADA'
  | 'SEM_TURMAS';

export interface Turma {
  id: number;
  letra: string;
  codigo_turma: string;
  instrutor_nome: string | null;
  local: string;
  vagas: number;
  carga_horaria: number;
  data_inicio: string; // ISO 'YYYY-MM-DD'
  data_fim: string;
  status_calculado: StatusTurma;
}

export interface Curso {
  id: number;
  codigo_oficial: string;
  titulo: string;
  ementa: string;
  tipo: 'CENTRALIZADO' | 'DESCENTRALIZADO';
  status_geral: StatusTurma;
  turmas: Turma[];
}
