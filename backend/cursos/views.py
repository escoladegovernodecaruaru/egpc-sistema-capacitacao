from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAdminUser
from django.db import transaction
from django.utils import timezone
from django.shortcuts import get_object_or_404
from .models import Curso, Turma, Inscricao, SolicitacaoReserva, ItemReserva, EventoTurma, RegistroPresenca, Modulo, Atividade, ProgressoAtividade, EspacoAlocado, Questionario, Questao, Opcao, TentativaQuestionario, RespostaAluno, ProgressoSessaoEAD
from .serializers import CursoSerializer, TurmaSerializer, InscricaoDetailSerializer, SolicitacaoReservaSerializer, ModuloSerializer, QuestionarioSerializer

from users.models import Profile
from rest_framework.exceptions import PermissionDenied

class CursoListView(generics.ListCreateAPIView):
    serializer_class = CursoSerializer

    def get_permissions(self):
        # Apenas administradores (is_staff) podem criar cursos via POST. Qualquer um pode ver (GET).
        if self.request.method == 'POST':
            return [IsAdminUser()]
        return [AllowAny()]

    def get_queryset(self):
        from django.db.models import Prefetch
        user = self.request.user
        meus_cursos = self.request.query_params.get('meus_cursos') == 'true'

        # 1. VISÃO BASE (Admin vs Usuário Comum)
        if user.is_authenticated and user.is_staff:
            qs = Curso.objects.prefetch_related('turmas')
        else:
            prefetch_turmas_ativas = Prefetch('turmas', queryset=Turma.objects.filter(is_active=True))
            qs = Curso.objects.filter(
                is_active=True,
                turmas__is_active=True
            ).prefetch_related(prefetch_turmas_ativas)

        # 2. FILTRO "MEUS CURSOS" (?meus_cursos=true)
        if meus_cursos and user.is_authenticated:
            # Atravessa a relação: Curso -> Turmas -> Inscrições -> Perfil do usuário logado
            qs = qs.filter(turmas__inscricoes__perfil=user)

        # O .distinct() é crucial aqui para evitar que o curso apareça duplicado 
        # caso o usuário (ou o admin) possua interações com múltiplas turmas do mesmo curso.
        return qs.distinct().order_by('-codigo_oficial')
    
class CursoUpdateView(generics.UpdateAPIView):
    """ PATCH/PUT: Edita um curso base existente (apenas Admin) """
    serializer_class = CursoSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    queryset = Curso.objects.all()

class TurmaCreateView(generics.CreateAPIView):
    serializer_class = TurmaSerializer
    permission_classes = [IsAuthenticated]

class MinhasInscricoesSimplificadasView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        inscricoes = Inscricao.objects.filter(perfil=user).exclude(status='cancelado')
        turmas = list(inscricoes.values_list('turma_id', flat=True))
        cursos = list(inscricoes.values_list('turma__curso_id', flat=True))
        return Response({
            "turmas": turmas,
            "cursos": cursos
        })

class InscreverTurmaView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, turma_id):
        user = request.user

        if user.esta_bloqueado():
            return Response({"detail": "Usuário cumprindo período de suspensão"}, status=status.HTTP_403_FORBIDDEN)

        # Trava de Perfil Incompleto
        if user.tipo_usuario in ['SERVIDOR_ATIVO', 'TERCEIRIZADO', 'ESTAGIARIO']:
            if not user.dados_servidor or not user.dados_servidor.get('matricula'):
                return Response({
                    "detail": "Seu perfil está incompleto. A matrícula é obrigatória para realizar inscrições. Atualize seus dados em 'Meu Perfil'."
                }, status=status.HTTP_403_FORBIDDEN)

        with transaction.atomic():
            try:
                turma = Turma.objects.select_for_update().get(id=turma_id)
            except Turma.DoesNotExist:
                return Response({"detail": "Turma não encontrada."}, status=status.HTTP_404_NOT_FOUND)

            if turma.visibilidade == Turma.Visibilidade.RESTRITA:
                if turma.apenas_cadastro_manual and not user.is_staff:
                    return Response(
                        {"detail": "Esta turma é fechada. A matrícula só pode ser feita pela gestão."}, 
                        status=status.HTTP_403_FORBIDDEN
                    )
                
                if turma.vinculos_permitidos and user.tipo_usuario not in turma.vinculos_permitidos:
                    return Response(
                        {"detail": "O seu tipo de vínculo não tem permissão para ingressar nesta turma."}, 
                        status=status.HTTP_403_FORBIDDEN
                    )
            
            # Verifica se já está ativo em QUALQUER turma deste curso
            ja_inscrito = Inscricao.objects.filter(
                perfil=user,
                turma__curso=turma.curso
            ).exclude(status__in=[Inscricao.Status.CANCELADO, Inscricao.Status.REPROVADO]).exists()

            if ja_inscrito:
                return Response({"detail": "Você já está inscrito ou aguardando aprovação para este curso"}, status=status.HTTP_400_BAD_REQUEST)

            # Checagem de vagas antes de prosseguir
            vagas_ocupadas = Inscricao.objects.filter(
                turma=turma, 
                status__in=[Inscricao.Status.INSCRITO, Inscricao.Status.APROVADO_CHEFIA]
            ).count()
            
            if vagas_ocupadas >= turma.vagas:
                return Response({"detail": f"Turma sem vagas disponíveis ({vagas_ocupadas}/{turma.vagas})."}, status=status.HTTP_400_BAD_REQUEST)

            if user.tipo_usuario == 'CIDADAO':
                novo_status = Inscricao.Status.INSCRITO
            else:
                novo_status = Inscricao.Status.PENDENTE

            try:
                # O SEGREDO ESTÁ AQUI: Usa get_or_create. Se a inscrição (cancelada) já existir, ele não cria outra, ele resgata.
                inscricao, created = Inscricao.objects.get_or_create(
                    perfil=user,
                    turma=turma,
                    defaults={'status': novo_status}
                )
                
                if not created:
                    # Ressuscita a inscrição antiga, limpando as recusas passadas
                    inscricao.status = novo_status
                    inscricao.justificativa_rejeicao = None
                    inscricao.aprovado_por = None
                    inscricao.aprovado_em = None
                    inscricao.save()
                    
            except Exception as e:
                return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"detail": "Inscrição realizada com sucesso.", "inscricao_id": inscricao.id}, status=status.HTTP_201_CREATED)
    

class InscricoesEquipeView(generics.ListAPIView):
    """ GET: Lista inscrições pendentes onde a chefia é o usuário logado (via Matrícula) """
    serializer_class = InscricaoDetailSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        minha_matricula = user.dados_servidor.get('matricula') if user.dados_servidor else None
        
        # Se o usuário não tem matrícula preenchida, ele não pode ser chefe de ninguém
        if not minha_matricula and not user.is_staff:
            return Inscricao.objects.none()
            
        minha_matricula_str = str(minha_matricula).strip()

        if user.is_staff:
            return Inscricao.objects.filter(
                status=Inscricao.Status.PENDENTE,
            ).select_related('perfil', 'turma', 'turma__curso')
        else:
            return Inscricao.objects.filter(
                status=Inscricao.Status.PENDENTE,
                perfil__dados_servidor__matricula_chefe=minha_matricula_str
            ).select_related('perfil', 'turma', 'turma__curso')

