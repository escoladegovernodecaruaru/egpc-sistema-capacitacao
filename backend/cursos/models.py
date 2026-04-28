import uuid
from datetime import date, datetime, time
from django.db import models, transaction
from django.core.exceptions import ValidationError
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from django.db.models.signals import pre_save
from django.dispatch import receiver

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
    num_processo = models.CharField(max_length=50, blank=True, default='', verbose_name="Nº do Processo")
    memorando = models.CharField(max_length=50, blank=True, default='', verbose_name="Memorando de Solicitação")
    
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

    class Visibilidade(models.TextChoices):
        PUBLICA = 'PUBLICA', _('Pública (Catálogo Aberto)')
        RESTRITA = 'RESTRITA', _('Restrita (Inscrição Manual)')

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
    visibilidade = models.CharField(
        max_length=20, 
        choices=Visibilidade.choices, 
        default=Visibilidade.PUBLICA,
        verbose_name="Visibilidade da Turma"
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
    diario_fechado_em = models.DateTimeField(null=True, blank=True)
    diario_fechado_por = models.ForeignKey('users.Profile', on_delete=models.SET_NULL, null=True, blank=True, related_name='diarios_fechados')

    class Meta:
        db_table = 'catalogo_turmas'
        verbose_name = 'Turma'
        verbose_name_plural = 'Turmas'
        unique_together = [('curso', 'letra')]
        ordering = ['curso', 'letra']
        constraints = [
            models.CheckConstraint(check=models.Q(custo__gte=0), name='chk_custo_positivo')
        ]

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

class TurmaGestor(models.Model):
    turma = models.ForeignKey(Turma, on_delete=models.CASCADE, related_name='gestores_associados')
    gestor = models.ForeignKey('users.Profile', on_delete=models.CASCADE, related_name='turmas_gerenciadas')

    class Meta:
        db_table = 'catalogo_turma_gestores'
        verbose_name = 'Gestor da Turma'
        verbose_name_plural = 'Gestores das Turmas'
        constraints = [
            models.UniqueConstraint(fields=['turma', 'gestor'], name='unique_turma_gestor')
        ]

class EspacoAlocado(models.Model):
    espaco = models.CharField(max_length=20)
    data = models.DateField()
    turno_reserva = models.CharField(max_length=10)
    # Referência opcional para rastrear de qual evento/item esta alocação veio
    evento_ref = models.CharField(max_length=50, blank=True, null=True, help_text="Referência interna: 'evento_<id>' ou 'item_<id>'")

    class Meta:
        db_table = 'catalogo_espaco_alocado'
        constraints = [
            models.UniqueConstraint(
                fields=['data', 'turno_reserva', 'espaco'], 
                name='unique_reserva_turno_espaco',
                condition=~models.Q(espaco='EXTERNO')
            )
        ]
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
    alocacao_fisica = models.OneToOneField(EspacoAlocado, on_delete=models.CASCADE, null=True, blank=True)
    espaco_externo_nome = models.CharField(max_length=255, blank=True, null=True, verbose_name="Nome do Local Externo")
    
    # Campo calculado para a regra de bloqueio de agenda
    turno_reserva = models.CharField(max_length=10, choices=TurnoBloqueio.choices, editable=False)

    @staticmethod
    def _calcular_turnos_cruzados(hora_inicio, hora_fim):
        """
        Dado hora_inicio e hora_fim, retorna a lista de turnos que o evento ocupa.
        Um evento que vai das 11h às 14h ocupa MANHA e TARDE.
        Turnos: MANHA=08-12h, TARDE=12-18h, NOITE=18-22h
        """
        LIMITES = [
            ('MANHA', 0, 12),
            ('TARDE', 12, 18),
            ('NOITE', 18, 24),
        ]
        turnos = []
        h_ini = hora_inicio.hour
        h_fim = hora_fim.hour + (1 if hora_fim.minute > 0 else 0)  # fim exclusivo arredondado para cima
        for nome, inicio, fim in LIMITES:
            # O evento intercepta este turno se os intervalos se sobrepõem
            if h_ini < fim and h_fim > inicio:
                turnos.append(nome)
        return turnos if turnos else ['MANHA']  # fallback de segurança

    def save(self, *args, **kwargs):
        # Define o turno_reserva baseado na hora de início (campo calculado)
        h = self.hora_inicio.hour
        if h < 12:
            self.turno_reserva = self.TurnoBloqueio.MANHA
        elif h < 18:
            self.turno_reserva = self.TurnoBloqueio.TARDE
        else:
            self.turno_reserva = self.TurnoBloqueio.NOITE

        if self.espaco != self.EspacoEscola.EXTERNO:
            from django.db import IntegrityError

            # Calcula todos os turnos que este evento ocupa (pode ser 1 ou 2)
            turnos = self._calcular_turnos_cruzados(self.hora_inicio, self.hora_fim)

            # Salva o primeiro turno na alocacao_fisica (campo FK OneToOne)
            turno_principal = turnos[0]
            if not self.alocacao_fisica:
                self.alocacao_fisica = EspacoAlocado(
                    data=self.data, turno_reserva=turno_principal, espaco=self.espaco
                )
            else:
                self.alocacao_fisica.data = self.data
                self.alocacao_fisica.turno_reserva = turno_principal
                self.alocacao_fisica.espaco = self.espaco

            try:
                self.alocacao_fisica.save()
            except IntegrityError:
                raise ValidationError(
                    f"O espaço {self.get_espaco_display()} já está reservado no turno da Manhã nesta data."
                )

            # Se o evento cruza o meio-dia, cria/atualiza também a alocação do segundo turno
            if len(turnos) > 1:
                for turno_extra in turnos[1:]:
                    try:
                        EspacoAlocado.objects.get_or_create(
                            data=self.data,
                            turno_reserva=turno_extra,
                            espaco=self.espaco,
                            defaults={'evento_ref': f'evento_pendente'}
                        )
                    except IntegrityError:
                        raise ValidationError(
                            f"O espaço {self.get_espaco_display()} já está reservado no turno da Tarde nesta data."
                        )
        else:
            if self.alocacao_fisica:
                self.alocacao_fisica.delete()
                self.alocacao_fisica = None

        super().save(*args, **kwargs)

        # Após ter o ID, atualiza o evento_ref das alocações extras
        if self.espaco != self.EspacoEscola.EXTERNO and self.alocacao_fisica:
            turnos = self._calcular_turnos_cruzados(self.hora_inicio, self.hora_fim)
            if len(turnos) > 1:
                for turno_extra in turnos[1:]:
                    EspacoAlocado.objects.filter(
                        data=self.data, turno_reserva=turno_extra, espaco=self.espaco
                    ).update(evento_ref=f'evento_{self.id}')

    class Meta:
        db_table = 'catalogo_eventos_turma'
        verbose_name = 'Evento da Turma'
        verbose_name_plural = 'Eventos da Turma'
        ordering = ['data', 'hora_inicio']
        # constraints movidas para EspacoAlocado


class Inscricao(models.Model):
    class Status(models.TextChoices):
        PENDENTE = 'pendente', _('Pendente')
        APROVADO_CHEFIA = 'aprovado_chefia', _('Aprovado pela Chefia')
        INSCRITO = 'inscrito', _('Inscrito')
        CONCLUIDO = 'concluido', _('Concluído')
        REPROVADO = 'reprovado', _('Reprovado')
        CANCELADO = 'cancelado', _('Cancelado')

    perfil = models.ForeignKey('users.Profile', on_delete=models.CASCADE, related_name='inscricoes')
    turma = models.ForeignKey(Turma, on_delete=models.CASCADE, related_name='inscricoes')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDENTE)
    data_inscricao = models.DateTimeField(auto_now_add=True)
    nota = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True, verbose_name="Nota Final")
    hash_validacao = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    
    # Auditoria
    aprovado_por = models.ForeignKey('users.Profile', on_delete=models.SET_NULL, null=True, blank=True, related_name='aprovacoes')
    aprovado_em = models.DateTimeField(null=True, blank=True)
    ip_aprovacao = models.GenericIPAddressField(null=True, blank=True)
    justificativa_rejeicao = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'catalogo_inscricoes'
        verbose_name = 'Inscrição'
        verbose_name_plural = 'Inscrições'
        ordering = ['-data_inscricao']
        constraints = [
            models.UniqueConstraint(fields=['perfil', 'turma'], name='unique_perfil_turma')
        ]

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
    
