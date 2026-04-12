import os
from pathlib import Path
import environ

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Instancia o environ
env = environ.Env(
    DEBUG=(bool, False)
)
# Le o arquivo .env se existir
environ.Env.read_env(os.path.join(BASE_DIR, '.env'))

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = env('SECRET_KEY', default='django-insecure-default-key-for-dev')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = env('DEBUG', default=True)

ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default=['*'])

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Terceiros
    'rest_framework',
    'corsheaders',

    # Apps do Projeto
    'users',
    'academics',
    'cursos',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware', # Deve vir o mais alto possível
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'core.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'core.wsgi.application'

# Database
# https://docs.djangoproject.com/en/4.2/ref/settings/#databases
DATABASES = {
    'default': env.db('DATABASE_URL', default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}")
}

# Custom User Model
AUTH_USER_MODEL = 'users.Profile'

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Internationalization
LANGUAGE_CODE = 'pt-br'
TIME_ZONE = 'America/Sao_Paulo'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = 'static/'

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# CORS
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
]

# Configurações do DRF
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'users.authentication.SupabaseJWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ]
}

# ─── Supabase Auth ─────────────────────────────────────────────────────────────
# SUPABASE_JWT_SECRET → usado apenas se o algoritmo for HS256
SUPABASE_JWT_SECRET    = env('SUPABASE_JWT_SECRET', default='substitua-pela-sua-chave-no-env')
# SUPABASE_JWT_ALGORITHM → 'ES256' (padrão novo) ou 'HS256' (projetos legados)
SUPABASE_JWT_ALGORITHM = env('SUPABASE_JWT_ALGORITHM', default='ES256')
# SUPABASE_URL → necessário para buscar as chaves públicas JWKS quando alg=ES256
SUPABASE_URL           = env('SUPABASE_URL', default='')

# ─── Cloudflare R2 (S3-compatible Storage) ─────────────────────────────────────
#
# django-storages usa internamente as variáveis AWS_*. Mapeamos explicitamente
# a partir das nossas variáveis R2_* para evitar qualquer ambiguidade.
#
# Variáveis obrigatórias no .env:
#   R2_ACCESS_KEY_ID      → Chave de acesso (Cloudflare → R2 → Manage API tokens)
#   R2_SECRET_ACCESS_KEY  → Segredo da chave
#   R2_BUCKET_NAME        → Nome do bucket (ex: "egpc-media")
#   R2_ENDPOINT_URL       → https://<ACCOUNT_ID>.r2.cloudflarestorage.com
#
# Variável opcional:
#   R2_PUBLIC_URL         → URL pública do bucket (domínio customizado ou r2.dev)
#                           Ex: https://pub-xxxx.r2.dev  ou  https://media.egpc.gov.br
#                           Necessária para que foto_perfil.url retorne link absoluto.

# Mapeamento explícito das variáveis R2 → nomenclatura AWS esperada pelo django-storages
AWS_ACCESS_KEY_ID      = env('R2_ACCESS_KEY_ID')           # Obrigatório — levanta ImproperlyConfigured se ausente
AWS_SECRET_ACCESS_KEY  = env('R2_SECRET_ACCESS_KEY')       # Obrigatório
AWS_STORAGE_BUCKET_NAME = env('R2_BUCKET_NAME')            # Obrigatório
AWS_S3_ENDPOINT_URL    = env('R2_ENDPOINT_URL')            # Obrigatório — endpoint R2

# R2 não usa ACLs (diferente do S3 tradicional)
AWS_DEFAULT_ACL        = None
# Não sobrescreve arquivos com o mesmo nome — gera nome único via uuid
AWS_S3_FILE_OVERWRITE  = False
# URLs sem query-string de assinatura (bucket público via R2_PUBLIC_URL)
AWS_QUERYSTRING_AUTH   = False
# Cache HTTP de 1 dia nos objetos servidos pelo R2
AWS_S3_OBJECT_PARAMETERS = {"CacheControl": "max-age=86400"}

# URL pública: custom domain (CDN / Workers) ou URL pública r2.dev
_r2_public_url = env('R2_PUBLIC_URL', default='')
if _r2_public_url:
    # custom_domain deve ser APENAS o hostname, sem protocolo nem barra final
    AWS_S3_CUSTOM_DOMAIN = (
        _r2_public_url
        .replace('https://', '')
        .replace('http://', '')
        .rstrip('/')
    )
    MEDIA_URL = f"https://{AWS_S3_CUSTOM_DOMAIN}/"
else:
    # Sem custom_domain: django-storages gera URLs assinadas/pré-assinadas a partir do endpoint
    MEDIA_URL = f"{AWS_S3_ENDPOINT_URL}/{AWS_STORAGE_BUCKET_NAME}/"

# Backend de storage padrão via STORAGES dict (Django 4.2+ — substitui DEFAULT_FILE_STORAGE)
STORAGES = {
    "default": {
        "BACKEND": "storages.backends.s3boto3.S3Boto3Storage",
    },
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}