class AprovarInscricaoView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            inscricao = Inscricao.objects.get(pk=pk, status=Inscricao.Status.PENDENTE)
        except Inscricao.DoesNotExist:
            return Response({"detail": "Inscrição não encontrada ou não está pendente."}, status=status.HTTP_404_NOT_FOUND)

        # ── INÍCIO DA MUDANÇA PARA MATRÍCULA ──
        matricula_chefe_aluno = inscricao.perfil.dados_servidor.get('matricula_chefe') if inscricao.perfil.dados_servidor else None
        minha_matricula = request.user.dados_servidor.get('matricula') if request.user.dados_servidor else None

        matricula_chefe_aluno_str = str(matricula_chefe_aluno).strip() if matricula_chefe_aluno else None
        minha_matricula_str = str(minha_matricula).strip() if minha_matricula else None

        # O Admin (is_staff) sempre pode aprovar. Se não for admin, a matrícula tem que bater.
        if not (request.user.is_staff or (matricula_chefe_aluno_str and matricula_chefe_aluno_str == minha_matricula_str)):
            return Response({"detail": "Você não tem permissão para avaliar esta inscrição. Matrícula divergente."}, status=status.HTTP_403_FORBIDDEN)
        # ── FIM DA MUDANÇA ──

        acao = request.data.get('acao')
        justificativa = request.data.get('justificativa')

        with transaction.atomic():
            inscricao.aprovado_por = request.user
            inscricao.aprovado_em = timezone.now()
            
            # Obtém IP do cliente
            x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
            if x_forwarded_for:
                ip = x_forwarded_for.split(',')[0]
            else:
                ip = request.META.get('REMOTE_ADDR')
            inscricao.ip_aprovacao = ip

            if acao == 'aprovar':
                inscricao.status = Inscricao.Status.APROVADO_CHEFIA
            elif acao == 'negar':
                if not justificativa:
                    return Response({"detail": "Justificativa é obrigatória para negar."}, status=status.HTTP_400_BAD_REQUEST)
                inscricao.status = Inscricao.Status.CANCELADO
                inscricao.justificativa_rejeicao = justificativa
            else:
                # Fallback genérico para manter compatibilidade
                inscricao.status = Inscricao.Status.APROVADO_CHEFIA

            inscricao.save()

        mensagem = "Inscrição aprovada com sucesso." if acao != 'negar' else "Inscrição negada com sucesso."
        return Response({"detail": mensagem}, status=status.HTTP_200_OK)

class MinhasInscricoesDetailView(generics.ListAPIView):
    serializer_class = InscricaoDetailSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Inscricao.objects.filter(
            perfil=self.request.user
        ).select_related(
            'turma', 'turma__curso'
        ).order_by('-data_inscricao')


class MinhasSolicitacoesView(generics.ListCreateAPIView):
    """ GET lista reservas do usuário. POST cria uma nova reserva. """
    serializer_class = SolicitacaoReservaSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return SolicitacaoReserva.objects.filter(solicitante=self.request.user)

    def perform_create(self, serializer):
        user = self.request.user
        # Guard: apenas Admins ou usuários com permissão explícita podem criar reservas
        if not (user.is_staff or getattr(user, 'is_solicitante', False)):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied(
                "Você não tem permissão para solicitar reservas. "
                "Solicite ao administrador que conceda o nível 'Solicitante'."
            )
        if user.is_staff:
            serializer.save(solicitante=user, status=SolicitacaoReserva.Status.APROVADA)
        else:
            serializer.save(solicitante=user)

class AgendaGlobalView(APIView):
    """ O motor do calendário: Junta Aulas Oficiais + Reservas Avulsas (apenas Staff e Solicitantes) """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        # Apenas staff e solicitantes podem ver o calendário de reservas
        if not (user.is_staff or getattr(user, 'is_solicitante', False)):
            return Response({"detail": "Acesso restrito a gestores e solicitantes de espaço."}, status=status.HTTP_403_FORBIDDEN)

        from django.utils import timezone
        mes = request.query_params.get('mes')
        ano = request.query_params.get('ano', timezone.now().year)
        is_admin = user.is_staff

        q_aulas = EventoTurma.objects.select_related('turma', 'turma__curso').filter(turma__is_active=True)
        # Inclui APROVADAS e PENDENTES (para renderizar tracejado)
        q_res = ItemReserva.objects.select_related('solicitacao', 'solicitacao__solicitante').filter(
            solicitacao__status__in=[SolicitacaoReserva.Status.APROVADA, SolicitacaoReserva.Status.PENDENTE]
        )
        if not is_admin:
            q_res = q_res.exclude(espaco='EXTERNO')

        if mes:
            q_aulas = q_aulas.filter(data__month=mes, data__year=ano)
            q_res   = q_res.filter(data__month=mes, data__year=ano)

        eventos = []
        for aula in q_aulas:
            item = {
                "id": f"aula_{aula.id}", "tipo": "AULA",
                "titulo": f"{aula.turma.curso.codigo_oficial} - Turma {aula.turma.letra}",
                "data": aula.data.isoformat(), "turno": aula.turno_reserva, "local": aula.espaco,
                "hora_inicio": aula.hora_inicio.strftime('%H:%M') if aula.hora_inicio else None,
                "hora_fim": aula.hora_fim.strftime('%H:%M') if aula.hora_fim else None,
                "status": "APROVADA",
            }
            if is_admin:
                item["origin_tipo"] = "TURMA"
                item["origin_id"] = aula.turma.id
                item["origin_desc"] = f"Turma {aula.turma.codigo_turma} — {aula.turma.curso.titulo}"
            eventos.append(item)

        for res in q_res:
            sol = res.solicitacao
            item = {
                "id": f"reserva_{res.id}", "tipo": "RESERVA_AVULSA",
                "titulo": sol.titulo, "data": res.data.isoformat(),
                "turno": res.turno_reserva, "local": res.espaco,
                "hora_inicio": res.hora_inicio.strftime('%H:%M') if res.hora_inicio else None,
                "hora_fim": res.hora_fim.strftime('%H:%M') if res.hora_fim else None,
                "status": sol.status,
            }
            if is_admin:
                item["origin_tipo"] = "SOLICITACAO"
                item["origin_id"] = str(sol.id)
                item["origin_desc"] = f"Protocolo {sol.protocolo}"
                item["origin_solicitante"] = sol.solicitante.nome_completo if sol.solicitante else "—"
            eventos.append(item)

        return Response(eventos, status=status.HTTP_200_OK)
    
class AdminSolicitacoesView(generics.ListAPIView):
    """ GET lista todas as solicitações de espaço com filtros opcionais """
    serializer_class = SolicitacaoReservaSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get_queryset(self):
        from django.db.models import Case, When, IntegerField
        qs = SolicitacaoReserva.objects.all()
        params = self.request.query_params
        if params.get('espaco'):     qs = qs.filter(itens__espaco=params['espaco'])
        if params.get('turno'):      qs = qs.filter(itens__turno_reserva=params['turno'])
        if params.get('solicitante'): qs = qs.filter(solicitante__nome_completo__icontains=params['solicitante'])
        if params.get('status'):     qs = qs.filter(status=params['status'])
        return qs.distinct().order_by(
            Case(When(status=SolicitacaoReserva.Status.PENDENTE, then=0), default=1, output_field=IntegerField()),
            '-criado_em'
        )

class AvaliarSolicitacaoView(APIView):
    """ POST aprova ou nega uma solicitação de espaço """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request, pk):
        try:
            solicitacao = SolicitacaoReserva.objects.get(pk=pk, status=SolicitacaoReserva.Status.PENDENTE)
        except SolicitacaoReserva.DoesNotExist:
            return Response({"detail": "Solicitação não encontrada ou já avaliada."}, status=status.HTTP_404_NOT_FOUND)

        acao = request.data.get('acao')
        justificativa = request.data.get('justificativa')

        if acao == 'aprovar':
            solicitacao.status = SolicitacaoReserva.Status.APROVADA
        elif acao == 'negar':
            if not justificativa:
                return Response({"detail": "Justificativa obrigatória para negar."}, status=status.HTTP_400_BAD_REQUEST)
            solicitacao.status = SolicitacaoReserva.Status.RECUSADA
            solicitacao.justificativa_recusa = justificativa
        else:
            return Response({"detail": "Ação inválida."}, status=status.HTTP_400_BAD_REQUEST)
        
        # Guardar logs de auditoria
        solicitacao.avaliado_por = request.user
        solicitacao.avaliado_em = timezone.now()
        
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            solicitacao.ip_avaliacao = x_forwarded_for.split(',')[0]
        else:
            solicitacao.ip_avaliacao = request.META.get('REMOTE_ADDR')

        solicitacao.save()
        return Response({"detail": f"Solicitação {acao}da com sucesso."}, status=status.HTTP_200_OK)
    

