from rest_framework import serializers
from .models import Curso, Turma, EventoTurma, Inscricao, SolicitacaoReserva, ItemReserva, Modulo, Atividade, ProgressoAtividade, Questionario, Questao, Opcao
from users.serializers import ProfileSerializer
from django.db import transaction, IntegrityError

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
    letra = serializers.CharField(read_only=True)
    
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
            'id', 'curso', 'codigo', 'letra', 'modalidade', 'visibilidade',
            'vinculos_permitidos', 'apenas_cadastro_manual',
            'gestores_permitidos', 'data_inicio', 'data_fim', 'carga_horaria',
            'vagas', 'custo', 'instrutor', 'instrutor_nome', 'instrutor_cpf',
            'status', 'eventos', 'vagas_restantes'
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

        # ── A BOLHA DE PROTEÇÃO (ATOMIC) ──
        try:
            with transaction.atomic():
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
                
        except IntegrityError:
            # Transforma a quebra do banco (ex: sala ocupada) em um erro 400 amigável
            raise serializers.ValidationError({
                "detail": "Conflito de agenda. Um ou mais espaços selecionados já estão ocupados neste horário."
            })

    def update(self, instance, validated_data):
        gestores_dados = validated_data.pop('gestores_permitidos', None)
        eventos_data = validated_data.pop('eventos', None)
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

        # ── A BOLHA DE PROTEÇÃO NO UPDATE ──
        try:
            with transaction.atomic():
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
                
        except IntegrityError:
            raise serializers.ValidationError({
                "detail": "Erro de integridade ao atualizar a turma."
            })

class InscricaoDetailSerializer(serializers.ModelSerializer):
    perfil = ProfileSerializer(read_only=True)
    turma = TurmaSerializer(read_only=True)
    curso = serializers.SerializerMethodField()
    is_urgente = serializers.SerializerMethodField()
    presencas = serializers.SerializerMethodField()
    
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

    def get_presencas(self, obj):
        """Retorna dict {str(evento_id): status} para exibir frequencia do aluno."""
        from cursos.models import RegistroPresenca
        registros = RegistroPresenca.objects.filter(inscricao=obj).select_related('evento')
        return {str(r.evento_id): r.status for r in registros}

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
        
        request = self.context.get('request')
        
        # Se for um usuário comum, aplicamos o filtro inteligente
        if request and request.user.is_authenticated and not request.user.is_staff:
            tipo_user = request.user.tipo_usuario
            
            turmas_filtradas = []
            for t in turmas_ativas:
                if t.visibilidade == 'RESTRITA':
                    # Se a turma for privada, ela DEVE aparecer, mas APENAS SE 
                    # o tipo do usuário estiver explicitamente na lista de vínculos permitidos.
                    # (Se a lista for vazia, significa que é restrita para todos, então só admin vê).
                    if t.vinculos_permitidos and tipo_user in t.vinculos_permitidos:
                        turmas_filtradas.append(t)
                else:
                    # Se a turma for pública, ela aparece livremente se a lista de vínculos 
                    # for vazia, OU se o usuário estiver dentro da lista.
                    if not t.vinculos_permitidos or tipo_user in t.vinculos_permitidos:
                        turmas_filtradas.append(t)
                        
            return TurmaSerializer(turmas_filtradas, many=True, context=self.context).data

        # Se for admin (is_staff) ou não autenticado (fallback de segurança), retorna todas ativas
        return TurmaSerializer(turmas_ativas, many=True, context=self.context).data
    

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
        fields = ['id', 'titulo', 'descricao', 'tipo', 'url_video', 'carga_horaria_recompensa', 'ordem', 'concluida', 'questionario_id']

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

class OpcaoSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(required=False)

    class Meta:
        model = Opcao
        fields = ['id', 'texto', 'is_correta', 'ordem']

class QuestaoSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(required=False)
    opcoes = OpcaoSerializer(many=True)

    class Meta:
        model = Questao
        fields = ['id', 'enunciado', 'ordem', 'valor', 'opcoes']

class QuestionarioSerializer(serializers.ModelSerializer):
    questoes = QuestaoSerializer(many=True)

    class Meta:
        model = Questionario
        fields = ['id', 'atividade', 'titulo', 'descricao', 'tentativas_permitidas', 'tempo_limite_minutos', 'nota_minima_aprovacao', 'questoes']

    def create(self, validated_data):
        questoes_data = validated_data.pop('questoes', [])
        questionario = Questionario.objects.create(**validated_data)
        for questao_data in questoes_data:
            opcoes_data = questao_data.pop('opcoes', [])
            questao = Questao.objects.create(questionario=questionario, **questao_data)
            for opcao_data in opcoes_data:
                Opcao.objects.create(questao=questao, **opcao_data)
        return questionario

    def update(self, instance, validated_data):
        questoes_data = validated_data.pop('questoes', [])
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Recriar as questões
        instance.questoes.all().delete()

        for questao_data in questoes_data:
            opcoes_data = questao_data.pop('opcoes', [])
            questao_data.pop('id', None)
            questao = Questao.objects.create(questionario=instance, **questao_data)
            for opcao_data in opcoes_data:
                opcao_data.pop('id', None)
                Opcao.objects.create(questao=questao, **opcao_data)

        return instance