from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # Prefixamos todas as rotas da nossa API com /api/
    path('api/users/', include('users.urls', namespace='users')),
    path('api/academics/', include('academics.urls', namespace='academics')),
    path('api/cursos/', include('cursos.urls', namespace='cursos')),
]
