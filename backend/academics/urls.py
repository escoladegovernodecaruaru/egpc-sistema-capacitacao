from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    CatalogoCursosView,
    RealizarMatriculaView,
    TrilhaAlunoView,
    AdminCursoViewSet,
    AdminTurmaViewSet
)

app_name = 'academics'

# Rotas de Administração (CRUD) via ViewSets
admin_router = DefaultRouter()
admin_router.register(r'cursos', AdminCursoViewSet, basename='admin-curso')
admin_router.register(r'turmas', AdminTurmaViewSet, basename='admin-turma')

urlpatterns = [
    # ---- Rotas Públicas / Aluno ----
    
    # Lista de cursos e turmas disponíveis
    path('catalogo/', CatalogoCursosView.as_view(), name='catalogo'),
    
    # Realizar matrícula numa turma específica
    path('turmas/<uuid:turma_id>/matricular/', RealizarMatriculaView.as_view(), name='realizar_matricula'),
    
    # Visualizar a trilha de aprendizado de uma turma especifica (módulos e encontros)
    path('trilha/<uuid:turma_id>/', TrilhaAlunoView.as_view(), name='trilha_aluno'),


    # ---- Rotas de Administração (Requerem is_staff/is_superuser) ----
    path('admin/', include(admin_router.urls)),
]
