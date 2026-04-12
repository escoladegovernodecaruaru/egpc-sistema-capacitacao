from django.contrib import admin
from django.utils.html import format_html

from .models import Curso, Turma, Inscricao

STATUS_CORES = {
    'EM_ANDAMENTO': '#22c55e',
    'PREVISTA':     '#38bdf8',
    'CONCLUIDA':    '#94a3b8',
    'FINALIZADA':   '#475569',
    'ADIADA':       '#f59e0b',
    'CANCELADA':    '#ef4444',
    'SEM_TURMAS':   '#52525b',
}
STATUS_LABELS = {
    'EM_ANDAMENTO': 'Em Andamento',
    'PREVISTA':     'Prevista',
    'CONCLUIDA':    'Concluída',
    'FINALIZADA':   'Finalizada',
    'ADIADA':       'Adiada',
    'CANCELADA':    'Cancelada',
    'SEM_TURMAS':   'Sem Turmas',
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


class TurmaInline(admin.StackedInline):
    model = Turma
    extra = 0
    show_change_link = True
    readonly_fields = ('codigo_turma_display', 'status_display', 'vagas_ocupadas')
    fields = (
        ('letra', 'turno', 'carga_horaria'),
        ('data_inicio', 'data_fim'),
        ('instrutor', 'local', 'vagas', 'custo'),
        ('status_manual', 'is_active'),
        ('codigo_turma_display', 'status_display', 'vagas_ocupadas'),
    )

    @admin.display(description="Cód. Turma")
    def codigo_turma_display(self, obj):
        return obj.codigo_turma if obj.pk else "—"

    @admin.display(description="Status")
    def status_display(self, obj):
        if not obj.pk:
            return "—"
        s = obj.status_calculado
        return format_html(
            '<span style="color:{};font-weight:600;">● {}</span>',
            STATUS_CORES.get(s, '#94a3b8'),
            STATUS_LABELS.get(s, s),
        )

    @admin.display(description="Vagas Ocupadas")
    def vagas_ocupadas(self, obj):
        if not obj.pk:
            return "—"
        ocupadas = obj.inscricoes.filter(
            status__in=[Inscricao.Status.INSCRITO, Inscricao.Status.APROVADO_CHEFIA]
        ).count()
        return f"{ocupadas} / {obj.vagas}"


# ─── CursoAdmin ───────────────────────────────────────────────────────────────

@admin.register(Curso)
class CursoAdmin(admin.ModelAdmin):
    list_display  = ('codigo_oficial', 'titulo', 'tipo', 'status_geral_display', 'total_turmas', 'is_active')
    list_filter   = ('tipo', 'is_active')
    search_fields = ('titulo', 'codigo_oficial', 'num_processo', 'memorando')
    readonly_fields = ('codigo_oficial', 'status_geral_display', 'criado_em', 'atualizado_em')
    ordering = ('-codigo_oficial',)
    inlines = [TurmaInline]

    fieldsets = (
        ('Identificação', {'fields': ('codigo_oficial', 'titulo', 'tipo')}),
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
            STATUS_LABELS.get(s, s),
        )

    @admin.display(description="Turmas")
    def total_turmas(self, obj):
        return obj.turmas.count()

    def delete_model(self, request, obj):
        obj.delete()

    def delete_queryset(self, request, queryset):
        for obj in queryset:
            obj.delete()


# ─── TurmaAdmin ───────────────────────────────────────────────────────────────

@admin.register(Turma)
class TurmaAdmin(admin.ModelAdmin):
    list_display  = ('codigo_turma', 'curso', 'turno', 'local', 'vagas', 'data_inicio', 'data_fim', 'status_display', 'is_active')
    list_filter   = ('turno', 'status_manual', 'is_active', 'curso')
    search_fields = ('curso__titulo', 'curso__codigo_oficial', 'letra', 'local')
    readonly_fields = ('codigo_turma', 'status_calculado', 'criado_em', 'atualizado_em')
    date_hierarchy = 'data_inicio'
    inlines = [InscricaoInline]

    fieldsets = (
        ('Identificação', {'fields': ('curso', 'letra', 'codigo_turma')}),
        ('Execução',      {'fields': (('instrutor', 'local'), ('vagas', 'carga_horaria', 'custo'), ('data_inicio', 'data_fim', 'turno'))}),
        ('Status',        {'fields': ('status_calculado', 'status_manual', 'is_active')}),
        ('Auditoria',     {'classes': ('collapse',), 'fields': ('criado_em', 'atualizado_em')}),
    )

    @admin.display(description="Status")
    def status_display(self, obj):
        s = obj.status_calculado
        return format_html(
            '<span style="color:{};font-weight:600;">● {}</span>',
            STATUS_CORES.get(s, '#94a3b8'),
            STATUS_LABELS.get(s, s),
        )

    def delete_model(self, request, obj):
        obj.delete()

    def delete_queryset(self, request, queryset):
        for obj in queryset:
            obj.delete()


# ─── InscricaoAdmin ───────────────────────────────────────────────────────────

@admin.register(Inscricao)
class InscricaoAdmin(admin.ModelAdmin):
    list_display  = ('perfil', 'turma', 'status', 'data_inscricao', 'hash_validacao')
    list_filter   = ('status', 'turma__curso')
    search_fields = ('perfil__nome_completo', 'perfil__cpf', 'turma__curso__titulo', 'turma__letra')
    readonly_fields = ('hash_validacao', 'data_inscricao')
    date_hierarchy = 'data_inscricao'

    fieldsets = (
        ('Inscrição', {'fields': ('perfil', 'turma', 'status')}),
        ('Auditoria', {'classes': ('collapse',), 'fields': ('data_inscricao', 'hash_validacao')}),
    )