# ==========================================
# MÓDULO DE AGENDA E SOLICITAÇÃO DE ESPAÇOS
# ==========================================

class SolicitacaoReserva(models.Model):
    class Status(models.TextChoices):
        PENDENTE = 'PENDENTE', _('Pendente')
        APROVADA = 'APROVADA', _('Aprovada')
        RECUSADA = 'RECUSADA', _('Recusada')
        CANCELADA = 'CANCELADA', _('Cancelada')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    solicitante = models.ForeignKey(
        'users.Profile', related_name='solicitacoes_reserva', on_delete=models.CASCADE
    )
    titulo = models.CharField(max_length=255, verbose_name="Título do Evento")
    descricao = models.TextField(blank=True, null=True, verbose_name="Descrição do Evento")
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDENTE,
        verbose_name="Status da Solicitação"
    )
    protocolo = models.CharField(max_length=20, unique=True, editable=False, verbose_name="Número de Protocolo")
    justificativa_recusa = models.TextField(blank=True, null=True, verbose_name="Justificativa (em caso de recusa)")
    
    # Auditoria
    avaliado_por = models.ForeignKey('users.Profile', on_delete=models.SET_NULL, null=True, blank=True, related_name='avaliacoes_reserva')
    avaliado_em = models.DateTimeField(null=True, blank=True)
    ip_avaliacao = models.GenericIPAddressField(null=True, blank=True)
    
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'catalogo_solicitacoes_reserva'
        verbose_name = 'Solicitação de Reserva'
        verbose_name_plural = 'Solicitações de Reserva'
        ordering = ['-criado_em']

    def save(self, *args, **kwargs):
        if not self.protocolo:
            data_atual = timezone.now().strftime("%Y%m%d")
            codigo_aleatorio = str(uuid.uuid4().hex)[:4].upper()
            self.protocolo = f"RES-{data_atual}-{codigo_aleatorio}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.protocolo} - {self.titulo}"


