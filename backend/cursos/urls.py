from django.urls import path
from .views import CursoListView

app_name = 'cursos'

urlpatterns = [
    path('', CursoListView.as_view(), name='lista-cursos'),
]
