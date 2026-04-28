"""
Classe de autenticação customizada para o DRF que valida JWTs do Supabase.

O Supabase pode assinar tokens com dois algoritmos:
  - HS256 → chave simétrica (SUPABASE_JWT_SECRET do dashboard)
  - ES256 → chave assimétrica (chave privada deles; valida-se com a pública via JWKS)

Esta classe detecta automaticamente o algoritmo pelo header 'alg' do token e
roteia para a estratégia correta. As chaves JWKS são cacheadas em memória por
10 minutos para evitar latência desnecessária no fluxo de cada requisição.
"""

import time
import logging
import requests as http_requests

from django.conf import settings
from rest_framework import authentication, exceptions
from django.utils.translation import gettext_lazy as _
from jose import jwt as jose_jwt, JWTError, ExpiredSignatureError

from .models import Profile

logger = logging.getLogger(__name__)

import threading

# ─── Cache simples em memória para as JWKs públicas do Supabase ──────────────
_jwks_cache: dict = {}
_jwks_fetched_at: float = 0.0
_JWKS_TTL_SEGUNDOS = 600  # Re-busca as chaves a cada 10 minutos
_jwks_lock = threading.Lock()


def _obter_jwks(supabase_url: str) -> dict:
    """
    Busca as chaves públicas JWKS do Supabase.
    O endpoint padrão é: <SUPABASE_URL>/auth/v1/.well-known/jwks.json
    Retorna o JWKS cacheado enquanto o TTL não expirar.
    Usa Lock para evitar exaustão de sockets em requisições concorrentes.
    """
    global _jwks_cache, _jwks_fetched_at

    agora = time.monotonic()
    if _jwks_cache and (agora - _jwks_fetched_at) < _JWKS_TTL_SEGUNDOS:
        return _jwks_cache  # Cache ainda válido

    with _jwks_lock:
        # Double-check inside the lock in case another thread just updated it
        agora = time.monotonic()
        if _jwks_cache and (agora - _jwks_fetched_at) < _JWKS_TTL_SEGUNDOS:
            return _jwks_cache

        url = f"{supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
        try:
            resp = http_requests.get(url, timeout=5)
            resp.raise_for_status()
            _jwks_cache = resp.json()
            _jwks_fetched_at = agora
            logger.debug("JWKS do Supabase atualizadas com sucesso.")
        except Exception as exc:
            logger.warning("Falha ao buscar JWKS do Supabase: %s", exc)
            # Se já tínhamos cache antigo, retorna ele como fallback
            if _jwks_cache:
                return _jwks_cache
            raise exceptions.AuthenticationFailed(
                _("Não foi possível validar o token: falha ao obter chaves públicas do provedor.")
            )

    return _jwks_cache


class SupabaseTokenValidator(authentication.BaseAuthentication):
    """
    Classe de autenticação LEVE usada exclusivamente na RegisterProfileView.

    Difere da SupabaseJWTAuthentication por NÃO buscar o Profile no banco
    (o que seria impossível durante o cadastro, pois ele ainda não existe).

    Retorna (AnonymousUser, payload) se o token for válido, permitindo que
    a view acesse o payload com o user_id sem disparar 403/401.
    """
    from django.contrib.auth.models import AnonymousUser as _Anon

    def authenticate(self, request):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header or not auth_header.lower().startswith("bearer "):
            return None

        token = auth_header.split()[1]

        try:
            header = jose_jwt.get_unverified_header(token)
        except JWTError:
            raise exceptions.AuthenticationFailed(_("Token mal formado."))

        algoritmo = header.get("alg", "ES256")

        try:
            if algoritmo == "HS256":
                payload = jose_jwt.decode(
                    token,
                    settings.SUPABASE_JWT_SECRET,
                    algorithms=["HS256"],
                    options={"verify_aud": False},
                )
            else:
                supabase_url = getattr(settings, "SUPABASE_URL", "")
                if not supabase_url:
                    raise exceptions.AuthenticationFailed(_("SUPABASE_URL não configurada."))
                jwks = _obter_jwks(supabase_url)
                kid = header.get("kid")
                chaves = jwks.get("keys", [])
                chave = next((c for c in chaves if c.get("kid") == kid), None) or (chaves[0] if chaves else None)
                if not chave:
                    raise exceptions.AuthenticationFailed(_("Chave pública não encontrada."))
                payload = jose_jwt.decode(
                    token, chave, algorithms=["ES256"], options={"verify_aud": False}
                )
        except ExpiredSignatureError:
            raise exceptions.AuthenticationFailed(_("Token expirado."))
        except JWTError as exc:
            logger.debug("SupabaseTokenValidator — JWTError: %s", exc)
            raise exceptions.AuthenticationFailed(_("Token inválido."))

        # Armazena o payload decodificado no request para a view acessar
        request.supabase_payload = payload

        # Retorna AnonymousUser: o perfil ainda não existe, mas o JWT é legítimo
        from django.contrib.auth.models import AnonymousUser
        return (AnonymousUser(), token)


