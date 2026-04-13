from rest_framework import generics
from rest_framework.permissions import AllowAny, IsAuthenticated
from .models import Curso
from .serializers import CursoSerializer, TurmaSerializer
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