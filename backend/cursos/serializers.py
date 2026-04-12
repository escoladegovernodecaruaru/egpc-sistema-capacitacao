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
    """Serializa os dados públicos de uma Turma."""
    codigo_turma      = serializers.ReadOnlyField()
    status_calculado  = serializers.ReadOnlyField()
    instrutor_nome    = serializers.SerializerMethodField()

    class Meta:
        model = Turma
        fields = [
            'id',
            'letra',
            'codigo_turma',
            'instrutor_nome',
            'local',
            'vagas',
            'carga_horaria',
            'data_inicio',
            'data_fim',
            'status_calculado',
        ]

    def get_instrutor_nome(self, obj):
        if obj.instrutor:
            return obj.instrutor.nome_social or obj.instrutor.nome_completo
        return None


class CursoSerializer(serializers.ModelSerializer):
    """Serializa os dados públicos de um Curso com suas turmas."""
    turmas       = TurmaSerializer(many=True, read_only=True)
    status_geral = serializers.ReadOnlyField()

    class Meta:
        model = Curso
        fields = [
            'id',
            'codigo_oficial',
            'titulo',
            'ementa',
            'tipo',
            'status_geral',
            'turmas',
        ]
