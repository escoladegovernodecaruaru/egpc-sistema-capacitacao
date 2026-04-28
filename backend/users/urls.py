from django.urls import path
from .views import (
    PreValidateProfileView,
    LookupEmailByCpfView,
    RegisterProfileView,
    MyProfileView,
    FotoPerfilView,
    ListaInstrutoresView,
    AdminUserListView,
    AdminUserUpdateView,
    ToggleSolicitanteView,
)

app_name = 'users'

urlpatterns = [
    # Verifica disponibilidade de CPF/e-mail/telefone (usado no cadastro)
    path('auth/pre-validate/', PreValidateProfileView.as_view(), name='pre-validate-profile'),

    # Dado o CPF, retorna o e-mail real cadastrado (usado no Login)
    path('auth/lookup-email/', LookupEmailByCpfView.as_view(), name='lookup-email-by-cpf'),

    # Cria o Profile no Django após o signUp no Supabase
    path('auth/register/', RegisterProfileView.as_view(), name='register-profile'),

    # GET → dados do perfil autenticado | PATCH → edita campos permitidos
    path('auth/me/', MyProfileView.as_view(), name='my-profile'),

    # POST → upload e processamento de foto de perfil (multipart/form-data)
    path('auth/foto/', FotoPerfilView.as_view(), name='foto-perfil'),

    path('instrutores/', ListaInstrutoresView.as_view(), name='lista-instrutores'),

    # Rotas de Administração
    path('admin/usuarios/', AdminUserListView.as_view(), name='admin-user-list'),
    path('admin/usuarios/<uuid:pk>/', AdminUserUpdateView.as_view(), name='admin-user-update'),
    path('admin/usuarios/<uuid:pk>/toggle-solicitante/', ToggleSolicitanteView.as_view(), name='toggle-solicitante'),
]
