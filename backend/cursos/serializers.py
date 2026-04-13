"""
cursos/serializers.py
─────────────────────
Serialização do Módulo de Cursos para a API pública.

  TurmaSerializer  — dados essenciais de uma turma (sem dados financeiros)
  CursoSerializer  — dados do curso com turmas aninhadas e status geral
"""

from rest_framework import serializers
from .models import Curso, Turma

class TurmaSerializer(serializers.ModelSerializer):
    instrutor_nome = serializers.CharField(source='instrutor.nome_completo', read_only=True)
    
    class Meta:
        model = Turma
        fields = [
            'id', 'codigo', 'modalidade', 'data_inicio', 'data_fim', 
            'hora_inicio', 'hora_fim', 'vagas_totais', 'vagas_disponiveis', 
            'instrutor_nome', 'status'
        ]

# 2. Atualize o Serializer do Curso para puxar as turmas ativas
class CursoSerializer(serializers.ModelSerializer):
    categoria_nome = serializers.CharField(source='categoria.nome', read_only=True)
    # Traz apenas as turmas que não estão canceladas ou finalizadas
    turmas = serializers.SerializerMethodField()

    class Meta:
        model = Curso
        fields = [
            'id', 'titulo', 'slug', 'descricao', 'carga_horaria', 
            'eixo_tematico', 'categoria', 'categoria_nome', 'status_geral', 'turmas'
        ]
        
    def get_turmas(self, obj):
        # Filtra turmas que ainda estão para começar ou em andamento e com vagas
        turmas_ativas = obj.turmas.exclude(status__in=['CONCLUIDA', 'CANCELADA', 'ADIADA'])
        return TurmaSerializer(turmas_ativas, many=True).data