class CancelarSolicitacaoView(APIView):
    """ POST cancela uma solicitação de reserva feita pelo próprio usuário (Rate Limit: 1x / hora por solicitação) """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            # Garante que o usuário só pode cancelar a PRÓPRIA solicitação
            solicitacao = SolicitacaoReserva.objects.get(pk=pk, solicitante=request.user)
        except SolicitacaoReserva.DoesNotExist:
            return Response({"detail": "Solicitação não encontrada."}, status=status.HTTP_404_NOT_FOUND)

        if solicitacao.status in [SolicitacaoReserva.Status.CANCELADA, SolicitacaoReserva.Status.RECUSADA]:
            return Response({"detail": "Esta solicitação já encontra-se cancelada ou recusada."}, status=status.HTTP_400_BAD_REQUEST)

        # ── RATE LIMIT: 1 cancelamento/retificação por hora por solicitação ──
        from django.core.cache import cache
        cache_key = f"cancel_rate_{request.user.id}_{pk}"
        if cache.get(cache_key):
            return Response(
                {"detail": "Aguarde 1 hora antes de modificar esta solicitação novamente. "
                           "Limite de retificação anti-spam atingido."},
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )
        # Marca o cooldown de 1 hora (3600s)
        cache.set(cache_key, True, timeout=3600)

        motivo = request.data.get('motivo')
        if not motivo:
            return Response({"detail": "Motivo do cancelamento é obrigatório."}, status=status.HTTP_400_BAD_REQUEST)

        solicitacao.justificativa = f"Cancelado pelo solicitante. Motivo: {motivo}"
        solicitacao.status = SolicitacaoReserva.Status.CANCELADA
        solicitacao.save()

        return Response({"detail": "Solicitação cancelada com sucesso."}, status=status.HTTP_200_OK)
    

class MinhasTurmasInstrutorView(generics.ListAPIView):
    """ Retorna as turmas onde o usuário logado é o instrutor (ou todas se for Admin) """
    serializer_class = TurmaSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        
        # Se for administrador, traz TODAS as turmas do sistema
        if user.is_staff:
            return Turma.objects.all().order_by('-data_inicio')
            
        # Se não for, traz apenas as turmas em que ele é o instrutor oficial
        return Turma.objects.filter(instrutor=user).order_by('-data_inicio')

class DiarioTurmaView(APIView):
    """ GET: Puxa o grid do diário. POST: Salva notas, presenças e fecha o diário """
    permission_classes = [IsAuthenticated]

    def get(self, request, turma_id):
        try:
            turma = Turma.objects.get(id=turma_id)
            if not request.user.is_staff and turma.instrutor != request.user:
                return Response({"detail": "Sem permissão."}, status=403)
        except Turma.DoesNotExist:
            return Response({"detail": "Turma não encontrada."}, status=404)

        inscricoes = Inscricao.objects.filter(
            turma=turma, 
            status__in=[Inscricao.Status.INSCRITO, Inscricao.Status.CONCLUIDO, Inscricao.Status.REPROVADO]
        ).select_related('perfil').order_by('perfil__nome_completo')

        eventos = EventoTurma.objects.filter(turma=turma).order_by('data')
        
        alunos_data = []
        for insc in inscricoes:
            presencas = RegistroPresenca.objects.filter(inscricao=insc)
            # Agora salvamos a string do status: 'PRESENTE', 'FALTA', 'JUSTIFICADA'
            presencas_dict = {p.evento_id: p.status for p in presencas}
            
            alunos_data.append({
                "inscricao_id": insc.id,
                "nome": insc.perfil.nome_completo,
                "cpf": insc.perfil.cpf,
                "nota": float(insc.nota) if insc.nota is not None else None,
                "status": insc.status,
                "presencas": presencas_dict
            })

        eventos_data = [{"id": e.id, "data": e.data} for e in eventos]

        return Response({
            "turma": {"codigo": turma.codigo_turma, "status": turma.status_calculado},
            "eventos": eventos_data,
            "alunos": alunos_data
        })

    def post(self, request, turma_id):
        dados = request.data.get('alunos', [])
        fechar_diario = request.data.get('fechar_diario', False)

        turma = Turma.objects.get(id=turma_id)
        
        # 👇 TRAVA DE SEGURANÇA ADICIONADA AQUI 👇
        if not request.user.is_staff and turma.instrutor != request.user:
            raise PermissionDenied("Você não tem permissão para editar o diário desta turma.")
        # 👆 ================================== 👆

        from rest_framework.exceptions import PermissionDenied
        if turma.status_calculado in [Turma.Status.CONCLUIDA, Turma.Status.FINALIZADA]:
            raise PermissionDenied("Não é possível alterar o diário de uma turma já concluída ou finalizada.")

        total_eventos = turma.eventos.count()

        # Injeta o contexto de auditoria para os Signals capturarem
        from cursos._audit_context import set_audit_context, clear_audit_context
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        ip_origem = x_forwarded_for.split(',')[0] if x_forwarded_for else request.META.get('REMOTE_ADDR')
        set_audit_context(usuario_id=request.user.id, ip=ip_origem)

        try:
            with transaction.atomic():
                for aluno in dados:
                    inscricao = Inscricao.objects.get(id=aluno['inscricao_id'])

                    # 1. Salvar Nota
                    if aluno.get('nota') is not None and str(aluno['nota']).strip() != "":
                        inscricao.nota = float(aluno['nota'])
                    else:
                        inscricao.nota = None

                    # 2. Salvar Presenças
                    presencas = aluno.get('presencas', {})
                    presencas_marcadas = 0
                    for evento_id, status_val in presencas.items():
                        RegistroPresenca.objects.update_or_create(
                            inscricao=inscricao,
                            evento_id=int(evento_id),
                            defaults={'status': status_val}
                        )
                        # Tanto PRESENTE quanto JUSTIFICADA contam para a meta de 80%
                        if status_val in ['PRESENTE', 'JUSTIFICADA']:
                            presencas_marcadas += 1

                    # 3. Lógica de Aprovação
                    if fechar_diario:
                        total_presencas_db = RegistroPresenca.objects.filter(
                            inscricao=inscricao, 
                            status__in=['PRESENTE', 'JUSTIFICADA']
                        ).count()
                        perc_freq = (total_presencas_db / total_eventos * 100) if total_eventos > 0 else 100
                        nota_val = inscricao.nota or 0

                        if perc_freq >= 80 and nota_val >= 7:
                            inscricao.status = Inscricao.Status.CONCLUIDO
                        else:
                            inscricao.status = Inscricao.Status.REPROVADO

                    inscricao.save()
        finally:
            # Garante que o contexto de auditoria é SEMPRE limpo após o bloco
            clear_audit_context()

        if fechar_diario:
            from django.utils import timezone
            turma.diario_fechado_em = timezone.now()
            turma.diario_fechado_por = request.user
            turma.save(update_fields=['diario_fechado_em', 'diario_fechado_por'])

            # Registra o fechamento do diário no histórico
            from cursos.models import HistoricoAlteracao
            HistoricoAlteracao.objects.create(
                tipo_acao=HistoricoAlteracao.TipoAcao.DIARIO_FECHADO,
                usuario=request.user,
                tabela_referencia='catalogo_turmas',
                objeto_id=str(turma_id),
                valor_anterior='aberto',
                valor_novo='fechado',
                ip=ip_origem,
            )

        msg = "Diário finalizado com sucesso!" if fechar_diario else "Diário salvo como rascunho."
        return Response({"detail": msg}, status=status.HTTP_200_OK)
    
