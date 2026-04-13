from rest_framework import serializers
from .models import Curso, Turma, EventoTurma

class EventoTurmaSerializer(serializers.ModelSerializer):
    class Meta:
        model = EventoTurma
        fields = ['id', 'data', 'hora_inicio', 'hora_fim', 'espaco', 'espaco_externo_nome']

class TurmaSerializer(serializers.ModelSerializer):
    instrutor_nome = serializers.CharField(source='instrutor.nome_completo', read_only=True)
    codigo = serializers.CharField(source='codigo_turma', read_only=True)
    status = serializers.CharField(source='status_calculado', read_only=True)
    eventos = EventoTurmaSerializer(many=True, required=False)

    class Meta:
        model = Turma
        fields = [
            'id', 'curso', 'codigo', 'letra', 'modalidade', 'data_inicio', 'data_fim', 
            'carga_horaria', 'vagas', 'custo', 'instrutor', 'instrutor_nome', 'status', 'eventos'
        ]

    def create(self, validated_data):
        eventos_data = validated_data.pop('eventos', [])
        turma = Turma.objects.create(**validated_data)
        
        for evento_data in eventos_data:
            EventoTurma.objects.create(turma=turma, **evento_data)
            
        return turma

class CursoSerializer(serializers.ModelSerializer):
    turmas = serializers.SerializerMethodField()

    class Meta:
        model = Curso
        fields = [
            'id', 'codigo_oficial', 'titulo', 'ementa', 'tipo', 'eixo', 'num_processo', 'memorando', 'status_geral', 'turmas'
        ]
        
    def get_turmas(self, obj):
        # Retorna apenas as turmas que estão ativas no sistema
        turmas_ativas = obj.turmas.filter(is_active=True)
        return TurmaSerializer(turmas_ativas, many=True).data