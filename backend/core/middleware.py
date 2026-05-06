import json
from django.utils.deprecation import MiddlewareMixin
from django.conf import settings

class AuditMiddleware(MiddlewareMixin):
    def process_request(self, request):
        if request.method not in ('POST', 'PUT', 'PATCH', 'DELETE'):
            return None
            
        if request.path.startswith('/admin/') or request.path.startswith('/media/'):
            return None
            
        from users.models import AuditLog
        
        payload = None
        if request.content_type == 'application/json':
            try:
                body = request.body
                if body:
                    payload = json.loads(body)
                    if 'password' in payload:
                        payload['password'] = '***'
            except Exception:
                pass

        user = request.user if request.user.is_authenticated else None
        
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')

        try:
            log = AuditLog.objects.create(
                user=user,
                method=request.method,
                path=request.path,
                ip_address=ip,
                user_agent=request.META.get('HTTP_USER_AGENT', '')[:255],
                payload=payload
            )
            # Injeta o ID do log no request para o process_response atualizá-lo
            request._audit_log_id = log.id
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Erro ao salvar AuditLog: {e}")
        
        return None

    def process_response(self, request, response):
        log_id = getattr(request, '_audit_log_id', None)
        if log_id is not None:
            try:
                from users.models import AuditLog
                AuditLog.objects.filter(id=log_id).update(response_status=response.status_code)
            except Exception as e:
                import logging
                logging.getLogger(__name__).error(f"Erro ao atualizar AuditLog response_status: {e}")
        return response
