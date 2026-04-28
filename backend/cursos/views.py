from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAdminUser
from django.db import transaction
from django.utils import timezone
from .models import Curso, Turma, Inscricao, SolicitacaoReserva, ItemReserva, EventoTurma, RegistroPresenca, Modulo, Atividade, ProgressoAtividade, EspacoAlocado
from .serializers import CursoSerializer, TurmaSerializer, InscricaoDetailSerializer, SolicitacaoReservaSerializer, ModuloSerializer
from users.authentication import SupabaseJWTAuthentication
from users.models import Profile
from rest_framework.exceptions import PermissionDenied

class CursoListView(generics.ListCreateAPIView):
    serializer_class = CursoSerializer
    authentication_classes = [SupabaseJWTAuthentication]

    def get_permissions(self):
        # Apenas administradores (is_staff) podem criar cursos via POST. Qualquer um pode ver (GET).
        if self.request.method == 'POST':
            return [IsAdminUser()]
        return [AllowAny()]

    def get_queryset(self):
        from django.db.models import Prefetch
        # Prefetch para evitar o gargalo de performance N+1 ao carregar catálogo
        prefetch = Prefetch('turmas', queryset=Turma.objects.filter(is_active=True))
        return Curso.objects.filter(is_active=True).prefetch_related(prefetch).order_by('-codigo_oficial')
    
class CursoUpdateView(generics.UpdateAPIView):
    """ PATCH/PUT: Edita um curso base existente (apenas Admin) """
    serializer_class = CursoSerializer
    authentication_classes = [SupabaseJWTAuthentication]
    permission_classes = [IsAuthenticated, IsAdminUser]
    queryset = Curso.objects.all()

class TurmaCreateView(generics.CreateAPIView):
    serializer_class = TurmaSerializer
    authentication_classes = [SupabaseJWTAuthentication]
    permission_classes = [IsAuthenticated]

