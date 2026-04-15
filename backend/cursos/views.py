from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAdminUser
from django.db import transaction
from django.utils import timezone
from .models import Curso, Turma, Inscricao
from .serializers import CursoSerializer, TurmaSerializer, InscricaoDetailSerializer
from users.authentication import SupabaseJWTAuthentication

class CursoListView(generics.ListCreateAPIView):
    serializer_class = CursoSerializer
    authentication_classes = [SupabaseJWTAuthentication]

    def get_permissions(self):
        # Apenas usuários logados podem criar (POST). Qualquer um pode ver (GET).
        if self.request.method == 'POST':
            return [IsAuthenticated()]
        return [AllowAny()]

    def get_queryset(self):
        return Curso.objects.filter(is_active=True).order_by('-codigo_oficial')

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

            ja_inscrito = Inscricao.objects.filter(
                perfil=user,
                turma__curso=turma.curso
            ).exclude(status=Inscricao.Status.CANCELADO).exists()

            if ja_inscrito:
                return Response({"detail": "Você já está inscrito ou aguardando aprovação para este curso"}, status=status.HTTP_400_BAD_REQUEST)

            if user.tipo_usuario == 'CIDADAO':
                novo_status = Inscricao.Status.INSCRITO
            else:
                novo_status = Inscricao.Status.PENDENTE

            try:
                inscricao = Inscricao(
                    perfil=user,
                    turma=turma,
                    status=novo_status
                )
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
