from rest_framework import serializers
from .models import Curso, Turma, EventoTurma, Inscricao

class EventoTurmaSerializer(serializers.ModelSerializer):
    class Meta:
        model = EventoTurma
        fields = ['id', 'data', 'hora_inicio', 'hora_fim', 'espaco', 'espaco_externo_nome']

class TurmaSerializer(serializers.ModelSerializer):
    instrutor_nome = serializers.CharField(source='instrutor.nome_completo', read_only=True)
    codigo = serializers.CharField(source='codigo_turma', read_only=True)
    status = serializers.CharField(source='status_calculado', read_only=True)
    eventos = EventoTurmaSerializer(many=True, required=False)
    vagas_restantes = serializers.SerializerMethodField()

    class Meta:
        model = Turma
        fields = [
            'id', 'curso', 'codigo', 'letra', 'modalidade', 'data_inicio', 'data_fim', 
            'carga_horaria', 'vagas', 'custo', 'instrutor', 'instrutor_nome', 'status', 'eventos',
            'vagas_restantes'
        ]

    def get_vagas_restantes(self, obj):
        inscricoes_ativas = obj.inscricoes.exclude(status='cancelado').count()
        return max(0, obj.vagas - inscricoes_ativas)

    def create(self, validated_data):
        eventos_data = validated_data.pop('eventos', [])
        turma = Turma.objects.create(**validated_data)
        
        for evento_data in eventos_data:
            EventoTurma.objects.create(turma=turma, **evento_data)
            
        return turma

from users.serializers import ProfileSerializer

class InscricaoDetailSerializer(serializers.ModelSerializer):
    perfil = ProfileSerializer(read_only=True)
    turma = TurmaSerializer(read_only=True)
    curso = serializers.SerializerMethodField()
    is_urgente = serializers.SerializerMethodField()
    
    titulo_curso = serializers.CharField(source='turma.curso.titulo', read_only=True)
    codigo_turma = serializers.CharField(source='turma.codigo_turma', read_only=True)
    data_inicio = serializers.DateField(source='turma.data_inicio', read_only=True)
    data_termino = serializers.DateField(source='turma.data_fim', read_only=True)
    modalidade = serializers.CharField(source='turma.modalidade', read_only=True)
    carga_horaria = serializers.IntegerField(source='turma.carga_horaria', read_only=True)

    class Meta:
        model = Inscricao
        fields = '__all__'

    def get_is_urgente(self, obj):
        from django.utils import timezone
        
        now = timezone.now()
        # Pendente há mais de 5 dias
        if (now - obj.data_inscricao).days > 5:
            return True
            
        # Faltam menos de 48h (2 dias) para o curso começar
        # data_inicio é date, convertemos para datetime para comparar
        from datetime import datetime
        dummy_time = datetime.min.time()
        data_inicio_dt = timezone.make_aware(datetime.combine(obj.turma.data_inicio, dummy_time))
        
        if (data_inicio_dt - now).days <= 2:
            return True
            
        return False

    def get_curso(self, obj):
        return {
            "id": obj.turma.curso.id,
            "titulo": obj.turma.curso.titulo,
            "codigo_oficial": obj.turma.curso.codigo_oficial
        }

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