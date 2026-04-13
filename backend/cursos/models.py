import uuid
from datetime import date, datetime, time
from django.db import models, transaction
from django.core.exceptions import ValidationError
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

class Curso(models.Model):
    class Tipo(models.TextChoices):
        CENTRALIZADO = 'CENTRALIZADO', _('Centralizado')
        DESCENTRALIZADO = 'DESCENTRALIZADO', _('Descentralizado')

    class EixoTecnologico(models.TextChoices):
        TECNOLOGIA = 'TECNOLOGIA', _('Tecnologia')
        TECNICO_ESPECIALIZADO = 'TECNICO_ESPECIALIZADO', _('Técnico Especializado')
        RELACOES_HUMANAS = 'RELACOES_HUMANAS', _('Relações Humanas')
        GESTAO_PUBLICA = 'GESTAO_PUBLICA', _('Gestão Pública')
        CONTABILIDADE_FINANCAS = 'CONTABILIDADE_FINANCAS', _('Contabilidade, Finanças e Previdência')

    titulo = models.CharField(max_length=255, verbose_name="Título")
    ementa = models.TextField(verbose_name="Ementa")
    eixo = models.CharField(
        max_length=50, 
        choices=EixoTecnologico.choices, 
        verbose_name="Eixo Tecnológico",
        default=EixoTecnologico.GESTAO_PUBLICA
    )
    num_processo = models.CharField(max_length=50, verbose_name="Nº do Processo")
    memorando = models.CharField(max_length=50, verbose_name="Memorando de Solicitação")
    
    tipo = models.CharField(max_length=20, choices=Tipo.choices, default=Tipo.CENTRALIZADO, verbose_name="Tipo")
    codigo_oficial = models.CharField(max_length=20, unique=True, blank=True, verbose_name="Código Oficial")
    
    is_active = models.BooleanField(default=True, verbose_name="Ativo")
    criado_em = models.DateTimeField(auto_now_add=True)
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

    @property
    def status_geral(self):
        turmas = self.turmas.all()
        if not turmas.exists():
            return 'SEM_TURMAS'
        
        prioridade = {
            Turma.Status.EM_ANDAMENTO: 1,
            Turma.Status.PREVISTA: 2,
            Turma.Status.CONCLUIDA: 3,
            Turma.Status.FINALIZADA: 4,
            Turma.Status.ADIADA: 5,
            Turma.Status.CANCELADA: 6,
        }
        statuses = [t.status_calculado for t in turmas]
        return min(statuses, key=lambda s: prioridade.get(s, 99))

    def __str__(self):
        return f"{self.codigo_oficial} — {self.titulo}"


