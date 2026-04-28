"""
_audit_context.py
Contexto de thread local para injetar dados de auditoria (usuário, IP)
nos Signals do Django sem precisar usar kwargs ou middleware global.

Uso nas Views:
    from cursos._audit_context import set_audit_context, clear_audit_context
    set_audit_context(usuario_id=request.user.id, ip=request.META.get('REMOTE_ADDR'))
    # ... salva objetos ...
    clear_audit_context()
"""
import threading

_local = threading.local()


def set_audit_context(usuario_id=None, ip=None):
    """Injeta o contexto do usuário e IP na thread atual."""
    _local.audit_context = {
        'usuario_id': str(usuario_id) if usuario_id else None,
        'ip': ip,
    }


def get_audit_context() -> dict:
    """Recupera o contexto. Retorna um dict vazio se não foi definido."""
    return getattr(_local, 'audit_context', {})


def clear_audit_context():
    """Limpa o contexto após o save para não vazar entre requisições."""
    if hasattr(_local, 'audit_context'):
        del _local.audit_context
