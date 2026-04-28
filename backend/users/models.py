import uuid
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

class ProfileManager(BaseUserManager):
    def create_user(self, cpf, password=None, **extra_fields):
        if not cpf:
            raise ValueError('O CPF deve ser informado')
        user = self.model(cpf=cpf, **extra_fields)
        # Como o auth é gerido pelo Supabase, não gerimos senha real no Django.
        # Definimos uma senha inutilizável por padrão, mas pode ser definido para admin.
        user.set_unusable_password() 
        if password:
            user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, cpf, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(cpf, password, **extra_fields)

class Profile(AbstractBaseUser, PermissionsMixin):
    """
    Modelo Customizado de Usuário cuja Primary Key é um UUID que mapeia
    diretamente para auth.users do Supabase.
    """
    class UserType(models.TextChoices):
        SERVIDOR_ATIVO = 'SERVIDOR_ATIVO', _('Servidor Ativo')
        CIDADAO = 'CIDADAO', _('Cidadão')
        TERCEIRIZADO = 'TERCEIRIZADO', _('Terceirizado')
        ESTAGIARIO = 'ESTAGIARIO', _('Estagiário')
        INSTRUTOR = 'INSTRUTOR', _('Instrutor')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cpf = models.CharField(max_length=11, unique=True, verbose_name="CPF")
    nome_completo = models.CharField(max_length=255, verbose_name="Nome Completo")
    nome_social = models.CharField(max_length=255, blank=True, null=True, verbose_name="Nome Social")
    email = models.EmailField(unique=True, verbose_name="E-mail")
    telefone = models.CharField(max_length=20, unique=True, verbose_name="Telefone", null=True, blank=True)
    
    tipo_usuario = models.CharField(
        max_length=20,
        choices=UserType.choices,
        default=UserType.CIDADAO,
        verbose_name="Tipo de Usuário"
    )

    # Dados adicionais flexíveis para armazenar lotação, matrícula, etc.
    dados_servidor = models.JSONField(blank=True, null=True, verbose_name="Dados do Servidor")

    # Foto de perfil (armazenada no Cloudflare R2 via django-storages)
    foto_perfil = models.ImageField(
        upload_to='fotos_perfil/',
        blank=True,
        null=True,
        verbose_name="Foto de Perfil"
    )

    # Regras de Negócio EGPC
    esta_de_licenca = models.BooleanField(default=False, verbose_name="Está de Licença")
    bloqueado_ate = models.DateField(blank=True, null=True, verbose_name="Bloqueado até (Suspensão)")
    # Nível de permissão especial: permite criar Solicitações de Reserva de Espaço
    is_solicitante = models.BooleanField(
        default=False,
        verbose_name="É Solicitante",
        help_text="Concede permissão para solicitar reservas de espaços institucionais."
    )
    data_ultima_confirmacao = models.DateField(default=timezone.now, verbose_name="Última Confirmação (90 dias)")

    # Campos padrão Django
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    objects = ProfileManager()

    USERNAME_FIELD = 'cpf'
    REQUIRED_FIELDS = ['nome_completo', 'email']

    class Meta:
        db_table = 'perfis'
        verbose_name = 'Perfil'
        verbose_name_plural = 'Perfis'

    def __str__(self):
        return f"{self.nome_social or self.nome_completo} ({self.cpf})"

    def esta_bloqueado(self):
        """Verifica se o usuário está cumprindo período de suspensão de 12 meses."""
        if self.bloqueado_ate and self.bloqueado_ate > timezone.now().date():
            return True
        return False
