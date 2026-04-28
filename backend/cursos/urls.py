from django.urls import path
from .views import (
    CursoListView, TurmaCreateView, TurmaUpdateView, InscreverTurmaView,
    AprovarInscricaoView, MinhasInscricoesSimplificadasView,
    InscricoesEquipeView, MinhasInscricoesDetailView,
    MinhasSolicitacoesView, AgendaGlobalView, AgendaConflitoView,
    AdminSolicitacoesView, AvaliarSolicitacaoView,
    CancelarSolicitacaoView,
    MinhasTurmasInstrutorView, DiarioTurmaView,
    AdminMatricularAlunoView,
    SalaDeAulaView, ConcluirAtividadeView, PingAtividadeView,
    MinhasGestoesView, GestaoAlunosTurmaView,
    ModuloViewSet, AtividadeViewSet, AtividadeAprovarView,
    AdminStatsView,
)

app_name = 'cursos'

urlpatterns = [
    path('', CursoListView.as_view(), name='lista-cursos'),
    path('turmas/', TurmaCreateView.as_view(), name='criar-turma'),
    path('turmas/<int:pk>/', TurmaUpdateView.as_view(), name='editar-turma'),
    path('turmas/<int:turma_id>/inscrever/', InscreverTurmaView.as_view(), name='inscrever-turma'),
    path('inscricoes/<int:pk>/status/', AprovarInscricaoView.as_view(), name='aprovar-inscricao'),
    path('inscricoes/minha-equipe/', InscricoesEquipeView.as_view(), name='inscricoes-equipe'),
    path('minhas-inscricoes/', MinhasInscricoesSimplificadasView.as_view(), name='minhas-inscricoes-simplificadas'),
    path('minhas-inscricoes/detalhes/', MinhasInscricoesDetailView.as_view(), name='minhas-inscricoes-detalhes'),
    path('agenda/', AgendaGlobalView.as_view(), name='agenda-global'),
    path('agenda/conflito/', AgendaConflitoView.as_view(), name='agenda-conflito'),
    path('minhas-solicitacoes/', MinhasSolicitacoesView.as_view(), name='minhas-solicitacoes'),
    path('admin-solicitacoes/', AdminSolicitacoesView.as_view(), name='admin-solicitacoes'),
    path('solicitacoes/<str:pk>/avaliar/', AvaliarSolicitacaoView.as_view(), name='avaliar-solicitacao'),
    path('solicitacoes/<str:pk>/cancelar/', CancelarSolicitacaoView.as_view(), name='cancelar-solicitacao'),
    path('turmas/instrutor/', MinhasTurmasInstrutorView.as_view(), name='turmas-instrutor'),
    path('diario/<int:turma_id>/', DiarioTurmaView.as_view(), name='diario-turma'),
    path('turmas/<int:turma_id>/matricular-admin/', AdminMatricularAlunoView.as_view(), name='admin-matricular'),
    path('turmas/<int:turma_id>/sala-de-aula/', SalaDeAulaView.as_view(), name='sala-de-aula'),
    path('atividades/<int:atividade_id>/ping/', PingAtividadeView.as_view(), name='ping-atividade'),
    path('atividades/<int:atividade_id>/concluir/', ConcluirAtividadeView.as_view(), name='concluir-atividade'),
    path('atividades/<int:pk>/aprovar/', AtividadeAprovarView.as_view(), name='aprovar-atividade'),

    path('turmas/gestao-delegada/', MinhasGestoesView.as_view(), name='turmas-gestao-delegada'),
    path('turmas/<int:turma_id>/gestao-alunos/', GestaoAlunosTurmaView.as_view(), name='gestao-alunos-turma'),

    # LMS Management
    path('turmas/<int:turma_id>/modulos/', ModuloViewSet.as_view(), name='gerenciar-modulos'),
    path('modulos/<int:pk>/', ModuloViewSet.as_view(), name='detalhe-modulo'),
    path('modulos/<int:modulo_id>/atividades/', AtividadeViewSet.as_view(), name='gerenciar-atividades'),
    path('atividades/<int:pk>/detalhe/', AtividadeViewSet.as_view(), name='detalhe-atividade'),

    # Admin Stats
    path('admin-stats/', AdminStatsView.as_view(), name='admin-stats'),
]