class ItemReserva(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    solicitacao = models.ForeignKey(SolicitacaoReserva, related_name='itens', on_delete=models.CASCADE)
    alocacao_fisica = models.OneToOneField(EspacoAlocado, on_delete=models.CASCADE, null=True, blank=True)
    
    # Herda os mesmos choices do EventoTurma para garantir a comparação perfeita
    espaco = models.CharField(max_length=20, choices=EventoTurma.EspacoEscola.choices)
    data = models.DateField()
    turno_reserva = models.CharField(max_length=10, choices=EventoTurma.TurnoBloqueio.choices, editable=False)
    hora_inicio = models.TimeField()
    hora_fim = models.TimeField()

    class Meta:
        db_table = 'catalogo_itens_reserva'
        verbose_name = 'Item de Reserva'
        verbose_name_plural = 'Itens de Reserva'
        ordering = ['data', 'hora_inicio']
        # constraints movidas para EspacoAlocado

    def clean(self):
        errors = {}

        if self.hora_inicio and self.hora_fim and self.hora_inicio >= self.hora_fim:
            errors['hora_fim'] = _("A hora final deve ser posterior à hora inicial.")

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if self.hora_inicio:
            h = self.hora_inicio.hour
            if h < 12:
                self.turno_reserva = EventoTurma.TurnoBloqueio.MANHA
            elif h < 18:
                self.turno_reserva = EventoTurma.TurnoBloqueio.TARDE
            else:
                self.turno_reserva = EventoTurma.TurnoBloqueio.NOITE

        self.clean()

        if self.espaco != EventoTurma.EspacoEscola.EXTERNO:
            from django.db import IntegrityError

            # Calcula todos os turnos que este item de reserva ocupa
            turnos = EventoTurma._calcular_turnos_cruzados(self.hora_inicio, self.hora_fim)
            turno_principal = turnos[0]

            if not self.alocacao_fisica:
                self.alocacao_fisica = EspacoAlocado(
                    data=self.data, turno_reserva=turno_principal, espaco=self.espaco
                )
            else:
                self.alocacao_fisica.data = self.data
                self.alocacao_fisica.turno_reserva = turno_principal
                self.alocacao_fisica.espaco = self.espaco

            try:
                self.alocacao_fisica.save()
            except IntegrityError:
                raise ValidationError("O espaço já está reservado no turno da Manhã nesta data por outro evento ou reserva.")

            # Evento cruzado: gera alocação extra para o segundo turno
            if len(turnos) > 1:
                for turno_extra in turnos[1:]:
                    try:
                        EspacoAlocado.objects.get_or_create(
                            data=self.data,
                            turno_reserva=turno_extra,
                            espaco=self.espaco,
                            defaults={'evento_ref': f'item_pendente'}
                        )
                    except IntegrityError:
                        raise ValidationError(
                            "O espaço já está reservado no turno da Tarde nesta data por outro evento ou reserva."
                        )
        else:
            if self.alocacao_fisica:
                self.alocacao_fisica.delete()
                self.alocacao_fisica = None

        super().save(*args, **kwargs)

        # Atualiza referência nas alocações extras após ter o ID
        if self.espaco != EventoTurma.EspacoEscola.EXTERNO and self.hora_inicio and self.hora_fim:
            turnos = EventoTurma._calcular_turnos_cruzados(self.hora_inicio, self.hora_fim)
            if len(turnos) > 1:
                for turno_extra in turnos[1:]:
                    EspacoAlocado.objects.filter(
                        data=self.data, turno_reserva=turno_extra, espaco=self.espaco
                    ).update(evento_ref=f'item_{self.id}')

class RegistroPresenca(models.Model):
    """ Mapeia se um aluno específico estava presente em um dia específico da turma """
    class Status(models.TextChoices):
        PRESENTE = 'PRESENTE', _('Presente')
        FALTA = 'FALTA', _('Falta')
        JUSTIFICADA = 'JUSTIFICADA', _('Falta Justificada')

    inscricao = models.ForeignKey(Inscricao, on_delete=models.CASCADE, related_name='presencas')
    evento = models.ForeignKey(EventoTurma, on_delete=models.CASCADE, related_name='presencas_evento')
    status = models.CharField(
        max_length=20, 
        choices=Status.choices, 
        default=Status.PRESENTE, 
        verbose_name="Status de Presença"
    )

    class Meta:
        db_table = 'catalogo_presencas'
        verbose_name = 'Registro de Presença'
        verbose_name_plural = 'Registros de Presença'
        constraints = [
            models.UniqueConstraint(fields=['inscricao', 'evento'], name='unique_inscricao_evento')
        ]

# ==========================================
# MÓDULO EAD (LMS) E PROGRESSO
# ==========================================

class Modulo(models.Model):
    """ Agrupador de atividades (Ex: Módulo 1 - Introdução) """
    turma = models.ForeignKey(Turma, on_delete=models.CASCADE, related_name='modulos')
    titulo = models.CharField(max_length=255, verbose_name="Título do Módulo")
    ordem = models.PositiveIntegerField(default=0, verbose_name="Ordem de Exibição")
    is_active = models.BooleanField(default=True, verbose_name="Ativo")

    class Meta:
        db_table = 'lms_modulos'
        verbose_name = 'Módulo'
        verbose_name_plural = 'Módulos'
        ordering = ['ordem']

    def __str__(self):
        return f"{self.turma.codigo_turma} - {self.titulo}"


class Atividade(models.Model):
    """ O conteúdo em si: Vídeo do YouTube, Texto, ou Arquivo """
    class Tipo(models.TextChoices):
        VIDEO_YOUTUBE = 'VIDEO_YOUTUBE', _('Vídeo (YouTube)')
        LEITURA = 'LEITURA', _('Material de Leitura / Link')
        TAREFA = 'TAREFA', _('Tarefa Prática')

    modulo = models.ForeignKey(Modulo, on_delete=models.CASCADE, related_name='atividades')
    titulo = models.CharField(max_length=255, verbose_name="Título da Atividade")
    descricao = models.TextField(blank=True, null=True, verbose_name="Instruções / Texto")
    tipo = models.CharField(max_length=20, choices=Tipo.choices, default=Tipo.VIDEO_YOUTUBE)

    url_video = models.URLField(blank=True, null=True, verbose_name="Link do YouTube")
    carga_horaria_recompensa = models.PositiveIntegerField(
        default=0,
        verbose_name="Carga Horária (Recompensa)",
        help_text="Quantas horas o aluno ganha ao concluir esta atividade?"
    )
    ordem = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True, verbose_name="Ativo")

    # ── CONTROLE DE CARGA HORÁRIA: aprovação pelo Admin ──────────────────────
    aprovado_admin = models.BooleanField(
        default=False,
        verbose_name="Aprovado pelo Admin",
        help_text="Atividades EAD/Híbrido só somam carga horária após aprovação do administrador."
    )
    aprovado_por = models.ForeignKey(
        'users.Profile',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='atividades_aprovadas',
        verbose_name="Aprovado por"
    )
    aprovado_em = models.DateTimeField(null=True, blank=True, verbose_name="Data de Aprovação")

    class Meta:
        db_table = 'lms_atividades'
        verbose_name = 'Atividade'
        verbose_name_plural = 'Atividades'
        ordering = ['ordem']

    def __str__(self):
        return self.titulo


