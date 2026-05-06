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
    SendOtpView,
    ValidateOtpView,
    ResetPasswordView,
    BuscarNomeCpfView,
    DenunciarMatriculaView,
    MinhaEquipeView,
    ResponderChefiaView,
    ImpersonateUserView,
    SecretariaListView,
    SecretariaDetailView,
)

app_name = 'users'

urlpatterns = [
    # Verifica disponibilidade de CPF/e-mail/telefone (usado no cadastro)
    path('auth/pre-validate/', PreValidateProfileView.as_view(), name='pre-validate-profile'),

    # Dado o CPF, retorna o e-mail real cadastrado (usado no Login)
    path('auth/lookup-email/', LookupEmailByCpfView.as_view(), name='lookup-email-by-cpf'),

    # Cria o Profile no Django (fluxo nativo)
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
    path('admin/usuarios/<uuid:pk>/impersonate/', ImpersonateUserView.as_view(), name='impersonate-user'),

    path('auth/send-otp/', SendOtpView.as_view(), name='send-otp'),
    path('auth/verify-otp/', ValidateOtpView.as_view(), name='verify-otp'),
    path('auth/reset-password/', ResetPasswordView.as_view(), name='reset-password'),

    path('auth/buscar-nome/', BuscarNomeCpfView.as_view(), name='buscar-nome'),
    path('auth/denunciar-matricula/', DenunciarMatriculaView.as_view(), name='denunciar-matricula'),

    path('equipe/', MinhaEquipeView.as_view(), name='minha-equipe'),
    path('equipe/responder/', ResponderChefiaView.as_view(), name='responder-chefia'),

    # Secretarias (GET: público; POST/PATCH/DELETE: admin)
    path('secretarias/', SecretariaListView.as_view(), name='secretarias-list'),
    path('secretarias/<int:pk>/', SecretariaDetailView.as_view(), name='secretarias-detail'),
]
