from rest_framework import generics
from rest_framework.permissions import AllowAny

from .models import Curso
from .serializers import CursoSerializer


class CursoListView(generics.ListAPIView):
    """
    GET /api/cursos/
    Retorna todos os cursos com ativo=True, ordenados por data de início.
    Endpoint público — não exige autenticação para que o catálogo seja acessível
    antes do login (ex: página inicial do portal).
    """
    serializer_class = CursoSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        return Curso.objects.filter(ativo=True).order_by('-data_inicio')