class AdminMatricularAlunoView(APIView):
    """ POST: Admin matricula um aluno manualmente pelo CPF """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request, turma_id):
        cpf = request.data.get('cpf')
        try:
            aluno = Profile.objects.get(cpf=cpf)
        except Profile.DoesNotExist:
            # Padrão unificado de e-mail fantasma
            aluno = Profile.objects.create_user(
                cpf=cpf,
                nome_completo="Usuário Pendente (Criado pelo Admin)",
                email=f'pendente_{cpf}@escola.local',
                is_active=False
            )

        try:
            turma = Turma.objects.get(id=turma_id)
            
            # Cria a inscrição direto como 'inscrito'
            insc, created = Inscricao.objects.get_or_create(
                perfil=aluno,
                turma=turma,
                defaults={'status': Inscricao.Status.INSCRITO}
            )
            
            if not created:
                return Response({"detail": "Aluno já está nesta turma."}, status=400)
                
            return Response({"detail": "Aluno matriculado com sucesso!"}, status=201)
        except Exception as e:
            return Response({"detail": str(e)}, status=400)
        
class SalaDeAulaView(APIView):
    """ GET: Retorna os módulos, vídeos e o progresso do aluno para a sala de aula virtual """
    permission_classes = [IsAuthenticated]

    def get(self, request, turma_id):
        user = request.user
        turma = get_object_or_404(Turma, id=turma_id)

        is_instrutor_ou_admin = user.is_staff or turma.instrutor == user
        inscricao = None

        if not is_instrutor_ou_admin:
            # Trava de perfil incompleto: qualquer usuário com dados de servidor deve tê-los preenchidos
            dados = user.dados_servidor or {}
            campos_servidor = ['matricula', 'matricula_chefe', 'secretaria']
            if any(dados.get(c) is not None for c in campos_servidor):
                # Tem dados de servidor - todos devem estar preenchidos
                if not all(dados.get(c) for c in campos_servidor):
                    return Response(
                        {"detail": "Complete seu perfil antes de acessar o conteúdo.", "codigo": "PERFIL_INCOMPLETO"},
                        status=status.HTTP_403_FORBIDDEN
                    )
            try:
                inscricao = Inscricao.objects.get(
                    turma=turma, perfil=user,
                    status__in=[Inscricao.Status.INSCRITO, Inscricao.Status.CONCLUIDO]
                )
            except Inscricao.DoesNotExist:
                return Response({"detail": "Você não tem acesso a esta sala de aula."}, status=status.HTTP_403_FORBIDDEN)

        from django.db.models import Prefetch
        now = timezone.now()

        if is_instrutor_ou_admin:
            atividades_qs = Atividade.objects.filter(is_active=True).select_related('atividade_pre_requisito')
        else:
            # Qualquer atividade ativa é visível para o aluno — sem necessidade de aprovação admin
            atividades_qs = Atividade.objects.filter(is_active=True).select_related('atividade_pre_requisito')

        modulos_qs = Modulo.objects.filter(turma=turma, is_active=True).select_related('atividade_pre_requisito').prefetch_related(
            Prefetch('atividades', queryset=atividades_qs)
        )

        # IDs de atividades concluídas pelo aluno (para avaliar pré-requisitos)
        concluidas_ids = set()
        if inscricao:
            concluidas_ids = set(
                ProgressoAtividade.objects.filter(inscricao=inscricao, concluido=True)
                .values_list('atividade_id', flat=True)
            )

        modulos_data = []
        for m in modulos_qs:
            # Verifica se o módulo tem pré-requisito e se foi cumprido
            modulo_bloqueado = False
            motivo_modulo = None
            if not is_instrutor_ou_admin and m.atividade_pre_requisito_id:
                if m.atividade_pre_requisito_id not in concluidas_ids:
                    modulo_bloqueado = True
                    motivo_modulo = f"Conclua '{m.atividade_pre_requisito.titulo}' para desbloquear este módulo."

            atividades_data = []
            for a in m.atividades.all():
                bloqueada = modulo_bloqueado
                motivo = motivo_modulo

                if not is_instrutor_ou_admin and not bloqueada:
                    # Drip content
                    if a.data_liberacao and a.data_liberacao > now:
                        bloqueada = True
                        dt_fmt = a.data_liberacao.strftime('%d/%m/%Y %H:%M')
                        motivo = f"Disponível a partir de {dt_fmt}."
                    # Pré-requisito de atividade
                    elif a.atividade_pre_requisito_id and a.atividade_pre_requisito_id not in concluidas_ids:
                        bloqueada = True
                        motivo = f"Conclua '{a.atividade_pre_requisito.titulo}' para desbloquear."

                ativ_dict = {
                    "id": a.id, "titulo": a.titulo, "descricao": a.descricao,
                    "tipo": a.tipo, "url_video": a.url_video if not bloqueada else None,
                    "ordem": a.ordem, "aprovado_admin": a.aprovado_admin,
                    "concluida": a.id in concluidas_ids,
                    "bloqueada": bloqueada, "motivo_bloqueio": motivo,
                    "data_liberacao": a.data_liberacao.strftime('%Y-%m-%dT%H:%M') if a.data_liberacao else None,
                }
                atividades_data.append(ativ_dict)

            modulos_data.append({
                "id": m.id, "titulo": m.titulo, "ordem": m.ordem,
                "bloqueado": modulo_bloqueado, "motivo_bloqueio": motivo_modulo,
                "atividades": atividades_data
            })

        return Response({
            "turma": {"codigo": turma.codigo_turma, "titulo": turma.curso.titulo, "carga_total": turma.carga_horaria},
            "modulos": modulos_data
        })


