from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # ── Rotas de Autenticação Nativas (Login) ──
    path('api/auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # Prefixamos todas as rotas da nossa API com /api/
    path('api/users/', include('users.urls', namespace='users')),
    path('api/cursos/', include('cursos.urls', namespace='cursos')),
]