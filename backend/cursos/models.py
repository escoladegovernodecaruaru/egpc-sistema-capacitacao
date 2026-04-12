import uuid
from datetime import date

from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.utils import timezone
from django.utils.translation import gettext_lazy as _


class Curso(models.Model):
    class Tipo(models.TextChoices):
        CENTRALIZADO    = 'CENTRALIZADO',    _('Centralizado')
        DESCENTRALIZADO = 'DESCENTRALIZADO', _('Descentralizado')

    titulo        = models.CharField(max_length=255, verbose_name="Título")
    ementa        = models.TextField(verbose_name="Ementa")
    num_processo  = models.CharField(max_length=50, blank=True, null=True, verbose_name="Nº do Processo")
    memorando     = models.CharField(max_length=50, blank=True, null=True, verbose_name="Memorando")
    tipo          = models.CharField(max_length=20, choices=Tipo.choices, default=Tipo.CENTRALIZADO, verbose_name="Tipo")
    codigo_oficial = models.CharField(max_length=20, unique=True, blank=True, verbose_name="Código Oficial")
    is_active     = models.BooleanField(default=True, verbose_name="Ativo")
    criado_em     = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'catalogo_cursos'
        verbose_name = 'Curso'
        verbose_name_plural = 'Cursos'
        ordering = ['-codigo_oficial']

    def _gerar_codigo_oficial(self):
        ano = timezone.now().year
        ultimo = (
            Curso.objects
            .filter(codigo_oficial__endswith=f'/{ano}')
            .order_by('-codigo_oficial')
            .first()
        )
        if ultimo:
            try:
                seq = int(ultimo.codigo_oficial.split('/')[0]) + 1
            except (ValueError, IndexError):
                seq = 1
        else:
            seq = 1
        return f"{seq:03d}/{ano}"

    def save(self, *args, **kwargs):
        if not self.codigo_oficial:
            self.codigo_oficial = self._gerar_codigo_oficial()
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        tem_inscritos = Inscricao.objects.filter(turma__curso=self).exists()
        if tem_inscritos:
            self.is_active = False
            self.save(update_fields=['is_active'])
        else:
            super().delete(*args, **kwargs)

    @property
    def status_geral(self):
        turmas = self.turmas.all()
        if not turmas.exists():
            return 'SEM_TURMAS'
        prioridade = {
            Turma.Status.EM_ANDAMENTO: 1,
            Turma.Status.PREVISTA:     2,
            Turma.Status.CONCLUIDA:    3,
            Turma.Status.FINALIZADA:   4,
            Turma.Status.ADIADA:       5,
            Turma.Status.CANCELADA:    6,
        }
        statuses = [t.status_calculado for t in turmas]
        return min(statuses, key=lambda s: prioridade.get(s, 99))

    def __str__(self):
        return f"{self.codigo_oficial} — {self.titulo}"