class PingAtividadeView(APIView):
    """ POST: Salva 1 minuto de tela do Player para validação Anti-Cheat no servidor. """
    permission_classes = [IsAuthenticated]

    def post(self, request, atividade_id):
        try:
            atividade = Atividade.objects.get(id=atividade_id, is_active=True)
            inscricao = Inscricao.objects.get(
                perfil=request.user, 
                turma=atividade.modulo.turma,
                status__in=[Inscricao.Status.INSCRITO, Inscricao.Status.CONCLUIDO]
            )
        except (Atividade.DoesNotExist, Inscricao.DoesNotExist):
            return Response(status=status.HTTP_403_FORBIDDEN)
        except Exception as e:
            import logging
            logging.getLogger(__name__).error("Erro inesperado em PingAtividadeView: %s", e)
            return Response({"detail": "Erro interno no servidor."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
        from cursos.models import ProgressoAtividade, ProgressoSessaoEAD
        from django.utils import timezone
        from django.db import transaction

        with transaction.atomic():
            # Fix TOCTOU: get_or_create e select_for_update dentro do mesmo bloco atômico
            progresso, _ = ProgressoAtividade.objects.get_or_create(
                inscricao=inscricao, atividade=atividade
            )
            # Lock pessimista aplicado DEPOIS do get_or_create para serializar as threads
            progresso = ProgressoAtividade.objects.select_for_update().get(id=progresso.id)

            ultima_sessao = ProgressoSessaoEAD.objects.filter(progresso=progresso).order_by('-timestamp_ping').first()
            if ultima_sessao:
                diferenca = (timezone.now() - ultima_sessao.timestamp_ping).total_seconds()
                if diferenca < 55:
                    return Response({"detail": "Múltiplas requisições simultâneas bloqueadas."}, status=status.HTTP_429_TOO_MANY_REQUESTS)

            ProgressoSessaoEAD.objects.create(progresso=progresso, duracao_minutos=1)
        
        return Response(status=status.HTTP_200_OK)

class ConcluirAtividadeView(APIView):
    """ POST: Marca atividade como concluída (basta o aluno dar play no vídeo). """
    permission_classes = [IsAuthenticated]

    def post(self, request, atividade_id):
        try:
            atividade = Atividade.objects.get(id=atividade_id, is_active=True)
            inscricao = Inscricao.objects.get(
                perfil=request.user,
                turma=atividade.modulo.turma,
                status__in=[Inscricao.Status.INSCRITO, Inscricao.Status.CONCLUIDO]
            )
        except (Atividade.DoesNotExist, Inscricao.DoesNotExist):
            return Response({"detail": "Atividade não encontrada ou acesso negado."}, status=status.HTTP_403_FORBIDDEN)

        progresso, _ = ProgressoAtividade.objects.get_or_create(
            inscricao=inscricao, atividade=atividade
        )
        progresso.concluido = True
        progresso.save(update_fields=['concluido'])

        return Response({"detail": "Atividade marcada como concluída!"}, status=status.HTTP_200_OK)
    
class MinhasGestoesView(generics.ListAPIView):
    """ Retorna apenas as turmas onde o CPF do usuário logado está na lista de autorizados """
    serializer_class = TurmaSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user_cpf = self.request.user.cpf
        # Usando a nova relação FK N:M
        return Turma.objects.filter(gestores_associados__gestor__cpf=user_cpf).order_by('-data_inicio')


class GestaoAlunosTurmaView(APIView):
    """ GET: Lista alunos ativos. POST: Adiciona ou inativa (soft delete) um aluno """
    permission_classes = [IsAuthenticated]

    def get(self, request, turma_id):
        try:
            turma = Turma.objects.get(id=turma_id)
        except Turma.DoesNotExist:
            return Response({"detail": "Turma não encontrada."}, status=404)

        # Trava de Segurança: Só o Admin ou o CPF autorizado passa daqui
        if not turma.gestores_associados.filter(gestor__cpf=request.user.cpf).exists() and not request.user.is_staff:
            return Response({"detail": "Sem permissão para gerenciar esta turma."}, status=403)
        
        inscricoes = Inscricao.objects.filter(turma=turma).exclude(status=Inscricao.Status.CANCELADO).select_related('perfil').order_by('-data_inscricao')
        
        data = [{
            "id": insc.id,
            "cpf": insc.perfil.cpf,
            "nome": insc.perfil.nome_completo,
            "status": insc.status,
            "data_inscricao": insc.data_inscricao
        } for insc in inscricoes]
        
        return Response(data)

    def post(self, request, turma_id):
        cpf_aluno = request.data.get('cpf')
        acao = request.data.get('acao', 'adicionar')
        
        try:
            turma = Turma.objects.get(id=turma_id)
        except Turma.DoesNotExist:
            return Response({"detail": "Turma não encontrada."}, status=404)
        
        if not turma.gestores_associados.filter(gestor__cpf=request.user.cpf).exists() and not request.user.is_staff:
            return Response({"detail": "Sem permissão."}, status=403)
            
        try:
            aluno = Profile.objects.get(cpf=cpf_aluno)
        except Profile.DoesNotExist:
            aluno = Profile.objects.create_user(
                cpf=cpf_aluno,
                nome_completo="Usuário Pendente (Criado pelo Admin)",
                email=f'pendente_{cpf_aluno}@escola.local',
                is_active=False
            )

        if acao == 'adicionar':
            if getattr(aluno, 'esta_bloqueado', lambda: False)():
                return Response({"detail": "Aluno suspenso não pode ser matriculado."}, status=403)
            
            # Se a inscrição já existia e estava cancelada, o get_or_create não cria, ele pega a antiga.
            insc, created = Inscricao.objects.get_or_create(
                perfil=aluno, 
                turma=turma, 
                defaults={'status': Inscricao.Status.INSCRITO}
            )
            # Então nós forçamos a reativação:
            if not created:
                insc.status = Inscricao.Status.INSCRITO
                insc.save()
            return Response({"detail": "Aluno adicionado/reativado com sucesso!"}, status=200)
        
        elif acao == 'remover':
            try:
                insc = Inscricao.objects.get(perfil=aluno, turma=turma)
                insc.status = Inscricao.Status.CANCELADO # Soft Delete
                insc.save()
                return Response({"detail": "Aluno removido (inativado) com sucesso!"}, status=200)
            except Inscricao.DoesNotExist:
                return Response({"detail": "Inscrição não encontrada."}, status=404)
            
class ModuloViewSet(APIView):
    """ Gestão de Módulos (Criar, Ler e Apagar) """
    permission_classes = [IsAuthenticated]

    def get(self, request, turma_id=None, pk=None):
        if turma_id:
            turma = get_object_or_404(Turma, pk=turma_id)
            if not request.user.is_staff and turma.instrutor != request.user:
                return Response(status=403)
            modulos = Modulo.objects.filter(turma=turma, is_active=True).order_by('ordem')
            
            data = []
            for m in modulos:
                atividades = Atividade.objects.filter(modulo=m, is_active=True).order_by('ordem')
                ativ_data = []
                for a in atividades:
                    ativ_data.append({
                        "id": a.id, "titulo": a.titulo, "descricao": a.descricao,
                        "tipo": a.tipo, "url_video": a.url_video,
                        "ordem": a.ordem, "aprovado_admin": a.aprovado_admin,
                        "data_liberacao": a.data_liberacao.strftime('%Y-%m-%dT%H:%M') if a.data_liberacao else None,
                        "atividade_pre_requisito_id": a.atividade_pre_requisito_id,
                    })
                data.append({
                    "id": m.id, "titulo": m.titulo, "ordem": m.ordem,
                    "atividade_pre_requisito_id": m.atividade_pre_requisito_id,
                    "atividades": ativ_data
                })
            return Response({"modulos": data})
        return Response(status=400)

    def post(self, request, turma_id):
        turma = get_object_or_404(Turma, pk=turma_id)
        if not request.user.is_staff and turma.instrutor != request.user:
            return Response(status=403)
        
        titulo = request.data.get('titulo')
        ordem = request.data.get('ordem', 0)
        
        modulo = Modulo.objects.create(turma_id=turma_id, titulo=titulo, ordem=ordem)
        return Response({"id": modulo.id, "titulo": modulo.titulo}, status=201)

    def delete(self, request, pk):
        modulo = get_object_or_404(Modulo, pk=pk)
        if not request.user.is_staff and modulo.turma.instrutor != request.user:
            return Response(status=403)
        modulo.is_active = False
        modulo.save()
        return Response(status=204)

class AtividadeViewSet(APIView):
    """ Gestão de Atividades (Aulas/Vídeos) """
    permission_classes = [IsAuthenticated]

    def post(self, request, modulo_id):
        modulo = get_object_or_404(Modulo, pk=modulo_id)
        if not request.user.is_staff and modulo.turma.instrutor != request.user:
            return Response(status=403)
            
        data = request.data
        carga_hr = data.get('carga_horaria_recompensa', data.get('carga_horaria', 0))
        atividade = Atividade.objects.create(
            modulo_id=modulo_id,
            titulo=data.get('titulo'),
            descricao=data.get('descricao'),
            tipo=data.get('tipo', 'VIDEO_YOUTUBE'),
            url_video=data.get('url_video'),
            carga_horaria_recompensa=carga_hr,
            ordem=data.get('ordem', 0),
            aprovado_admin=True,  # Sem necessidade de aprovacao: instrutor pode publicar a qualquer momento
            aprovado_por=request.user,
            aprovado_em=timezone.now(),
        )
        return Response({"id": atividade.id, "titulo": atividade.titulo}, status=201)

    def delete(self, request, pk):
        ativ = get_object_or_404(Atividade, pk=pk)
        if not request.user.is_staff and ativ.modulo.turma.instrutor != request.user:
            return Response(status=403)
        ativ.is_active = False
        ativ.save()
        return Response(status=204)


class AdminStatsView(APIView):
    """Retorna métricas rápidas para o painel do administrador."""
    permission_classes = [IsAdminUser]

    def get(self, request):
        from django.utils.timezone import now
        from django.db.models import Q, Sum, DecimalField, Value, Count, F, FloatField, Case, When
        from django.db.models.functions import Coalesce
        from users.models import Profile as UserProfile
        from .models import Turma, Inscricao

        hoje = now().date()

        turmas_ativas = Turma.objects.filter(
            is_active=True,
            data_inicio__lte=hoje,
            data_fim__gte=hoje,
        ).exclude(
            status_manual__in=[Turma.Status.CANCELADA, Turma.Status.ADIADA, Turma.Status.FINALIZADA]
        ).count()

        turmas_previstas = Turma.objects.filter(
            is_active=True,
            data_inicio__gt=hoje,
        ).exclude(
            status_manual__in=[Turma.Status.CANCELADA, Turma.Status.ADIADA, Turma.Status.FINALIZADA]
        ).count()

        turmas_concluidas = Turma.objects.filter(
            is_active=True,
            data_fim__lt=hoje,
        ).exclude(
            status_manual__in=[Turma.Status.CANCELADA, Turma.Status.ADIADA, Turma.Status.FINALIZADA]
        ).count()

        aprovacoes_pendentes = Inscricao.objects.filter(
            status=Inscricao.Status.PENDENTE
        ).count()

        novos_usuarios_hoje = UserProfile.objects.filter(
            criado_em__date=hoje
        ).count()

        total_matriculas = Inscricao.objects.exclude(
            status__in=[Inscricao.Status.CANCELADO]
        ).count()

        total_usuarios = UserProfile.objects.filter(is_active=True).count()

        custo_total = Turma.objects.filter(
            is_active=True
        ).exclude(
            status_manual__in=[Turma.Status.CANCELADA]
        ).aggregate(
            total=Coalesce(Sum('custo'), Value(0), output_field=DecimalField())
        )['total']

        # Novas Métricas de Desempenho da Gestão
        alunos_aprovados = Inscricao.objects.filter(status=Inscricao.Status.CONCLUIDO).count()
        desistentes = Inscricao.objects.filter(status=Inscricao.Status.CANCELADO).count()
        
        # ─── NOVA LÓGICA DE REPROVAÇÕES (Exatidão Matemática via BD) ───
        
        # 1. Pegamos apenas os reprovados e anotamos quantos eventos a turma tem e quantas presenças o aluno tem
        reprovados_qs = Inscricao.objects.filter(status=Inscricao.Status.REPROVADO).annotate(
            qtd_eventos=Count('turma__eventos', distinct=True),
            qtd_presencas=Count(
                'presencas', 
                filter=Q(presencas__status__in=['PRESENTE', 'JUSTIFICADA']), 
                distinct=True
            )
        ).annotate(
            # 2. Calculamos o percentual de frequência direto na Query (evitando divisão por zero)
            perc_freq=Case(
                When(qtd_eventos=0, then=Value(100.0)),
                default=(F('qtd_presencas') * 100.0) / F('qtd_eventos'),
                output_field=FloatField()
            )
        )

        # 3. Separamos os dados com base na regra de negócio (Falta < 80%)
        # Se a frequência for menor que 80%, a reprovação conta como falta (mesmo se a nota também for baixa)
        reprovados_falta = reprovados_qs.filter(perc_freq__lt=80.0).count()
        
        # Se a frequência for >= 80%, a única razão para reprovação foi a Nota (abaixo de 7 ou nula)
        reprovados_nota = reprovados_qs.filter(perc_freq__gte=80.0).count()

        return Response({
            'turmas_ativas':        turmas_ativas,
            'turmas_previstas':     turmas_previstas,
            'turmas_concluidas':    turmas_concluidas,
            'aprovacoes_pendentes': aprovacoes_pendentes,
            'novos_usuarios_hoje':  novos_usuarios_hoje,
            'total_matriculas':     total_matriculas,
            'total_usuarios':       total_usuarios,
            'custo_total':          float(custo_total),
            'alunos_aprovados':     alunos_aprovados,
            'desistentes':          desistentes,
            'reprovados_nota':      reprovados_nota,
            'reprovados_falta':     reprovados_falta,
        })

class AlunoStatsView(APIView):
    """Retorna métricas rápidas para o painel do aluno/usuário comum."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.db.models import Sum, F, ExpressionWrapper, DecimalField
        from django.db.models.functions import Coalesce
        
        user = request.user

        # Matrículas totais (excluindo canceladas)
        matriculas_realizadas = Inscricao.objects.filter(
            perfil=user
        ).exclude(status=Inscricao.Status.CANCELADO).count()

        # Cursos concluídos
        cursos_concluidos = Inscricao.objects.filter(
            perfil=user,
            status=Inscricao.Status.CONCLUIDO
        ).count()

        # Horas totais (Soma das cargas horárias das turmas concluídas)
        # Mais a soma de carga horária extra de atividades concluídas
        horas_turmas = Inscricao.objects.filter(
            perfil=user,
            status=Inscricao.Status.CONCLUIDO
        ).aggregate(total=Coalesce(Sum('turma__carga_horaria'), 0))['total']

        # Horas extra via EAD/Atividades com recompensa (opcional)
        horas_atividades = ProgressoAtividade.objects.filter(
            inscricao__perfil=user,
            concluido=True,
            atividade__aprovado_admin=True
        ).aggregate(total=Coalesce(Sum('atividade__carga_horaria_recompensa'), 0))['total']

        total_horas_capacitacao = horas_turmas + horas_atividades

        # Média de Presença (Cálculo aproximado baseado em presenças)
        total_presencas = RegistroPresenca.objects.filter(inscricao__perfil=user).count()
        faltas = RegistroPresenca.objects.filter(inscricao__perfil=user, status=RegistroPresenca.Status.FALTA).count()
        
        if total_presencas > 0:
            percentual_presenca = ((total_presencas - faltas) / total_presencas) * 100
        else:
            percentual_presenca = 100.0

        # Encontrar a próxima aula (evento) para o Destaque
        from django.utils import timezone
        agora = timezone.now()
        from cursos.models import EventoTurma
        proximo_evento = EventoTurma.objects.filter(
            turma__inscricoes__perfil=user,
            turma__inscricoes__status=Inscricao.Status.INSCRITO,
            data__gte=agora.date(),
        ).exclude(
            data=agora.date(),
            hora_inicio__lt=agora.time()
        ).order_by('data', 'hora_inicio').first()

        proxima_aula_data = None
        if proximo_evento:
            proxima_aula_data = {
                'turma_id': proximo_evento.turma.id,
                'codigo_turma': proximo_evento.turma.codigo_turma,
                'titulo_curso': proximo_evento.turma.curso.titulo,
                'data': proximo_evento.data.isoformat(),
                'hora_inicio': proximo_evento.hora_inicio.isoformat()[:5],
                'espaco': proximo_evento.get_espaco_display() if proximo_evento.espaco != 'EXTERNO' else proximo_evento.espaco_externo_nome,
            }

        return Response({
            'matriculas_realizadas': matriculas_realizadas,
            'cursos_concluidos': cursos_concluidos,
            'total_horas_capacitacao': total_horas_capacitacao,
            'percentual_presenca': round(percentual_presenca, 1),
            'proxima_aula': proxima_aula_data
        })

class TurmaUpdateView(generics.UpdateAPIView):
    """ PATCH/PUT: Edita uma turma existente (apenas Admin) """
    serializer_class = TurmaSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    queryset = Turma.objects.all()


class AtividadeAprovarView(APIView):
    """ PATCH: Admin aprova ou rejeita uma atividade EAD para contagem de carga horária """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def patch(self, request, pk):
        try:
            atividade = Atividade.objects.get(pk=pk)
        except Atividade.DoesNotExist:
            return Response({"detail": "Atividade não encontrada."}, status=status.HTTP_404_NOT_FOUND)

        acao = request.data.get('acao')  # 'aprovar' ou 'rejeitar'

        if acao == 'aprovar':
            atividade.aprovado_admin = True
            atividade.aprovado_por = request.user
            atividade.aprovado_em = timezone.now()
            atividade.save(update_fields=['aprovado_admin', 'aprovado_por', 'aprovado_em'])
            return Response({"detail": "Atividade aprovada. Carga horária será contabilizada para os alunos."}, status=status.HTTP_200_OK)
        elif acao == 'rejeitar':
            atividade.aprovado_admin = False
            atividade.aprovado_por = None
            atividade.aprovado_em = None
            atividade.save(update_fields=['aprovado_admin', 'aprovado_por', 'aprovado_em'])
            return Response({"detail": "Atividade rejeitada. Não será contabilizada na carga horária."}, status=status.HTTP_200_OK)
        else:
            return Response({"detail": "Ação inválida. Use 'aprovar' ou 'rejeitar'."}, status=status.HTTP_400_BAD_REQUEST)


class AgendaConflitoView(APIView):
    """
    GET: Verifica se um espaço está disponível para uma data e janela de horário.
    Usado pelo frontend com debounce para pintar o formulário de vermelho em tempo real.
    Retorna: { conflito: bool, turnos_bloqueados: ['MANHA', 'TARDE'], mensagem: str }
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        espaco = request.query_params.get('espaco')
        data = request.query_params.get('data')
        hora_inicio_str = request.query_params.get('hora_inicio')
        hora_fim_str = request.query_params.get('hora_fim')

        if not all([espaco, data, hora_inicio_str, hora_fim_str]):
            return Response(
                {"detail": "Parâmetros obrigatórios: espaco, data, hora_inicio, hora_fim."},
                status=status.HTTP_400_BAD_REQUEST
            )

        from datetime import time as dt_time, datetime as dt_datetime

        try:
            hora_inicio = dt_time.fromisoformat(hora_inicio_str)
            hora_fim = dt_time.fromisoformat(hora_fim_str)
        except ValueError:
            return Response(
                {"detail": "Formato de horário inválido. Use HH:MM."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Calcula os turnos que seriam ocupados
        turnos_necessarios = EventoTurma._calcular_turnos_cruzados(hora_inicio, hora_fim)

        # Verifica quais desses turnos já estão ocupados no banco
        turnos_bloqueados = list(
            EspacoAlocado.objects.filter(
                espaco=espaco,
                data=data,
                turno_reserva__in=turnos_necessarios
            ).values_list('turno_reserva', flat=True)
        )

        conflito = len(turnos_bloqueados) > 0

        return Response({
            "conflito": conflito,
            "turnos_bloqueados": turnos_bloqueados,
            "turnos_necessarios": turnos_necessarios,
            "mensagem": (
                f"Conflito detectado! O espaço já está reservado no(s) turno(s): {', '.join(turnos_bloqueados)}."
                if conflito else
                "Horário disponível para reserva."
            )
        })

class TurmaDestroyView(generics.DestroyAPIView):
    queryset = Turma.objects.all()
    permission_classes = [IsAuthenticated, IsAdminUser]

    def destroy(self, request, *args, **kwargs):
        turma = self.get_object()

        if Inscricao.objects.filter(turma=turma).exists():
            return Response(
                {"detail": "Não é possível excluir uma turma com inscrições ativas."}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            self.perform_destroy(turma)

            return Response(
                {"detail": "Turma excluída com sucesso."}, 
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {"detail": f"Erro interno ao excluir turma."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class QuestionarioView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, atividade_id):
        try:
            atividade = Atividade.objects.get(id=atividade_id)
            questionario = Questionario.objects.get(atividade=atividade)
        except (Atividade.DoesNotExist, Questionario.DoesNotExist):
            return Response(status=404)
        
        serializer = QuestionarioSerializer(questionario)
        data = serializer.data
        
        is_gestor = request.user.is_staff or getattr(atividade.modulo.turma, 'instrutor_id', None) == request.user.id
        if not is_gestor:
            for q in data.get('questoes', []):
                for op in q.get('opcoes', []):
                    op.pop('is_correta', None)
        
        return Response(data)

    def post(self, request, atividade_id):
        try:
            atividade = Atividade.objects.get(id=atividade_id)
        except Atividade.DoesNotExist:
            return Response(status=404)
            
        if not request.user.is_staff and atividade.modulo.turma.instrutor != request.user:
            return Response(status=403)

        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        data['atividade'] = atividade.id

        try:
            questionario = Questionario.objects.get(atividade=atividade)
            serializer = QuestionarioSerializer(questionario, data=data, partial=True)
        except Questionario.DoesNotExist:
            serializer = QuestionarioSerializer(data=data)

        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)


class QuestionarioCopiarView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, atividade_origem_id, atividade_destino_id):
        try:
            q_origem = Questionario.objects.get(atividade_id=atividade_origem_id)
            atividade_destino = Atividade.objects.get(id=atividade_destino_id)
        except (Questionario.DoesNotExist, Atividade.DoesNotExist):
            return Response(status=404)

        if not request.user.is_staff and atividade_destino.modulo.turma.instrutor != request.user:
            return Response(status=403)

        from django.db import transaction
        with transaction.atomic():
            Questionario.objects.filter(atividade=atividade_destino).delete()
            
            q_novo = Questionario.objects.create(
                atividade=atividade_destino,
                titulo=q_origem.titulo,
                descricao=q_origem.descricao,
                tentativas_permitidas=q_origem.tentativas_permitidas,
                tempo_limite_minutos=q_origem.tempo_limite_minutos,
                nota_minima_aprovacao=q_origem.nota_minima_aprovacao
            )
            
            for questao in q_origem.questoes.all():
                q_nova = Questao.objects.create(
                    questionario=q_novo,
                    enunciado=questao.enunciado,
                    ordem=questao.ordem,
                    valor=questao.valor
                )
                for opcao in questao.opcoes.all():
                    Opcao.objects.create(
                        questao=q_nova,
                        texto=opcao.texto,
                        is_correta=opcao.is_correta,
                        ordem=opcao.ordem
                    )
        
        return Response({"detail": "Questionário copiado com sucesso"}, status=201)

class SubmeterQuestionarioView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, atividade_id):
        from decimal import Decimal
        from django.db import transaction
        try:
            atividade = Atividade.objects.get(id=atividade_id)
            questionario = Questionario.objects.get(atividade=atividade)
            inscricao = Inscricao.objects.get(perfil=request.user, turma=atividade.modulo.turma)
        except (Atividade.DoesNotExist, Questionario.DoesNotExist, Inscricao.DoesNotExist):
            return Response({"detail": "Não encontrado ou acesso negado"}, status=404)

        progresso, _ = ProgressoAtividade.objects.get_or_create(inscricao=inscricao, atividade=atividade)
        
        tentativas_feitas = TentativaQuestionario.objects.filter(progresso=progresso).count()
        if tentativas_feitas >= questionario.tentativas_permitidas:
            return Response({"detail": "Número máximo de tentativas atingido."}, status=403)

        tentativa = TentativaQuestionario.objects.create(
            progresso=progresso,
            questionario=questionario,
            numero_tentativa=tentativas_feitas + 1
        )

        respostas_data = request.data.get('respostas', [])
        
        pontuacao_obtida = Decimal('0.00')
        pontuacao_total = Decimal('0.00')

        with transaction.atomic():
            for questao in questionario.questoes.all():
                pontuacao_total += questao.valor
                resp = next((r for r in respostas_data if str(r.get('questao_id')) == str(questao.id)), None)
                if resp:
                    opcao_id = resp.get('opcao_id')
                    try:
                        opcao_selecionada = Opcao.objects.get(id=opcao_id, questao=questao)
                        RespostaAluno.objects.create(
                            tentativa=tentativa,
                            questao=questao,
                            opcao_selecionada=opcao_selecionada
                        )
                        if opcao_selecionada.is_correta:
                            pontuacao_obtida += questao.valor
                    except Opcao.DoesNotExist:
                        pass
        
        nota_normalizada = Decimal('0.00')
        if pontuacao_total > 0:
            nota_normalizada = (pontuacao_obtida / pontuacao_total) * Decimal('10.00')
            nota_normalizada = round(nota_normalizada, 2)
            
        tentativa.nota_obtida = nota_normalizada
        tentativa.fim = timezone.now()
        tentativa.finalizada = True
        tentativa.save()

        if not progresso.nota_obtida or nota_normalizada > progresso.nota_obtida:
            progresso.nota_obtida = nota_normalizada
            progresso.concluido = True
            progresso.save()
            
            progressos_quest = ProgressoAtividade.objects.filter(
                inscricao=inscricao, 
                nota_obtida__isnull=False
            )
            soma = sum(p.nota_obtida for p in progressos_quest)
            count = progressos_quest.count()
            if count > 0:
                inscricao.nota = round(soma / count, 2)
                inscricao.save()

        return Response({
            "nota": nota_normalizada,
            "tentativa_numero": tentativa.numero_tentativa,
            "detail": f"Você obteve {nota_normalizada} de 10."
        }, status=200)

class QuestionarioView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, atividade_id):
        try:
            atividade = Atividade.objects.get(id=atividade_id)
            questionario = Questionario.objects.get(atividade=atividade)
        except (Atividade.DoesNotExist, Questionario.DoesNotExist):
            return Response(status=404)
        
        serializer = QuestionarioSerializer(questionario)
        data = serializer.data
        
        is_gestor = request.user.is_staff or getattr(atividade.modulo.turma, 'instrutor_id', None) == request.user.id
        if not is_gestor:
            for q in data.get('questoes', []):
                for op in q.get('opcoes', []):
                    op.pop('is_correta', None)
        
        return Response(data)

    def post(self, request, atividade_id):
        if not request.user.is_staff:
            return Response(status=403)
        try:
            atividade = Atividade.objects.get(id=atividade_id)
        except Atividade.DoesNotExist:
            return Response(status=404)

        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        data['atividade'] = atividade.id

        try:
            questionario = Questionario.objects.get(atividade=atividade)
            serializer = QuestionarioSerializer(questionario, data=data, partial=True)
        except Questionario.DoesNotExist:
            serializer = QuestionarioSerializer(data=data)

        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)


class QuestionarioCopiarView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, atividade_origem_id, atividade_destino_id):
        if not request.user.is_staff:
            return Response(status=403)
        
        try:
            q_origem = Questionario.objects.get(atividade_id=atividade_origem_id)
            atividade_destino = Atividade.objects.get(id=atividade_destino_id)
        except (Questionario.DoesNotExist, Atividade.DoesNotExist):
            return Response(status=404)

        from django.db import transaction
        with transaction.atomic():
            Questionario.objects.filter(atividade=atividade_destino).delete()
            
            q_novo = Questionario.objects.create(
                atividade=atividade_destino,
                titulo=q_origem.titulo,
                descricao=q_origem.descricao,
                tentativas_permitidas=q_origem.tentativas_permitidas,
                tempo_limite_minutos=q_origem.tempo_limite_minutos,
                nota_minima_aprovacao=q_origem.nota_minima_aprovacao
            )
            
            for questao in q_origem.questoes.all():
                q_nova = Questao.objects.create(
                    questionario=q_novo,
                    enunciado=questao.enunciado,
                    ordem=questao.ordem,
                    valor=questao.valor
                )
                for opcao in questao.opcoes.all():
                    Opcao.objects.create(
                        questao=q_nova,
                        texto=opcao.texto,
                        is_correta=opcao.is_correta,
                        ordem=opcao.ordem
                    )
        
        return Response({"detail": "Questionário copiado com sucesso"}, status=201)

