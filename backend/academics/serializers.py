from rest_framework import serializers
from .models import Curso, Turma, EncontroPresencial, ModuloDigital, Matricula

class EncontroPresencialSerializer(serializers.ModelSerializer):
    class Meta:
        model = EncontroPresencial
        fields = '__all__'

class ModuloDigitalSerializer(serializers.ModelSerializer):
    class Meta:
        model = ModuloDigital
        fields = '__all__'

class TurmaSerializer(serializers.ModelSerializer):
    encontros_presenciais = EncontroPresencialSerializer(many=True, read_only=True)
    modulos_digitais = ModuloDigitalSerializer(many=True, read_only=True)

    class Meta:
        model = Turma
        fields = [
            'id', 'curso', 'codigo', 'instrutor', 'status', 'vagas',
            'data_inicio', 'data_fim', 'encontros_presenciais', 'modulos_digitais',
            'criado_em', 'atualizado_em'
        ]

class CursoSerializer(serializers.ModelSerializer):
    status_geral = serializers.ReadOnlyField()
    turmas = TurmaSerializer(many=True, read_only=True)

    class Meta:
        model = Curso
        fields = [
            'id', 'codigo', 'titulo', 'descricao', 'status_geral', 'turmas',
            'criado_em', 'atualizado_em'
        ]

class MatriculaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Matricula
        fields = '__all__'