class SupabaseJWTAuthentication(authentication.BaseAuthentication):
    """
    Autentica requisições que chegam com o header:
        Authorization: Bearer <supabase_access_token>

    Fluxo:
      1. Extrai o token do header Authorization.
      2. Lê o algoritmo do header do JWT ('alg').
      3. Se for ES256 → valida usando a chave pública JWK do Supabase (JWKS endpoint).
         Se for HS256 → valida usando o SUPABASE_JWT_SECRET configurado no settings.
      4. Extrai o 'sub' (UUID do usuário Supabase) do payload.
      5. Busca e retorna o Profile correspondente no banco Django.
    """

    def authenticate(self, request):
        auth_header = request.headers.get("Authorization", "")

        if not auth_header:
            return None  # Sem header → DRF tentará outras classes de autenticação

        parts = auth_header.split()
        if parts[0].lower() != "bearer":
            return None
        if len(parts) != 2:
            raise exceptions.AuthenticationFailed(_("Token inválido. Formato esperado: 'Bearer <token>'."))

        token = parts[1]
        return self._validar_e_autenticar(token)

    def _validar_e_autenticar(self, token: str):
        """Decide a estratégia de validação baseada no algoritmo do JWT."""

        # Decodifica o header sem verificar assinatura para descobrir o alg
        try:
            header_nao_verificado = jose_jwt.get_unverified_header(token)
        except JWTError:
            raise exceptions.AuthenticationFailed(_("Token mal formado — não foi possível ler o header JWT."))

        algoritmo = header_nao_verificado.get("alg", "")
        algoritmo_esperado = getattr(settings, "SUPABASE_JWT_ALGORITHM", "ES256")

        # Validação extra: alerta se o token chegar com algo inesperado
        if algoritmo != algoritmo_esperado:
            logger.warning(
                "JWT recebido com alg='%s', mas SUPABASE_JWT_ALGORITHM='%s'. "
                "Verifique a configuração do seu projeto Supabase.",
                algoritmo,
                algoritmo_esperado,
            )

        try:
            if algoritmo == "HS256":
                payload = self._validar_hs256(token)
            elif algoritmo == "ES256":
                payload = self._validar_es256(token)
            else:
                raise exceptions.AuthenticationFailed(
                    _(f"Algoritmo JWT '{algoritmo}' não suportado. Configure SUPABASE_JWT_ALGORITHM corretamente.")
                )
        except ExpiredSignatureError:
            raise exceptions.AuthenticationFailed(_("O token expirou. Por favor, faça login novamente."))
        except JWTError as exc:
            logger.debug("JWTError na validação: %s", exc)
            raise exceptions.AuthenticationFailed(_("Token inválido ou adulterado."))

        return self._resolver_usuario(payload, token)

    def _validar_hs256(self, token: str) -> dict:
        """
        Valida um token HS256 usando o SUPABASE_JWT_SECRET (segredo compartilhado).
        Esse fluxo é adequado quando o projeto Supabase está configurado com JWT Secret.
        """
        segredo = settings.SUPABASE_JWT_SECRET
        return jose_jwt.decode(
            token,
            segredo,
            algorithms=["HS256"],
            options={"verify_aud": False},  # O /audience/ varia por projeto; desabilitamos
        )

    def _validar_es256(self, token: str) -> dict:
        """
        Valida um token ES256 buscando a chave pública correta no JWKS do Supabase.
        O 'kid' (Key ID) do header do token é usado para encontrar a chave certa
        no set de JWKs retornado pelo endpoint /.well-known/jwks.json.
        """
        supabase_url = getattr(settings, "SUPABASE_URL", None)
        if not supabase_url:
            raise exceptions.AuthenticationFailed(
                _("SUPABASE_URL não configurada no settings. Necessário para validação ES256.")
            )

        jwks = _obter_jwks(supabase_url)

        # Encontra a chave pelo kid, se disponível no header
        header = jose_jwt.get_unverified_header(token)
        kid_token = header.get("kid")
        chaves = jwks.get("keys", [])

        if kid_token:
            chave = next((c for c in chaves if c.get("kid") == kid_token), None)
            if not chave:
                # kid não encontrado → força re-fetch (chave pode ter sido rotacionada)
                global _jwks_fetched_at
                _jwks_fetched_at = 0.0
                jwks = _obter_jwks(supabase_url)
                chaves = jwks.get("keys", [])
                chave = next((c for c in chaves if c.get("kid") == kid_token), None)
        else:
            # Sem kid → usa a primeira chave disponível
            chave = chaves[0] if chaves else None

        if not chave:
            raise exceptions.AuthenticationFailed(_("Nenhuma chave pública encontrada para validar o token."))

        return jose_jwt.decode(
            token,
            chave,
            algorithms=["ES256"],
            options={"verify_aud": False},
        )

    def _resolver_usuario(self, payload: dict, token: str):
        """Extrai o user_id do payload e o mapeia para um Profile do Django."""
        user_id = payload.get("sub")
        if not user_id:
            raise exceptions.AuthenticationFailed(_("JWT sem campo 'sub' (identificador de usuário)."))

        try:
            usuario = Profile.objects.get(id=user_id)
        except Profile.DoesNotExist:
            raise exceptions.AuthenticationFailed(
                _("Nenhum perfil cadastrado para este token. Complete seu cadastro.")
            )

        if not usuario.is_active:
            raise exceptions.AuthenticationFailed(_("Esta conta está inativa ou desativada."))

        return (usuario, token)