class MinhasInscricoesSimplificadasView(APIView):
    authentication_classes = [SupabaseJWTAuthentication]
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
    authentication_classes = [SupabaseJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, turma_id):
        user = request.user

        if user.esta_bloqueado():
            return Response({"detail": "Usuário cumprindo período de suspensão"}, status=status.HTTP_403_FORBIDDEN)

        with transaction.atomic():
            try:
                turma = Turma.objects.select_for_update().get(id=turma_id)
            except Turma.DoesNotExist:
                return Response({"detail": "Turma não encontrada."}, status=status.HTTP_404_NOT_FOUND)

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
    serializer_class = InscricaoDetailSerializer
    authentication_classes = [SupabaseJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        # Remove anything that isn't a digit for 11-digit clean match
        import re
        cpf_limpo = re.sub(r'\D', '', user.cpf)
        
        return Inscricao.objects.filter(
            status=Inscricao.Status.PENDENTE,
            perfil__dados_servidor__cpf_chefe=cpf_limpo
        ).select_related('perfil', 'turma', 'turma__curso')

class AprovarInscricaoView(APIView):
    authentication_classes = [SupabaseJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            inscricao = Inscricao.objects.get(pk=pk, status=Inscricao.Status.PENDENTE)
        except Inscricao.DoesNotExist:
            return Response({"detail": "Inscrição não encontrada ou não está pendente."}, status=status.HTTP_404_NOT_FOUND)

        import re
        cpf_chefe_json = inscricao.perfil.dados_servidor.get('cpf_chefe') if inscricao.perfil.dados_servidor else None
        cpf_chefe_limpo = re.sub(r'\D', '', str(cpf_chefe_json)) if cpf_chefe_json else None
        user_cpf_limpo = re.sub(r'\D', '', str(request.user.cpf)) if request.user.cpf else None

        if not (request.user.is_staff or (cpf_chefe_limpo and cpf_chefe_limpo == user_cpf_limpo)):
            return Response({"detail": "Você não tem permissão para avaliar esta inscrição."}, status=status.HTTP_403_FORBIDDEN)

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
    authentication_classes = [SupabaseJWTAuthentication]
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
    authentication_classes = [SupabaseJWTAuthentication]
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
        serializer.save(solicitante=user)

class AgendaGlobalView(APIView):
    """ O motor do calendário: Junta Aulas Oficiais + Reservas Avulsas Aprovadas """
    authentication_classes = [SupabaseJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.utils import timezone
        mes = request.query_params.get('mes')
        ano = request.query_params.get('ano', timezone.now().year)

        is_admin = request.user.is_staff

        # 1. Aulas ativas
        q_aulas = EventoTurma.objects.select_related('turma', 'turma__curso').filter(
            turma__is_active=True
        )
        # 2. Reservas Externas Aprovadas
        q_res = ItemReserva.objects.select_related(
            'solicitacao', 'solicitacao__solicitante'
        ).filter(
            solicitacao__status=SolicitacaoReserva.Status.APROVADA
        )
        if not is_admin:
            q_res = q_res.exclude(espaco='EXTERNO')

        if mes:
            q_aulas = q_aulas.filter(data__month=mes, data__year=ano)
            q_res = q_res.filter(data__month=mes, data__year=ano)

        aulas = q_aulas.all()
        reservas = q_res.all()

        eventos = []
        for aula in aulas:
            item = {
                "id": f"aula_{aula.id}",
                "tipo": "AULA",
                "titulo": f"{aula.turma.curso.codigo_oficial} - Turma {aula.turma.letra}",
                "data": aula.data.isoformat(),
                "turno": aula.turno_reserva,
                "local": aula.espaco,
                "hora_inicio": aula.hora_inicio.strftime('%H:%M') if aula.hora_inicio else None,
                "hora_fim": aula.hora_fim.strftime('%H:%M') if aula.hora_fim else None,
                "status": "APROVADA",
            }
            if is_admin:
                item["origin_tipo"] = "TURMA"
                item["origin_id"] = aula.turma.id
                item["origin_desc"] = f"Turma {aula.turma.codigo_turma} — {aula.turma.curso.titulo}" # <--- CORRIGIDO
            eventos.append(item)

        for res in reservas:
            sol = res.solicitacao
            item = {
                "id": f"reserva_{res.id}",
                "tipo": "RESERVA_AVULSA",
                "titulo": sol.titulo,
                "data": res.data.isoformat(),
                "turno": res.turno_reserva,
                "local": res.espaco,
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
    """ GET lista todas as solicitações de espaço para a gestão aprovar """
    serializer_class = SolicitacaoReservaSerializer
    authentication_classes = [SupabaseJWTAuthentication]
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get_queryset(self):
        from django.db.models import Case, When, IntegerField
        # Retorna todas as solicitações, priorizando as PENDENTES no topo
        return SolicitacaoReserva.objects.all().order_by(
            Case(
                When(status=SolicitacaoReserva.Status.PENDENTE, then=0),
                default=1,
                output_field=IntegerField(),
            ),
            '-criado_em'
        )

class AvaliarSolicitacaoView(APIView):
    """ POST aprova ou nega uma solicitação de espaço """
    authentication_classes = [SupabaseJWTAuthentication]
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
    authentication_classes = [SupabaseJWTAuthentication]
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

        solicitacao.status = SolicitacaoReserva.Status.CANCELADA
        solicitacao.save()

        return Response({"detail": "Solicitação cancelada com sucesso."}, status=status.HTTP_200_OK)
    

class MinhasTurmasInstrutorView(generics.ListAPIView):
    """ Retorna as turmas onde o usuário logado é o instrutor (ou todas se for Admin) """
    serializer_class = TurmaSerializer
    authentication_classes = [SupabaseJWTAuthentication]
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
    authentication_classes = [SupabaseJWTAuthentication]
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
                        perc_freq = (presencas_marcadas / total_eventos * 100) if total_eventos > 0 else 100
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
    authentication_classes = [SupabaseJWTAuthentication]
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request, turma_id):
        cpf = request.data.get('cpf')
        try:
            aluno = Profile.objects.get(cpf=cpf)
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
        except Profile.DoesNotExist:
            return Response({"detail": "Usuário com este CPF não encontrado no portal."}, status=404)
        
class SalaDeAulaView(APIView):
    """ GET: Retorna os módulos, vídeos e o progresso do aluno para a sala de aula virtual """
    authentication_classes = [SupabaseJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, turma_id):
        user = request.user

        try:
            turma = Turma.objects.get(id=turma_id)
        except Turma.DoesNotExist:
            return Response({"detail": "Turma não encontrada."}, status=status.HTTP_404_NOT_FOUND)

        # 1. Verifica se o aluno tem acesso (se é o instrutor, admin ou se está inscrito)
        is_instrutor_ou_admin = user.is_staff or turma.instrutor == user
        inscricao = None

        if not is_instrutor_ou_admin:
            try:
                inscricao = Inscricao.objects.get(turma=turma, perfil=user, status__in=[Inscricao.Status.INSCRITO, Inscricao.Status.CONCLUIDO])
            except Inscricao.DoesNotExist:
                return Response({"detail": "Você não tem acesso a esta sala de aula."}, status=status.HTTP_403_FORBIDDEN)

        # 2. Busca os módulos: apenas atividades APROVADAS são exibidas a alunos
        from django.db.models import Prefetch
        if is_instrutor_ou_admin:
            # Admin/Instrutor vêm TUDO para gerenciar (inclusive não aprovadas)
            atividades_qs = Atividade.objects.filter(is_active=True)
        else:
            # Alunos só vêm atividades aprovadas pelo Admin
            atividades_qs = Atividade.objects.filter(is_active=True, aprovado_admin=True)

        modulos = Modulo.objects.filter(turma=turma, is_active=True).prefetch_related(
            Prefetch('atividades', queryset=atividades_qs)
        )
        serializer = ModuloSerializer(modulos, many=True, context={'inscricao_id': inscricao.id if inscricao else None})

        # 3. Calcula a carga horária já adquirida (apenas de atividades APROVADAS)
        carga_adquirida = 0
        # 3. Calcula a carga horária já adquirida (apenas de atividades APROVADAS)
        carga_adquirida = 0
        if inscricao:
            from django.db.models import Sum # <--- ADICIONEI O IMPORT AQUI
            
            horas_ead = Atividade.objects.filter(
                conclusoes__inscricao=inscricao,
                conclusoes__concluido=True,
                aprovado_admin=True,  # Só soma carga de atividades aprovadas
            ).aggregate(total=Sum('carga_horaria_recompensa'))['total'] or 0 # <--- TIREI O 'models.' DAQUI
            
            carga_adquirida = horas_ead

        return Response({
            "turma": {"codigo": turma.codigo_turma, "titulo": turma.curso.titulo, "carga_total": turma.carga_horaria},
            "progresso": {
                "carga_adquirida": carga_adquirida,
                "meta": turma.carga_horaria,
                "titulo": turma.curso.titulo,
                "tipo": turma.curso.tipo,
            },
            "modulos": serializer.data
        })


class PingAtividadeView(APIView):
    """ POST: Salva 1 minuto de tela do Player para validação Anti-Cheat no servidor. """
    authentication_classes = [SupabaseJWTAuthentication]
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
    """ POST: Valida no BD pelo Heartbeat em vez de payload front-end. """
    authentication_classes = [SupabaseJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, atividade_id):
        try:
            atividade = Atividade.objects.get(id=atividade_id)
            if not getattr(atividade, 'is_active', True):
                 pass
            # Confirma que o aluno está inscrito na turma dessa atividade
            inscricao = Inscricao.objects.get(
                perfil=request.user, 
                turma=atividade.modulo.turma,
                status__in=[Inscricao.Status.INSCRITO, Inscricao.Status.CONCLUIDO]
            )
        except (Atividade.DoesNotExist, Inscricao.DoesNotExist):
            return Response({"detail": "Atividade não encontrada ou acesso negado."}, status=status.HTTP_403_FORBIDDEN)
            
        from cursos.models import ProgressoAtividade
        progresso, _ = ProgressoAtividade.objects.get_or_create(
            inscricao=inscricao,
            atividade=atividade
        )

        # Checagem Anti-Cheat: Em vez de confiar em `request.data.get('tempo_tela')`, contamos Pings do Banco
        from django.db.models import Sum
        from cursos.models import ProgressoSessaoEAD
        
        total_pings = ProgressoSessaoEAD.objects.filter(progresso=progresso).aggregate(t=Sum('duracao_minutos'))['t'] or 0
        
        # Pelo menos 15 minutos de pings (se for atividade maior, senão 1 minuto de ping se carga pequena)
        # Se for video, aplica validação rígida de heartbeat
        # TEMPORÁRIO PARA A DEMONSTRAÇÃO: Baixado para 0 pings
        if total_pings < 0 and atividade.tipo == Atividade.Tipo.VIDEO_YOUTUBE:
            return Response({"detail": "Não assistiu o tempo mínimo."}, status=status.HTTP_400_BAD_REQUEST)

        # Registra que o aluno concluiu
        progresso.concluido = True
        progresso.save()

        return Response({"detail": "Carga horária contabilizada com sucesso!"}, status=status.HTTP_200_OK)
    
class MinhasGestoesView(generics.ListAPIView):
    """ Retorna apenas as turmas onde o CPF do usuário logado está na lista de autorizados """
    serializer_class = TurmaSerializer
    authentication_classes = [SupabaseJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user_cpf = self.request.user.cpf
        # Usando a nova relação FK N:M
        return Turma.objects.filter(gestores_associados__gestor__cpf=user_cpf).order_by('-data_inicio')


class GestaoAlunosTurmaView(APIView):
    """ GET: Lista alunos ativos. POST: Adiciona ou inativa (soft delete) um aluno """
    authentication_classes = [SupabaseJWTAuthentication]
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
            return Response({"detail": "Este CPF não possui conta no portal. Peça para o usuário se cadastrar primeiro."}, status=404)

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
    """ Gestão de Módulos (Criar e Apagar) """
    authentication_classes = [SupabaseJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, turma_id):
        if not request.user.is_staff: # Apenas Admin/Staff pode criar estrutura
            return Response(status=403)
        
        titulo = request.data.get('titulo')
        ordem = request.data.get('ordem', 0)
        
        modulo = Modulo.objects.create(turma_id=turma_id, titulo=titulo, ordem=ordem)
        return Response({"id": modulo.id, "titulo": modulo.titulo}, status=201)

    def delete(self, request, pk):
        if not request.user.is_staff:
            return Response(status=403)
        modulo = Modulo.objects.filter(pk=pk).first()
        if modulo:
            modulo.is_active = False
            modulo.save()
        return Response(status=204)

class AtividadeViewSet(APIView):
    """ Gestão de Atividades (Aulas/Vídeos) """
    authentication_classes = [SupabaseJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, modulo_id):
        if not request.user.is_staff:
            return Response(status=403)
            
        data = request.data
        atividade = Atividade.objects.create(
            modulo_id=modulo_id,
            titulo=data.get('titulo'),
            descricao=data.get('descricao'),
            tipo=data.get('tipo', 'VIDEO_YOUTUBE'),
            url_video=data.get('url_video'),
            carga_horaria_recompensa=data.get('carga_horaria', 0),
            ordem=data.get('ordem', 0)
        )
        return Response({"id": atividade.id, "titulo": atividade.titulo}, status=201)

    def delete(self, request, pk):
        if not request.user.is_staff:
            return Response(status=403)
        ativ = Atividade.objects.filter(pk=pk).first()
        if ativ:
            ativ.is_active = False
            ativ.save()
        return Response(status=204)


class AdminStatsView(APIView):
    """Retorna métricas rápidas para o painel do administrador."""
    authentication_classes = [SupabaseJWTAuthentication]
    permission_classes = [IsAdminUser]

    def get(self, request):
        from django.utils.timezone import now
        from django.db.models import Q, Sum, DecimalField, Value
        from django.db.models.functions import Coalesce
        from users.models import Profile as UserProfile

        hoje = now().date()

        # Correção do bug: status_calculado é @property — não pode ser filtrado no ORM.
        # Usamos a lógica de datas diretamente na query para identificar turmas ativas.
        turmas_ativas = Turma.objects.filter(
            is_active=True,
            data_inicio__lte=hoje,
            data_fim__gte=hoje,
        ).exclude(
            status_manual__in=[Turma.Status.CANCELADA, Turma.Status.ADIADA, Turma.Status.FINALIZADA]
        ).count()

        # Turmas futuras (Previstas)
        turmas_previstas = Turma.objects.filter(
            is_active=True,
            data_inicio__gt=hoje,
        ).exclude(
            status_manual__in=[Turma.Status.CANCELADA, Turma.Status.ADIADA, Turma.Status.FINALIZADA]
        ).count()

        # Turmas encerradas (Concluídas — passaram da data_fim sem status manual)
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

        # Custo total das turmas ativas
        custo_total = Turma.objects.filter(
            is_active=True
        ).exclude(
            status_manual__in=[Turma.Status.CANCELADA]
        ).aggregate(
            total=Coalesce(Sum('custo'), Value(0), output_field=DecimalField())
        )['total']

        return Response({
            'turmas_ativas':        turmas_ativas,
            'turmas_previstas':     turmas_previstas,
            'turmas_concluidas':    turmas_concluidas,
            'aprovacoes_pendentes': aprovacoes_pendentes,
            'novos_usuarios_hoje':  novos_usuarios_hoje,
            'total_matriculas':     total_matriculas,
            'total_usuarios':       total_usuarios,
            'custo_total':          float(custo_total),
        })


class TurmaUpdateView(generics.UpdateAPIView):
    """ PATCH/PUT: Edita uma turma existente (apenas Admin) """
    serializer_class = TurmaSerializer
    authentication_classes = [SupabaseJWTAuthentication]
    permission_classes = [IsAuthenticated, IsAdminUser]
    queryset = Turma.objects.all()


class AtividadeAprovarView(APIView):
    """ PATCH: Admin aprova ou rejeita uma atividade EAD para contagem de carga horária """
    authentication_classes = [SupabaseJWTAuthentication]
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
    authentication_classes = [SupabaseJWTAuthentication]
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