class ProgressoAtividade(models.Model):
    """ Rastreador: Qual aluno concluiu qual atividade """
    inscricao = models.ForeignKey(Inscricao, on_delete=models.CASCADE, related_name='progressos')
    atividade = models.ForeignKey(Atividade, on_delete=models.CASCADE, related_name='conclusoes')
    concluido = models.BooleanField(default=True)
    data_conclusao = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'lms_progresso_alunos'
        constraints = [
            models.UniqueConstraint(fields=['inscricao', 'atividade'], name='unique_inscricao_atividade')
        ]
class ProgressoSessaoEAD(models.Model):
    progresso = models.ForeignKey(ProgressoAtividade, on_delete=models.CASCADE, related_name='sessoes')
    timestamp_ping = models.DateTimeField(auto_now_add=True)
    duracao_minutos = models.IntegerField(default=1)

    class Meta:
        db_table = 'lms_progresso_sessoes_ead'
        ordering = ['-timestamp_ping']


# ============================================================
# MÓDULO DE AUDITORIA — HistoricoAlteracao
# Registra alterações em Notas (Inscricao.nota) e Presenças
# (RegistroPresenca.status) via Signals do Django.
# ============================================================

class HistoricoAlteracao(models.Model):
    """Audit trail leve para rastrear mudanças críticas de dados acadêmicos."""

    class TipoAcao(models.TextChoices):
        NOTA_ALTERADA = 'NOTA_ALTERADA', _('Nota Alterada')
        PRESENCA_ALTERADA = 'PRESENCA_ALTERADA', _('Presença Alterada')
        DIARIO_FECHADO = 'DIARIO_FECHADO', _('Diário Fechado')

    tipo_acao = models.CharField(
        max_length=30, choices=TipoAcao.choices, verbose_name="Tipo de Ação"
    )
    # Quem fez a ação (pode ser null se o signal não tiver contexto de request)
    usuario = models.ForeignKey(
        'users.Profile', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='historico_alteracoes',
        verbose_name="Usuário Responsável"
    )
    # Referência ao objeto alterado (ex: inscricao_id ou presenca_id)
    tabela_referencia = models.CharField(max_length=80, verbose_name="Tabela/Objeto")
    objeto_id = models.CharField(max_length=50, verbose_name="ID do Objeto")
    # Os valores antes e depois da mudança (armazenados como texto)
    valor_anterior = models.TextField(verbose_name="Valor Anterior", blank=True, null=True)
    valor_novo = models.TextField(verbose_name="Valor Novo", blank=True, null=True)
    # Campos de auditoria
    timestamp = models.DateTimeField(auto_now_add=True, verbose_name="Data/Hora")
    ip = models.GenericIPAddressField(null=True, blank=True, verbose_name="IP de Origem")

    class Meta:
        db_table = 'catalogo_auditoria'
        verbose_name = 'Histórico de Alteração'
        verbose_name_plural = 'Histórico de Alterações'
        ordering = ['-timestamp']

    def __str__(self):
        return f"[{self.tipo_acao}] obj={self.objeto_id} em {self.timestamp:%d/%m/%Y %H:%M}"