class SubmeterQuestionarioView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, atividade_id):
        from decimal import Decimal
        from django.db import transaction
        try:
            atividade = Atividade.objects.get(id=atividade_id)
            questionario = Questionario.objects.get(atividade=atividade)
            inscricao = Inscricao.objects.get(perfil=request.user, turma=atividade.modulo.turma)
        except (Atividade.DoesNotExist, Questionario.DoesNotExist, Inscricao.DoesNotExist):
            return Response({"detail": "Não encontrado ou acesso negado"}, status=404)

        progresso, _ = ProgressoAtividade.objects.get_or_create(inscricao=inscricao, atividade=atividade)
        
        tentativas_feitas = TentativaQuestionario.objects.filter(progresso=progresso).count()
        if tentativas_feitas >= questionario.tentativas_permitidas:
            return Response({"detail": "Número máximo de tentativas atingido."}, status=403)

        tentativa = TentativaQuestionario.objects.create(
            progresso=progresso,
            questionario=questionario,
            numero_tentativa=tentativas_feitas + 1
        )

        respostas_data = request.data.get('respostas', [])
        
        pontuacao_obtida = Decimal('0.00')
        pontuacao_total = Decimal('0.00')

        with transaction.atomic():
            for questao in questionario.questoes.all():
                pontuacao_total += questao.valor
                resp = next((r for r in respostas_data if str(r.get('questao_id')) == str(questao.id)), None)
                if resp:
                    opcao_id = resp.get('opcao_id')
                    try:
                        opcao_selecionada = Opcao.objects.get(id=opcao_id, questao=questao)
                        RespostaAluno.objects.create(
                            tentativa=tentativa,
                            questao=questao,
                            opcao_selecionada=opcao_selecionada
                        )
                        if opcao_selecionada.is_correta:
                            pontuacao_obtida += questao.valor
                    except Opcao.DoesNotExist:
                        pass
        
        nota_normalizada = Decimal('0.00')
        if pontuacao_total > 0:
            nota_normalizada = (pontuacao_obtida / pontuacao_total) * Decimal('10.00')
            nota_normalizada = round(nota_normalizada, 2)
            
        tentativa.nota_obtida = nota_normalizada
        tentativa.fim = timezone.now()
        tentativa.finalizada = True
        tentativa.save()

        if not progresso.nota_obtida or nota_normalizada > progresso.nota_obtida:
            progresso.nota_obtida = nota_normalizada
            progresso.concluido = True
            progresso.save()
            
            progressos_quest = ProgressoAtividade.objects.filter(
                inscricao=inscricao, 
                nota_obtida__isnull=False
            )
            soma = sum(p.nota_obtida for p in progressos_quest)
            count = progressos_quest.count()
            if count > 0:
                inscricao.nota = round(soma / count, 2)
                inscricao.save()

        return Response({
            "nota": nota_normalizada,
            "tentativa_numero": tentativa.numero_tentativa,
            "detail": f"Você obteve {nota_normalizada} de 10."
        }, status=200)