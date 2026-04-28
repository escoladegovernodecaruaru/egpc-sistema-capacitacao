from rest_framework import serializers
from .models import Curso, Turma, EventoTurma, Inscricao, SolicitacaoReserva, ItemReserva, Modulo, Atividade, ProgressoAtividade
from users.serializers import ProfileSerializer

class EventoTurmaSerializer(serializers.ModelSerializer):
    class Meta:
        model = EventoTurma
        fields = ['id', 'data', 'hora_inicio', 'hora_fim', 'espaco', 'espaco_externo_nome', 'turno_reserva']

class TurmaSerializer(serializers.ModelSerializer):
    instrutor_nome = serializers.CharField(source='instrutor.nome_completo', read_only=True)
    codigo = serializers.CharField(source='codigo_turma', read_only=True)
    status = serializers.CharField(source='status_calculado', read_only=True)
    eventos = EventoTurmaSerializer(many=True, required=False)
    vagas_restantes = serializers.SerializerMethodField()
    
    # Campo virtual para receber o CPF do front-end
    instrutor_cpf = serializers.CharField(write_only=True, required=False, allow_blank=True, allow_null=True)
    gestores_permitidos = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        write_only=True
    )

    class Meta:
        model = Turma
        fields = [
            'id', 'curso', 'codigo', 'letra', 'modalidade', 'visibilidade', 'gestores_permitidos',
            'data_inicio', 'data_fim', 'carga_horaria', 'vagas', 'custo', 'instrutor', 
            'instrutor_nome', 'instrutor_cpf', 'status', 'eventos', 'vagas_restantes'
        ]

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        # Popula o array de CPFs para compatibilidade com o frontend
        if hasattr(instance, 'gestores_associados'):
            ret['gestores_permitidos'] = [g.gestor.cpf for g in instance.gestores_associados.all()]
        else:
            ret['gestores_permitidos'] = []

        ret['curso'] = {
            "id": instance.curso.id,
            "titulo": instance.curso.titulo,
            "tipo": instance.curso.tipo,
        }

        return ret

    def get_vagas_restantes(self, obj):
        inscricoes_ativas = obj.inscricoes.exclude(status='cancelado').count()
        return max(0, obj.vagas - inscricoes_ativas)

    def create(self, validated_data):
        eventos_data = validated_data.pop('eventos', [])
        instrutor_cpf = validated_data.pop('instrutor_cpf', None)
        gestores_dados = validated_data.pop('gestores_permitidos', [])
        
        # Lógica do Instrutor Fantasma
        if instrutor_cpf:
            import re
            from users.models import Profile
            cpf_limpo = re.sub(r'\D', '', instrutor_cpf)
            
            if len(cpf_limpo) == 11:
                # Busca ou cria a "casca" do perfil
                instrutor, created = Profile.objects.get_or_create(
                    cpf=cpf_limpo,
                    defaults={
                        'nome_completo': 'Instrutor Pendente de Cadastro',
                        'email': f'pendente_{cpf_limpo}@escola.local',
                        'tipo_usuario': 'INSTRUTOR',
                        'is_active': True
                    }
                )
                validated_data['instrutor'] = instrutor

        turma = Turma.objects.create(**validated_data)
        
        for evento_data in eventos_data:
            EventoTurma.objects.create(turma=turma, **evento_data)
            
        from cursos.models import TurmaGestor
        from users.models import Profile
        for gestor_cpf in gestores_dados:
             perfil = Profile.objects.filter(cpf=gestor_cpf).first()
             if perfil:
                 TurmaGestor.objects.get_or_create(turma=turma, gestor=perfil)
            
        return turma

    def update(self, instance, validated_data):
        gestores_dados = validated_data.pop('gestores_permitidos', None)
        
        eventos_data = validated_data.pop('eventos', None)
        # O EventoTurma e afins devem ser manuseados separadamente ou via outro endpoint
        # Vamos apenas focar no update da Turma em si.
        instrutor_cpf = validated_data.pop('instrutor_cpf', None)
        if instrutor_cpf:
            import re
            from users.models import Profile
            cpf_limpo = re.sub(r'\D', '', instrutor_cpf)
            if len(cpf_limpo) == 11:
                instrutor, _ = Profile.objects.get_or_create(
                    cpf=cpf_limpo,
                    defaults={
                        'nome_completo': 'Instrutor Pendente de Cadastro',
                        'email': f'pendente_{cpf_limpo}@escola.local',
                        'tipo_usuario': 'INSTRUTOR',
                        'is_active': True
                    }
                )
                validated_data['instrutor'] = instrutor

        # Salva dados básicos da Turma
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Update M2M dos gestores
        if gestores_dados is not None:
            from cursos.models import TurmaGestor
            from users.models import Profile
            
            # Limpa e recria associações
            instance.gestores_associados.all().delete()
            for gestor_cpf in gestores_dados:
                perfil = Profile.objects.filter(cpf=gestor_cpf).first()
                if perfil:
                    TurmaGestor.objects.create(turma=instance, gestor=perfil)
        
        return instance

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
    

class ItemReservaSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemReserva
        fields = ['id', 'espaco', 'data', 'hora_inicio', 'hora_fim', 'turno_reserva']
        read_only_fields = ['turno_reserva']

class SolicitacaoReservaSerializer(serializers.ModelSerializer):
    itens = ItemReservaSerializer(many=True)
    solicitante_nome = serializers.CharField(source='solicitante.nome_completo', read_only=True)

    class Meta:
        model = SolicitacaoReserva
        fields = [
            'id', 'solicitante', 'solicitante_nome', 'titulo', 'descricao',
            'status', 'protocolo', 'justificativa_recusa', 'itens',
            'criado_em', 'atualizado_em'
        ]
        read_only_fields = ['solicitante', 'status', 'protocolo', 'justificativa_recusa']

    def create(self, validated_data):
        itens_data = validated_data.pop('itens')
        solicitacao = SolicitacaoReserva.objects.create(**validated_data)
        for item_data in itens_data:
            ItemReserva.objects.create(solicitacao=solicitacao, **item_data)
        return solicitacao
    
class AtividadeSerializer(serializers.ModelSerializer):
    concluida = serializers.SerializerMethodField()

    class Meta:
        model = Atividade
        fields = ['id', 'titulo', 'descricao', 'tipo', 'url_video', 'carga_horaria_recompensa', 'ordem', 'concluida']

    def get_concluida(self, obj):
        # Esse contexto será passado pela View
        inscricao_id = self.context.get('inscricao_id')
        if not inscricao_id:
            return False
        return ProgressoAtividade.objects.filter(atividade=obj, inscricao_id=inscricao_id, concluido=True).exists()

class ModuloSerializer(serializers.ModelSerializer):
    atividades = AtividadeSerializer(many=True, read_only=True)

    class Meta:
        model = Modulo
        fields = ['id', 'titulo', 'ordem', 'atividades']