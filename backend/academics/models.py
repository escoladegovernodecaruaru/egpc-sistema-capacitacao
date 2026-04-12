import uuid
from django.db import models
from django.utils.translation import gettext_lazy as _
from users.models import Profile

class StatusTurma(models.TextChoices):
    EM_ANDAMENTO = 'EM_ANDAMENTO', _('Em Andamento')
    PREVISTA = 'PREVISTA', _('Prevista')
    CONCLUIDA = 'CONCLUIDA', _('Concluída')
    FINALIZADA = 'FINALIZADA', _('Finalizada')
    ADIADA = 'ADIADA', _('Adiada')
    CANCELADA = 'CANCELADA', _('Cancelada')


class Curso(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    codigo = models.CharField(max_length=10, unique=True, verbose_name="Código do Curso (000/AAAA)")
    titulo = models.CharField(max_length=255, verbose_name="Título")
    descricao = models.TextField(verbose_name="Descrição")
    
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'cursos'
        verbose_name = 'Curso'
        verbose_name_plural = 'Cursos'

    def __str__(self):
        return f"{self.codigo} - {self.titulo}"

    @property
    def status_geral(self):
        turmas = self.turmas.all()
        if not turmas.exists():
            return 'SEM_TURMAS'
            
        statuses = [t.status for t in turmas]
        
        # Ordem de prioridade (menor número = maior prioridade)
        prioridade = {
            StatusTurma.EM_ANDAMENTO: 1,
            StatusTurma.PREVISTA: 2,
            StatusTurma.CONCLUIDA: 3,
            StatusTurma.FINALIZADA: 4,
            StatusTurma.ADIADA: 5,
            StatusTurma.CANCELADA: 6,
        }
        
        # Encontra o status com a maior prioridade
        melhor_status = min(statuses, key=lambda s: prioridade.get(s, 99))
        return melhor_status


class Turma(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    curso = models.ForeignKey(Curso, related_name='turmas', on_delete=models.CASCADE)
    codigo = models.CharField(max_length=50, verbose_name="Código da Turma (Ex: T01)")
    instrutor = models.ForeignKey(Profile, related_name='turmas_lecionadas', on_delete=models.SET_NULL, null=True, blank=True)
    
    status = models.CharField(
        max_length=20,
        choices=StatusTurma.choices,
        default=StatusTurma.PREVISTA,
        verbose_name="Status da Turma"
    )
    
    vagas = models.PositiveIntegerField(default=30)
    data_inicio = models.DateField(blank=True, null=True)
    data_fim = models.DateField(blank=True, null=True)
    
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'turmas'
        verbose_name = 'Turma'
        verbose_name_plural = 'Turmas'
        unique_together = ('curso', 'codigo')

    def __str__(self):
        return f"{self.curso.codigo} - {self.codigo}"


# Estrutura de Hibridismo (Presencial / Digital)
class EncontroPresencial(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    turma = models.ForeignKey(Turma, related_name='encontros_presenciais', on_delete=models.CASCADE)
    data = models.DateField()
    TurnoChoices = models.TextChoices('TurnoChoices', 'MANHA TARDE NOITE')
    turno = models.CharField(max_length=10, choices=TurnoChoices.choices)
    local = models.CharField(max_length=255, verbose_name="Local (Sala/Auditório)")

    class Meta:
        db_table = 'encontros_presenciais'


class ModuloDigital(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    turma = models.ForeignKey(Turma, related_name='modulos_digitais', on_delete=models.CASCADE)
    titulo = models.CharField(max_length=255)
    url_youtube = models.URLField(verbose_name="Link do YouTube")
    carga_horaria_minutos = models.PositiveIntegerField()

    class Meta:
        db_table = 'modulos_digitais'


class StatusMatricula(models.TextChoices):
    PENDENTE = 'PENDENTE', _('Pendente')
    CONFIRMADA = 'CONFIRMADA', _('Confirmada')
    CURSANDO = 'CURSANDO', _('Cursando')
    CONCLUIDA = 'CONCLUIDA', _('Concluída')
    DESISTENTE = 'DESISTENTE', _('Desistente (Suspensão)')

class Matricula(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    estudante = models.ForeignKey(Profile, related_name='matriculas', on_delete=models.CASCADE)
    turma = models.ForeignKey(Turma, related_name='matriculas', on_delete=models.CASCADE)
    status = models.CharField(
        max_length=20,
        choices=StatusMatricula.choices,
        default=StatusMatricula.PENDENTE
    )
    dados_extras = models.JSONField(
        blank=True, 
        null=True, 
        verbose_name="Dados Extras da Matrícula",
        help_text="Usado se o curso exige preenchimento de requisitos específicos no momento da inscrição."
    )
    data_matricula = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'matriculas'
        verbose_name = 'Matrícula'
        verbose_name_plural = 'Matrículas'
        unique_together = ('estudante', 'turma')

    def __str__(self):
        return f"{self.estudante.cpf} -> {self.turma}"
