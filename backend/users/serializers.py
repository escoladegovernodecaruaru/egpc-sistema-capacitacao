from rest_framework import serializers
from .models import Profile


class ProfileSerializer(serializers.ModelSerializer):
    """
    Serializer completo do Profile para o endpoint /auth/me/.
    Retorna todos os campos relevantes, incluindo os dados_servidor
    (secretaria, matrícula, etc.) e o status computado de bloqueio.
    """
    esta_bloqueado   = serializers.SerializerMethodField()
    tipo_usuario_display = serializers.CharField(
        source="get_tipo_usuario_display", read_only=True
    )
    # Extrai campos mais usados do JSONField para facilitar o consumo no frontend
    secretaria   = serializers.SerializerMethodField()
    matricula    = serializers.SerializerMethodField()
    empresa      = serializers.SerializerMethodField()
    cpf_chefe    = serializers.SerializerMethodField()
    # URL absoluta da foto de perfil (None se não houver)
    foto_perfil_url = serializers.SerializerMethodField()

    class Meta:
        model = Profile
        fields = [
            # Identificação
            "id", "cpf", "nome_completo", "nome_social",
            # Contato
            "email", "telefone",
            # Vínculo
            "tipo_usuario", "tipo_usuario_display",
            # Dados funcionais (raw + extraídos)
            "dados_servidor", "secretaria", "matricula", "empresa", "cpf_chefe",
            # Foto de perfil
            "foto_perfil_url",
            # Regras EGPC
            "esta_de_licenca", "bloqueado_ate", "data_ultima_confirmacao",
            "esta_bloqueado",
            # Metadata
            "is_active", "is_staff", "criado_em",
        ]
        read_only_fields = [
            "id", "cpf", "esta_bloqueado", "tipo_usuario_display",
            "secretaria", "matricula", "empresa", "cpf_chefe",
            "foto_perfil_url", "criado_em",
        ]

    def get_esta_bloqueado(self, obj: Profile) -> bool:
        return obj.esta_bloqueado()

    def _ds(self, obj: Profile) -> dict:
        """Retorna o dados_servidor de forma segura."""
        return obj.dados_servidor or {}

    def get_secretaria(self, obj):
        return self._ds(obj).get("secretaria")

    def get_matricula(self, obj):
        return self._ds(obj).get("matricula")

    def get_empresa(self, obj):
        return self._ds(obj).get("empresa")

    def get_cpf_chefe(self, obj):
        return self._ds(obj).get("cpf_chefe")

    def get_foto_perfil_url(self, obj) -> str | None:
        """Retorna a URL pública da foto ou None se não houver."""
        if obj.foto_perfil:
            try:
                return obj.foto_perfil.url
            except Exception:
                return None
        return None
