import uuid
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from django.contrib.auth.signals import user_logged_in
from django.dispatch import receiver

class ProfileManager(BaseUserManager):
    def create_user(self, cpf, password=None, **extra_fields):
        if not cpf:
            raise ValueError('O CPF deve ser informado')
        user = self.model(cpf=cpf, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password() # Apenas para casos excepcionais sem senha
            
        user.save(using=self._db)
        return user

    def create_superuser(self, cpf, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(cpf, password, **extra_fields)

class Profile(AbstractBaseUser, PermissionsMixin):
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
    telefone = models.CharField(max_length=20, verbose_name="Telefone", null=True, blank=True)
    
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
    data_nascimento = models.DateField(null=True, blank=True, verbose_name="Data de Nascimento")

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

class OTPCode(models.Model):
    class Proposito(models.TextChoices):
        REGISTRO = 'registro', _('Registro')
        RECUPERACAO = 'recuperacao', _('Recuperação de Senha')

    email = models.EmailField(verbose_name="E-mail")
    codigo = models.CharField(max_length=6, verbose_name="Código OTP")
    proposito = models.CharField(max_length=20, choices=Proposito.choices, default=Proposito.REGISTRO)
    criado_em = models.DateTimeField(auto_now_add=True)
    expira_em = models.DateTimeField()
    usado = models.BooleanField(default=False)

    class Meta:
        db_table = 'auth_otp_codes'
        verbose_name = 'Código OTP'
        verbose_name_plural = 'Códigos OTP'

    def is_valid(self):
        return not self.usado and timezone.now() <= self.expira_em

class ServidorRH(models.Model):
    cpf = models.CharField(max_length=11, verbose_name="CPF")
    matricula = models.CharField(max_length=50, unique=True, verbose_name="Matrícula")
    nome_base = models.CharField(max_length=255, verbose_name="Nome na Base")
    cargo = models.CharField(max_length=255, blank=True, null=True, verbose_name="Cargo")
    importado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'rh_servidores_base'
        verbose_name = 'Servidor RH (Base Espelho)'
        verbose_name_plural = 'Servidores RH'
        constraints = [
            models.UniqueConstraint(fields=['cpf', 'matricula'], name='unique_cpf_matricula')
        ]

    def __str__(self):
        return f"{self.matricula} - {self.cpf}"

class TicketDenunciaMatricula(models.Model):
    class Status(models.TextChoices):
        ABERTO = 'ABERTO', _('Aberto')
        EM_ANALISE = 'EM_ANALISE', _('Em Análise')
        RESOLVIDO = 'RESOLVIDO', _('Resolvido')

    user_denunciante = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='denuncias_feitas')
    matricula_reclamada = models.CharField(max_length=50, verbose_name="Matrícula Reclamada")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ABERTO)
    criado_em = models.DateTimeField(auto_now_add=True)
    resolvido_em = models.DateTimeField(null=True, blank=True)
    resolvido_por = models.ForeignKey(Profile, on_delete=models.SET_NULL, null=True, blank=True, related_name='denuncias_resolvidas')

    class Meta:
        db_table = 'rh_tickets_denuncia'
        verbose_name = 'Ticket de Denúncia'
        verbose_name_plural = 'Tickets de Denúncia'

    def __str__(self):
        return f"Ticket {self.id} - {self.matricula_reclamada}"

class RelacaoChefia(models.Model):
    class Status(models.TextChoices):
        PENDENTE = 'PENDENTE', _('Pendente')
        ACEITO = 'ACEITO', _('Aceito')

    servidor = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='chefias_solicitadas')
    chefe = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='subordinados')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDENTE)
    data_solicitacao = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'users_relacao_chefia'
        verbose_name = 'Relação de Chefia'
        verbose_name_plural = 'Relações de Chefia'
        constraints = [
            models.UniqueConstraint(fields=['servidor', 'chefe'], name='unique_servidor_chefe')
        ]

    def __str__(self):
        return f"{self.servidor.nome_completo} -> Chefe: {self.chefe.nome_completo} [{self.status}]"

class Secretaria(models.Model):
    """
    Lista de secretarias gerenciável pelo administrador.
    Exibida como '{SIGLA} - {NOME}' nos formulários de cadastro e perfil.
    """
    sigla = models.CharField(
        max_length=15,
        unique=True,
        verbose_name="Sigla",
        help_text="Ex: SAD (máx. 15 caracteres)"
    )
    nome = models.CharField(
        max_length=255,
        verbose_name="Nome completo",
        help_text="Ex: Secretaria de Administração"
    )
    is_active = models.BooleanField(default=True, verbose_name="Ativa")
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Secretaria"
        verbose_name_plural = "Secretarias"
        ordering = ['sigla']

    def __str__(self):
        return f"{self.sigla} - {self.nome}"


class AuditLog(models.Model):
    user = models.ForeignKey(Profile, on_delete=models.SET_NULL, null=True, blank=True)
    method = models.CharField(max_length=10)
    path = models.CharField(max_length=255)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(null=True, blank=True)
    payload = models.JSONField(null=True, blank=True)
    response_status = models.IntegerField(null=True, blank=True, verbose_name="Status HTTP de Saída")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'audit_logs'
        verbose_name = 'Log de Auditoria'
        verbose_name_plural = 'Logs de Auditoria'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.method} {self.path} - {self.user.cpf if self.user else 'Anon'}"

@receiver(user_logged_in)
def log_login(sender, request, user, **kwargs):
    # 1. Atualiza a coluna last_login do seu modelo Profile
    # Usamos timezone.now() para garantir que pegue o horário correto configurado no settings.py
    user.last_login = timezone.now()
    user.save(update_fields=['last_login']) # Salva APENAS essa coluna por performance

    # 2. Lógica para pegar o IP real
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')

    # 3. Cria o Log de Auditoria
    AuditLog.objects.create(
        user=user,
        method='LOGIN',
        path='/api/auth/login/',
        ip_address=ip,
        user_agent=request.META.get('HTTP_USER_AGENT'),
    )