# ──────────────────────────────────────────────────────────────
# SIGNALS — Captura automática de alterações
# ──────────────────────────────────────────────────────────────

@receiver(pre_save, sender='cursos.Inscricao')
def signal_nota_alterada(sender, instance, **kwargs):
    """
    Dispara antes de salvar uma Inscricao.
    Se a nota mudou em relação ao valor persistido no BD, registra o histórico.
    """
    if not instance.pk:
        return  # Novo registro, nada a comparar
    try:
        anterior = sender.objects.get(pk=instance.pk)
    except sender.DoesNotExist:
        return

    # Compara o valor antigo com o novo
    nota_anterior = anterior.nota
    nota_nova = instance.nota

    if str(nota_anterior) != str(nota_nova):  # Mudança detectada
        # Tenta pegar o usuário e IP do contexto de thread local (injetado pela View)
        from cursos._audit_context import get_audit_context
        ctx = get_audit_context()
        HistoricoAlteracao.objects.create(
            tipo_acao=HistoricoAlteracao.TipoAcao.NOTA_ALTERADA,
            usuario_id=ctx.get('usuario_id'),
            tabela_referencia='catalogo_inscricoes',
            objeto_id=str(instance.pk),
            valor_anterior=str(nota_anterior) if nota_anterior is not None else 'sem nota',
            valor_novo=str(nota_nova) if nota_nova is not None else 'removida',
            ip=ctx.get('ip'),
        )


@receiver(pre_save, sender='cursos.RegistroPresenca')
def signal_presenca_alterada(sender, instance, **kwargs):
    """
    Dispara antes de salvar um RegistroPresenca.
    Se o status mudou, registra o histórico.
    """
    if not instance.pk:
        return  # Novo registro
    try:
        anterior = sender.objects.get(pk=instance.pk)
    except sender.DoesNotExist:
        return

    status_anterior = anterior.status
    status_novo = instance.status

    if status_anterior != status_novo:
        from cursos._audit_context import get_audit_context
        ctx = get_audit_context()
        HistoricoAlteracao.objects.create(
            tipo_acao=HistoricoAlteracao.TipoAcao.PRESENCA_ALTERADA,
            usuario_id=ctx.get('usuario_id'),
            tabela_referencia='catalogo_presencas',
            objeto_id=str(instance.pk),
            valor_anterior=status_anterior,
            valor_novo=status_novo,
            ip=ctx.get('ip'),
        )