class Turma(models.Model):
    class Status(models.TextChoices):
        PREVISTA     = 'PREVISTA',     _('Prevista')
        EM_ANDAMENTO = 'EM_ANDAMENTO', _('Em Andamento')
        CONCLUIDA    = 'CONCLUIDA',    _('Concluída')
        FINALIZADA   = 'FINALIZADA',   _('Finalizada')
        ADIADA       = 'ADIADA',       _('Adiada')
        CANCELADA    = 'CANCELADA',    _('Cancelada')

    class Turno(models.TextChoices):
        MANHA = 'MANHA', _('Manhã')
        TARDE = 'TARDE', _('Tarde')
        NOITE = 'NOITE', _('Noite')

    STATUS_MANUAIS = {Status.FINALIZADA, Status.ADIADA, Status.CANCELADA}

    curso         = models.ForeignKey(Curso, on_delete=models.CASCADE, related_name='turmas', verbose_name="Curso")
    letra         = models.CharField(max_length=3, verbose_name="Letra da Turma")
    instrutor     = models.ForeignKey(
        'users.Profile', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='turmas_instruidas',
        verbose_name="Instrutor",
        limit_choices_to={'tipo_usuario': 'INSTRUTOR'}
    )
    local         = models.CharField(max_length=255, verbose_name="Local / Sala")
    vagas         = models.PositiveIntegerField(default=30, verbose_name="Nº de Vagas")
    custo         = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name="Custo (R$)")
    carga_horaria = models.IntegerField(verbose_name="Carga Horária (h)")
    data_inicio   = models.DateField(verbose_name="Data de Início")
    data_fim      = models.DateField(verbose_name="Data de Término")
    turno         = models.CharField(max_length=5, choices=Turno.choices, default=Turno.MANHA, verbose_name="Turno")
    status_manual = models.CharField(
        max_length=20, choices=Status.choices,
        null=True, blank=True, verbose_name="Status Manual",
        help_text="Preencha apenas para Finalizado, Adiado ou Cancelado."
    )
    is_active     = models.BooleanField(default=True, verbose_name="Ativa")
    criado_em     = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'catalogo_turmas'
        verbose_name = 'Turma'
        verbose_name_plural = 'Turmas'
        unique_together = [('curso', 'letra')]
        ordering = ['curso', 'letra']

    def clean(self):
        errors = {}

        if self.vagas is not None and self.vagas < 0:
            errors['vagas'] = _("O número de vagas não pode ser negativo.")

        if self.data_inicio and self.data_fim and self.data_inicio > self.data_fim:
            errors['data_fim'] = _("A data de término deve ser posterior à data de início.")

        # Choque de turno: mesmo local, mesmo turno, período sobreposto, turma diferente
        if self.local and self.turno and self.data_inicio and self.data_fim:
            conflito = (
                Turma.objects
                .filter(
                    local__iexact=self.local,
                    turno=self.turno,
                    data_inicio__lte=self.data_fim,
                    data_fim__gte=self.data_inicio,
                    is_active=True,
                )
                .exclude(pk=self.pk)
            )
            if conflito.exists():
                outra = conflito.first()
                errors['turno'] = _(
                    f"Choque de turno: {outra.codigo_turma} já ocupa '{self.local}' "
                    f"no turno {self.get_turno_display()} no período {self.data_inicio} a {self.data_fim}."
                )

        if errors:
            raise ValidationError(errors)

    @property
    def codigo_turma(self):
        return f"{self.curso.codigo_oficial}{self.letra.upper()}"

    @property
    def status_calculado(self):
        if self.status_manual and self.status_manual in self.STATUS_MANUAIS:
            return self.status_manual
        hoje = date.today()
        if hoje > self.data_fim:
            return self.Status.CONCLUIDA
        elif self.data_inicio <= hoje <= self.data_fim:
            return self.Status.EM_ANDAMENTO
        return self.Status.PREVISTA

    def delete(self, *args, **kwargs):
        tem_inscritos = self.inscricoes.exists()
        if tem_inscritos:
            self.is_active = False
            self.save(update_fields=['is_active'])
        else:
            super().delete(*args, **kwargs)

    def __str__(self):
        return self.codigo_turma


class Inscricao(models.Model):
    class Status(models.TextChoices):
        PENDENTE        = 'pendente',        _('Pendente')
        APROVADO_CHEFIA = 'aprovado_chefia', _('Aprovado pela Chefia')
        INSCRITO        = 'inscrito',        _('Inscrito')
        CONCLUIDO       = 'concluido',       _('Concluído')
        CANCELADO       = 'cancelado',       _('Cancelado')

    perfil = models.ForeignKey(
        'users.Profile', on_delete=models.CASCADE,
        related_name='inscricoes', verbose_name="Perfil do Usuário"
    )
    turma = models.ForeignKey(
        Turma, on_delete=models.CASCADE,
        related_name='inscricoes', verbose_name="Turma"
    )
    status = models.CharField(
        max_length=20, choices=Status.choices,
        default=Status.PENDENTE, verbose_name="Status"
    )
    data_inscricao = models.DateTimeField(auto_now_add=True, verbose_name="Data de Inscrição")
    hash_validacao = models.UUIDField(
        default=uuid.uuid4, editable=False, unique=True,
        verbose_name="Hash de Validação"
    )

    class Meta:
        db_table = 'catalogo_inscricoes'
        verbose_name = 'Inscrição'
        verbose_name_plural = 'Inscrições'
        unique_together = [('perfil', 'turma')]
        ordering = ['-data_inscricao']

    def save(self, *args, **kwargs):
        # Trava atômica: verifica vagas apenas para inscrições novas
        if not self.pk:
            with transaction.atomic():
                vagas_ocupadas = (
                    Inscricao.objects
                    .select_for_update()
                    .filter(
                        turma=self.turma,
                        status__in=[self.Status.INSCRITO, self.Status.APROVADO_CHEFIA]
                    )
                    .count()
                )
                if vagas_ocupadas >= self.turma.vagas:
                    raise ValidationError(
                        f"Turma {self.turma.codigo_turma} sem vagas disponíveis "
                        f"({vagas_ocupadas}/{self.turma.vagas})."
                    )
                super().save(*args, **kwargs)
        else:
            super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.perfil} → {self.turma} [{self.get_status_display()}]"
