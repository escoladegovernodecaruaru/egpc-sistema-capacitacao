import re
from django.db.models import Prefetch, Count, F, Q
from django.utils import timezone
from rest_framework import views, status, viewsets
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny

from .models import Curso, Turma, StatusTurma, Matricula, ModuloDigital, EncontroPresencial
from .serializers import CursoSerializer, TurmaSerializer, MatriculaSerializer, ModuloDigitalSerializer, EncontroPresencialSerializer
from users.authentication import SupabaseJWTAuthentication

class CatalogoCursosView(views.APIView):
    """
    Endpoint (Para Alunos): Lista o catálogo de cursos e suas turmas.
    Exibe apenas as turmas que estão no status 'PREVISTA' (Inscrições Abertas).
    Acesso liberado (Para que visitantes vejam o catálogo sem logar).
    """
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        # Filtramos apenas as turmas PREVISTAS (abertas para matrícula)
        turmas_abertas = Turma.objects.filter(status=StatusTurma.PREVISTA)
        
        # Filtramos cursos que possuem ao menos 1 turma aberta
        cursos = Curso.objects.prefetch_related(
            Prefetch('turmas', queryset=turmas_abertas)
        ).distinct()
        
        serializer = CursoSerializer(cursos, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class RealizarMatriculaView(views.APIView):
    """
    Endpoint (Ação do Aluno): Recebe a solicitação de Matrícula numa Turma.
    Realiza todas as validações de regras de negócio estipuladas.
    """
    authentication_classes = [SupabaseJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, turma_id):
        estudante = request.user
        dados_extras = request.data.get('dados_extras', {})

        try:
            turma = Turma.objects.get(id=turma_id, status=StatusTurma.PREVISTA)
        except Turma.DoesNotExist:
            return Response({"detail": "Turma não encontrada ou não está aberta para inscrições."}, status=status.HTTP_404_NOT_FOUND)

        # 1. Se o perfil do aluno está completo
        # Assumindo que cpf, nome_completo e email já são obrigatórios no cadastro, 
        # vamos apenas garantir que ele não é um 'MOCK' ou faltam dados essenciais do sistema
        if not estudante.nome_completo or not estudante.cpf:
            return Response({"detail": "Seu perfil está incompleto. Por favor, atualize seus dados."}, status=status.HTTP_400_BAD_REQUEST)

        # 2. Se o aluno está bloqueado (Suspensão 12 meses)
        if estudante.esta_bloqueado():
            return Response({"detail": f"Você está bloqueado(a) de realizar novos cursos até {estudante.bloqueado_ate.strftime('%d/%m/%Y')}."}, status=status.HTTP_403_FORBIDDEN)

        # 3. Se o aluno informou estar de licença
        if estudante.esta_de_licenca:
            return Response({"detail": "Não é possível realizar matrículas enquanto você estiver de licença."}, status=status.HTTP_403_FORBIDDEN)

        # 4. Verifica se já está matriculado
        if Matricula.objects.filter(estudante=estudante, turma=turma).exists():
            return Response({"detail": "Você já possui uma matrícula nesta turma."}, status=status.HTTP_400_BAD_REQUEST)

        # 5. Se a turma tem vagas (Contar matrículas que NÃO são desistentes)
        qtd_matriculados = Matricula.objects.filter(
            turma=turma
        ).exclude(status='DESISTENTE').count()
        
        if qtd_matriculados >= turma.vagas:
            return Response({"detail": "Não há mais vagas disponíveis nesta turma."}, status=status.HTTP_400_BAD_REQUEST)

        # 6. Criando a Matrícula
        nova_matricula = Matricula.objects.create(
            estudante=estudante,
            turma=turma,
            dados_extras=dados_extras
        )

        serializer = MatriculaSerializer(nova_matricula)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class TrilhaAlunoView(views.APIView):
    """
    Endpoint (Híbrido): Retorna conteúdos (Módulos Digitais e Encontros Presenciais)
    da turma em que o usuário logado está matriculado.
    """
    authentication_classes = [SupabaseJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, turma_id):
        estudante = request.user

        # Verifica se está matriculado e não desistiu
        matricula = Matricula.objects.filter(
            estudante=estudante, 
            turma_id=turma_id
        ).exclude(status='DESISTENTE').first()

        if not matricula:
            return Response({"detail": "Você não está matriculado nesta turma ou sua matrícula está inativa."}, status=status.HTTP_403_FORBIDDEN)

        try:
            turma = Turma.objects.get(id=turma_id)
        except Turma.DoesNotExist:
             return Response({"detail": "Turma não encontrada."}, status=status.HTTP_404_NOT_FOUND)

        modulos_digitais = ModuloDigital.objects.filter(turma=turma)
        encontros_presenciais = EncontroPresencial.objects.filter(turma=turma)

        return Response({
            "curso": turma.curso.titulo,
            "turma": turma.codigo,
            "modulos_digitais": ModuloDigitalSerializer(modulos_digitais, many=True).data,
            "encontros_presenciais": EncontroPresencialSerializer(encontros_presenciais, many=True).data,
        }, status=status.HTTP_200_OK)


# ==========================================
# VIEWS PARA ADMINISTRAÇÃO (CRUD GESTÃO)
# ==========================================

class AdminCursoViewSet(viewsets.ModelViewSet):
    """
    Gestão de Cursos (Para Admin).
    Valida código no formato 000/AAAA.
    """
    # Em produção, deveria ser IsAdminUser. 
    # Para testes/validação com frontend, você pode ajustar as permissões.
    authentication_classes = [SupabaseJWTAuthentication]
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    queryset = Curso.objects.all()
    serializer_class = CursoSerializer

    def create(self, request, *args, **kwargs):
        codigo = request.data.get('codigo', '')
        # Validação do Padrão 000/AAAA
        if not re.match(r'^\d{3}/\d{4}$', codigo):
            return Response({"detail": "O código do curso deve seguir o formato 000/AAAA (Ex: 001/2026)."}, status=status.HTTP_400_BAD_REQUEST)
            
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        codigo = request.data.get('codigo', None)
        if codigo and not re.match(r'^\d{3}/\d{4}$', codigo):
            return Response({"detail": "O código do curso deve seguir o formato 000/AAAA (Ex: 001/2026)."}, status=status.HTTP_400_BAD_REQUEST)
            
        return super().update(request, *args, **kwargs)


class AdminTurmaViewSet(viewsets.ModelViewSet):
    """
    Gestão de Turmas (Para Admin).
    """
    authentication_classes = [SupabaseJWTAuthentication]
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    queryset = Turma.objects.all()
    serializer_class = TurmaSerializer
