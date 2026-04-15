from django.urls import path
from .views import (
    CursoListView, TurmaCreateView, InscreverTurmaView, 
    AprovarInscricaoView, MinhasInscricoesSimplificadasView, 
    InscricoesEquipeView, MinhasInscricoesDetailView
)

app_name = 'cursos'

urlpatterns = [
    path('', CursoListView.as_view(), name='lista-cursos'),
    path('turmas/', TurmaCreateView.as_view(), name='criar-turma'),
    path('turmas/<int:turma_id>/inscrever/', InscreverTurmaView.as_view(), name='inscrever-turma'),
    path('inscricoes/<int:pk>/status/', AprovarInscricaoView.as_view(), name='aprovar-inscricao'),
    path('inscricoes/minha-equipe/', InscricoesEquipeView.as_view(), name='inscricoes-equipe'),
    path('minhas-inscricoes/', MinhasInscricoesSimplificadasView.as_view(), name='minhas-inscricoes-simplificadas'),
    path('minhas-inscricoes/detalhes/', MinhasInscricoesDetailView.as_view(), name='minhas-inscricoes-detalhes'),
]