class Turma(models.Model):
    class Status(models.TextChoices):
        PREVISTA = 'PREVISTA', _('Prevista')
        EM_ANDAMENTO = 'EM_ANDAMENTO', _('Em Andamento')
        CONCLUIDA = 'CONCLUIDA', _('Concluída')
        FINALIZADA = 'FINALIZADA', _('Finalizada')
        ADIADA = 'ADIADA', _('Adiada')
        CANCELADA = 'CANCELADA', _('Cancelada')

    class Modalidade(models.TextChoices):
        PRESENCIAL = 'PRESENCIAL', _('Presencial')
        REMOTO = 'REMOTO', _('Remoto (EAD)')
        HIBRIDO = 'HIBRIDO', _('Híbrido')

    STATUS_MANUAIS = {Status.FINALIZADA, Status.ADIADA, Status.CANCELADA}

    curso = models.ForeignKey(Curso, on_delete=models.CASCADE, related_name='turmas', verbose_name="Curso")
    letra = models.CharField(max_length=3, verbose_name="Letra da Turma")
    modalidade = models.CharField(
        max_length=20, 
        choices=Modalidade.choices, 
        default=Modalidade.PRESENCIAL,
        verbose_name="Modalidade"
    )
    instrutor = models.ForeignKey(
        'users.Profile', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='turmas_instruidas',
        verbose_name="Instrutor",
        limit_choices_to={'tipo_usuario': 'INSTRUTOR'}
    )
    vagas = models.PositiveIntegerField(default=30, verbose_name="Nº de Vagas")
    custo = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name="Custo (R$)")
    carga_horaria = models.PositiveIntegerField(default=0, verbose_name="Carga Horária (h)")
    
    data_inicio = models.DateField(verbose_name="Data de Início")
    data_fim = models.DateField(verbose_name="Data de Término")
    
    status_manual = models.CharField(
        max_length=20, choices=Status.choices,
        null=True, blank=True, verbose_name="Status Manual",
        help_text="Preencha apenas para Finalizado, Adiado ou Cancelado."
    )
    is_active = models.BooleanField(default=True, verbose_name="Ativa")
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'catalogo_turmas'
        verbose_name = 'Turma'
        verbose_name_plural = 'Turmas'
        unique_together = [('curso', 'letra')]
        ordering = ['curso', 'letra']

    @property
    def carga_horaria_calculada(self):
        total_segundos = 0
        for evento in self.eventos.all():
            if evento.hora_inicio and evento.hora_fim:
                dummy_date = date(2000, 1, 1)
                start = datetime.combine(dummy_date, evento.hora_inicio)
                end = datetime.combine(dummy_date, evento.hora_fim)
                total_segundos += (end - start).total_seconds()
        return int(total_segundos // 3600)
        
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

    def clean(self):
        if self.data_inicio and self.data_fim and self.data_inicio > self.data_fim:
            raise ValidationError({'data_fim': _("A data de término deve ser posterior à data de início.")})

    def __str__(self):
        return self.codigo_turma


class EventoTurma(models.Model):
    """
    Representa cada encontro ou período de atividade de uma turma.
    Resolve a regra de múltiplos dias, horários e locais (Escola ou Externo).
    """
    class EspacoEscola(models.TextChoices):
        LAB_INFO = 'LAB_INFO', _('Laboratório de Informática - 4º andar (30 vagas)')
        SALA_1 = 'SALA_1', _('Sala de Aula 1 - 4º andar (21 vagas)')
        SALA_2 = 'SALA_2', _('Sala de Aula 2 - 5º andar (33 vagas)')
        AUDITORIO = 'AUDITORIO', _('Auditório - 5º andar (60 vagas)')
        EXTERNO = 'EXTERNO', _('Espaço Externo / Outros')

    class TurnoBloqueio(models.TextChoices):
        MANHA = 'MANHA', _('Manhã (08h às 12h)')
        TARDE = 'TARDE', _('Tarde (13h às 17h)')
        NOITE = 'NOITE', _('Noite (18h às 22h)')

    turma = models.ForeignKey(Turma, on_delete=models.CASCADE, related_name='eventos')
    data = models.DateField()
    hora_inicio = models.TimeField()
    hora_fim = models.TimeField()
    espaco = models.CharField(max_length=20, choices=EspacoEscola.choices)
    espaco_externo_nome = models.CharField(max_length=255, blank=True, null=True, verbose_name="Nome do Local Externo")
    
    # Campo calculado para a regra de bloqueio de agenda
    turno_reserva = models.CharField(max_length=10, choices=TurnoBloqueio.choices, editable=False)

    def save(self, *args, **kwargs):
        # Lógica de definição de turno baseada na hora de início
        h = self.hora_inicio.hour
        if h < 12: self.turno_reserva = self.TurnoBloqueio.MANHA
        elif h < 18: self.turno_reserva = self.TurnoBloqueio.TARDE
        else: self.turno_reserva = self.TurnoBloqueio.NOITE

        # Validação de Conflito de Espaço na Escola de Governo
        if self.espaco != self.EspacoEscola.EXTERNO:
            conflito = EventoTurma.objects.filter(
                data=self.data,
                turno_reserva=self.turno_reserva,
                espaco=self.espaco
            ).exclude(pk=self.pk)
            
            if conflito.exists():
                raise ValidationError(f"O espaço {self.get_espaco_display()} já está reservado para este turno nesta data.")

        super().save(*args, **kwargs)

    class Meta:
        db_table = 'catalogo_eventos_turma'
        verbose_name = 'Evento da Turma'
        verbose_name_plural = 'Eventos da Turma'
        ordering = ['data', 'hora_inicio']


class Inscricao(models.Model):
    class Status(models.TextChoices):
        PENDENTE = 'pendente', _('Pendente')
        APROVADO_CHEFIA = 'aprovado_chefia', _('Aprovado pela Chefia')
        INSCRITO = 'inscrito', _('Inscrito')
        CONCLUIDO = 'concluido', _('Concluído')
        CANCELADO = 'cancelado', _('Cancelado')

    perfil = models.ForeignKey('users.Profile', on_delete=models.CASCADE, related_name='inscricoes')
    turma = models.ForeignKey(Turma, on_delete=models.CASCADE, related_name='inscricoes')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDENTE)
    data_inscricao = models.DateTimeField(auto_now_add=True)
    hash_validacao = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)

    class Meta:
        db_table = 'catalogo_inscricoes'
        verbose_name = 'Inscrição'
        verbose_name_plural = 'Inscrições'
        unique_together = [('perfil', 'turma')]
        ordering = ['-data_inscricao']

    def save(self, *args, **kwargs):
        if not self.pk:
            with transaction.atomic():
                vagas_ocupadas = (
                    Inscricao.objects
                    .select_for_update()
                    .filter(turma=self.turma, status__in=[self.Status.INSCRITO, self.Status.APROVADO_CHEFIA])
                    .count()
                )
                if vagas_ocupadas >= self.turma.vagas:
                    raise ValidationError(f"Turma sem vagas disponíveis ({vagas_ocupadas}/{self.turma.vagas}).")
                super().save(*args, **kwargs)
        else:
            super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.perfil} → {self.turma} [{self.status}]"