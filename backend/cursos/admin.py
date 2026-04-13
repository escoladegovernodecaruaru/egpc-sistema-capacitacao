from django.contrib import admin
from django.utils.html import format_html
from .models import Curso, Turma, EventoTurma, Inscricao

STATUS_CORES = {
    'EM_ANDAMENTO': '#22c55e',
    'PREVISTA':     '#38bdf8',
    'CONCLUIDA':    '#94a3b8',
    'FINALIZADA':   '#475569',
    'ADIADA':       '#f59e0b',
    'CANCELADA':    '#ef4444',
    'SEM_TURMAS':   '#52525b',
}

# ─── Inlines ──────────────────────────────────────────────────────────────────

class InscricaoInline(admin.TabularInline):
    model = Inscricao
    extra = 0
    can_delete = False
    show_change_link = True
    readonly_fields = ('perfil', 'status', 'data_inscricao', 'hash_validacao')
    fields = ('perfil', 'status', 'data_inscricao', 'hash_validacao')
    verbose_name_plural = "Inscrições (somente leitura)"

    def has_add_permission(self, request, obj=None):
        return False

class EventoTurmaInline(admin.TabularInline):
    model = EventoTurma
    extra = 1
    verbose_name = "Dia de Aula / Evento"
    verbose_name_plural = "Cronograma da Turma"

# ─── CursoAdmin ───────────────────────────────────────────────────────────────

@admin.register(Curso)
class CursoAdmin(admin.ModelAdmin):
    # Adicionado 'eixo' que criamos no Model
    list_display  = ('codigo_oficial', 'titulo', 'tipo', 'eixo', 'status_geral_display', 'is_active')
    list_filter   = ('tipo', 'eixo', 'is_active')
    search_fields = ('titulo', 'codigo_oficial', 'num_processo', 'memorando')
    readonly_fields = ('codigo_oficial', 'status_geral_display', 'criado_em', 'atualizado_em')
    ordering = ('-codigo_oficial',)

    fieldsets = (
        ('Identificação', {'fields': ('codigo_oficial', 'titulo', 'tipo', 'eixo')}),
        ('Documentação',  {'fields': ('num_processo', 'memorando')}),
        ('Conteúdo',      {'fields': ('ementa',)}),
        ('Controle',      {'fields': ('is_active', 'status_geral_display', 'criado_em', 'atualizado_em')}),
    )

    @admin.display(description="Status Geral")
    def status_geral_display(self, obj):
        s = obj.status_geral
        return format_html(
            '<span style="color:{};font-weight:600;">● {}</span>',
            STATUS_CORES.get(s, '#94a3b8'),
            s,
        )

# ─── TurmaAdmin ───────────────────────────────────────────────────────────────

@admin.register(Turma)
class TurmaAdmin(admin.ModelAdmin):
    # Removidos 'turno' e 'local' que estavam dando erro, adicionado 'modalidade'
    list_display  = ('codigo_turma', 'curso', 'modalidade', 'vagas', 'data_inicio', 'data_fim', 'status_display', 'is_active')
    list_filter   = ('modalidade', 'status_manual', 'is_active', 'curso')
    search_fields = ('curso__titulo', 'curso__codigo_oficial', 'letra')
    readonly_fields = ('codigo_turma', 'status_calculado', 'criado_em', 'atualizado_em')
    date_hierarchy = 'data_inicio'
    # Agora a Turma mostra os inscritos E o cronograma de dias de aula
    inlines = [EventoTurmaInline, InscricaoInline]

    fieldsets = (
        ('Identificação', {'fields': ('curso', 'letra', 'codigo_turma')}),
        ('Execução',      {'fields': (('instrutor', 'modalidade'), ('vagas', 'custo'), ('data_inicio', 'data_fim'))}),
        ('Status',        {'fields': ('status_calculado', 'status_manual', 'is_active')}),
        ('Auditoria',     {'classes': ('collapse',), 'fields': ('criado_em', 'atualizado_em')}),
    )

    @admin.display(description="Status")
    def status_display(self, obj):
        s = obj.status_calculado
        return format_html(
            '<span style="color:{};font-weight:600;">● {}</span>',
            STATUS_CORES.get(s, '#94a3b8'),
            s,
        )

# ─── InscricaoAdmin ───────────────────────────────────────────────────────────

@admin.register(Inscricao)
class InscricaoAdmin(admin.ModelAdmin):
    list_display  = ('perfil', 'turma', 'status', 'data_inscricao', 'hash_validacao')
    list_filter   = ('status', 'turma__curso')
    search_fields = ('perfil__nome_completo', 'perfil__cpf', 'turma__curso__titulo', 'turma__letra')
    readonly_fields = ('hash_validacao', 'data_inscricao')
    date_hierarchy = 'data_inscricao'