from django.urls import path
from .views import CursoListView, TurmaCreateView

app_name = 'cursos'

urlpatterns = [
    path('', CursoListView.as_view(), name='lista-cursos'),
    path('turmas/', TurmaCreateView.as_view(), name='criar-turma'),
]