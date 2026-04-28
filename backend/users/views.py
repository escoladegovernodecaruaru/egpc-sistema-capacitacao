import logging
from django.conf import settings
from django.utils import timezone
from rest_framework import status, views, generics
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAdminUser
from jose import jwt as jose_jwt, JWTError, ExpiredSignatureError
from .models import Profile
from .serializers import ProfileSerializer
from .authentication import SupabaseJWTAuthentication, SupabaseTokenValidator, _obter_jwks
logger = logging.getLogger(__name__)


class PreValidateProfileView(views.APIView):
    """
    Endpoint de pré-validação de Cadastro.
    Verifica se CPF, E-mail ou Telefone já existem antes de iniciar o fluxo no Supabase.
    Retorna 400 com os campos conflitantes ou 200 se tudo estiver disponível.
    """
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        cpf      = request.data.get('cpf')
        email    = request.data.get('email')
        telefone = request.data.get('telefone')

        errors = {}

        if cpf and Profile.objects.filter(cpf=cpf).exists():
            errors['cpf'] = 'Este CPF já está cadastrado no sistema.'

        if email and Profile.objects.filter(email=email).exists():
            errors['email'] = 'Este e-mail já está em uso.'

        if telefone and Profile.objects.filter(telefone=telefone).exists():
            errors['telefone'] = 'Este telefone já está em uso por outra conta.'

        if errors:
            return Response({"status": "error", "errors": errors}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"status": "success", "message": "Dados disponíveis para cadastro."}, status=status.HTTP_200_OK)


from rest_framework.throttling import AnonRateThrottle

class LookupEmailByCpfView(views.APIView):
    """
    Endpoint de consulta de e-mail por CPF, usado no fluxo de Login.
    Mascarado por segurança (ex: ma****os@gmail.com).
    """
    permission_classes = [AllowAny]
    throttle_classes = [AnonRateThrottle]

    def post(self, request, *args, **kwargs):
        cpf = (request.data.get('cpf') or '').replace('.', '').replace('-', '').strip()

        if len(cpf) != 11 or not cpf.isdigit():
            return Response(
                {"detail": "Informe um CPF válido com 11 dígitos."},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY
            )

        try:
            profile = Profile.objects.only('email').get(cpf=cpf, is_active=True)
        except Profile.DoesNotExist:
            return Response(
                {"detail": "CPF não cadastrado. Verifique ou realize seu cadastro."},
                status=status.HTTP_404_NOT_FOUND
            )

        # Mascarar o email: mantem 2 primeiros caracteres, 2 ultimos antes da @, e o dominio
        try:
            name_part, domain_part = profile.email.split('@')
            if len(name_part) > 4:
                masked_name = name_part[:2] + '*' * (len(name_part) - 4) + name_part[-2:]
            else:
                masked_name = name_part[:1] + '*' * (len(name_part) - 1)
            email_mascarado = f"{masked_name}@{domain_part}"
        except:
            email_mascarado = profile.email # fallback if split fails

        return Response({
            "email":      email_mascarado,  # para exibição na UI
            "email_real": profile.email,    # para autenticação no Supabase
        }, status=status.HTTP_200_OK)


class RegisterProfileView(views.APIView):
    """
    Endpoint de cadastro do Perfil no Django.
    Usa SupabaseTokenValidator: valida JWT sem exigir Profile no banco (problema ovo-galinha).
    """
    authentication_classes = [SupabaseTokenValidator]
    permission_classes     = [AllowAny]

    def post(self, request, *args, **kwargs):
        payload = getattr(request, 'supabase_payload', None)
        if not payload:
            return Response(
                {"detail": "Token de autorização ausente ou inválido."},
                status=status.HTTP_401_UNAUTHORIZED
            )

        user_id = payload.get('sub')
        if not user_id:
            return Response({"detail": "JWT sem UUID (sub)."}, status=status.HTTP_401_UNAUTHORIZED)

        if Profile.objects.filter(id=user_id).exists():
            return Response(
                {"detail": "O perfil para este usuário já existe."},
                status=status.HTTP_400_BAD_REQUEST
            )

        data          = request.data
        cpf           = data.get('cpf')
        email         = data.get('email')
        telefone      = data.get('telefone')
        nome_completo = data.get('nome_completo')
        nome_social   = data.get('nome_social', '')
        tipo_usuario  = data.get('tipo_usuario', Profile.UserType.CIDADAO)
        dados_servidor = data.get('dados_servidor', {})

        if dados_servidor and dados_servidor.get('cpf_chefe') == cpf:
            return Response(
                {"detail": "O CPF da sua chefia não pode ser idêntico ao seu próprio CPF."},
                status=status.HTTP_400_BAD_REQUEST
            )
        if not all([cpf, email, nome_completo]):
            return Response(
                {"detail": "CPF, E-mail e Nome Completo são obrigatórios."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Resolve o Conflito de Instrutor "Casca" (Fantasma)
        # Se um admin atribuiu um instrutor que não existia, o sistema criou um perfil genérico (com UUID aleatório).
        # Agora o usuário real surgiu do Supabase com o seu verdadeiro UUID (`user_id`).
        fantasma = Profile.objects.filter(cpf=cpf).first()
        transferir_turmas = False
        
        if fantasma:
            if fantasma.email == f'pendente_{cpf}@escola.local':
                transferir_turmas = True
            else:
                return Response({"detail": "CPF já está em uso."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                if transferir_turmas:
                    # Salvar as turmas onde ele era instrutor para re-atrelar
                    from cursos.models import Turma
                    turmas_afetadas = list(Turma.objects.filter(instrutor=fantasma))
                    fantasma.delete() # Exclui a casca para liberar o CPF

                profile = Profile.objects.create(
                    id=user_id,
                    cpf=cpf,
                    email=email,
                    telefone=telefone or None,
                    nome_completo=nome_completo,
                    nome_social=nome_social or None,
                    tipo_usuario=tipo_usuario,
                    dados_servidor=dados_servidor,
                    data_ultima_confirmacao=timezone.now().date()
                )

                if transferir_turmas:
                    # Reatribui as turmas ao novo perfil real
                    for t in turmas_afetadas:
                        t.instrutor = profile
                        t.save()

        except Exception as exc:
            logger.error("Erro ao criar Profile para user_id=%s: %s", user_id, exc)
            return Response(
                {"detail": f"Erro interno ao criar perfil: {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        serializer = ProfileSerializer(profile)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class MyProfileView(views.APIView):
    """
    GET   /api/users/auth/me/   → dados do perfil autenticado
    PATCH /api/users/auth/me/   → atualiza campos permitidos (nome_social, telefone, email_chefe)
    """
    authentication_classes = [SupabaseJWTAuthentication]
    permission_classes     = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        serializer = ProfileSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request, *args, **kwargs):
        profile          = request.user
        campos_alterados = {}

        # Campos de nível raiz editáveis pelo próprio usuário
        for campo in ("nome_social", "telefone"):
            if campo in request.data:
                valor = request.data[campo]
                campos_alterados[campo] = valor if valor != "" else None

        # Campos dentro do JSONField dados_servidor
        dados_servidor_atual = dict(profile.dados_servidor or {})
        ds_changed = False
        for campo_ds in ("cpf_chefe", "secretaria"):
            if campo_ds in request.data:
                valor_ds = request.data[campo_ds]
                dados_servidor_atual[campo_ds] = valor_ds if valor_ds != "" else None
                ds_changed = True

        if ds_changed:
            campos_alterados["dados_servidor"] = dados_servidor_atual

        if not campos_alterados:
            return Response({"detail": "Nenhum campo editável foi enviado."}, status=status.HTTP_400_BAD_REQUEST)

        # Valida unicidade do telefone (exclui o próprio usuário)
        novo_tel = campos_alterados.get("telefone")
        if novo_tel and Profile.objects.exclude(id=profile.id).filter(telefone=novo_tel).exists():
            return Response(
                {"detail": "Este telefone já está em uso por outra conta."},
                status=status.HTTP_400_BAD_REQUEST
            )

        for campo, valor in campos_alterados.items():
            setattr(profile, campo, valor)
        profile.save(update_fields=list(campos_alterados.keys()) + ["atualizado_em"])

        return Response(ProfileSerializer(profile).data, status=status.HTTP_200_OK)


class FotoPerfilView(views.APIView):
    """
    POST /api/users/auth/foto/
    Recebe multipart/form-data com campo 'foto'.
    Pipeline: Pillow → crop 400×400 → WebP q85 → R2 (ou local) → URL salva no Profile.
    """
    authentication_classes = [SupabaseJWTAuthentication]
    permission_classes     = [IsAuthenticated]

    TAMANHO_ALVO   = (400, 400)
    QUALIDADE_WEBP = 85
    MAX_MB         = 8

    def post(self, request, *args, **kwargs):
        from PIL import Image, UnidentifiedImageError
        from io import BytesIO
        from django.core.files.base import ContentFile
        import uuid as _uuid

        arquivo = request.FILES.get("foto")
        if not arquivo:
            return Response({"detail": "Campo 'foto' ausente no multipart."}, status=status.HTTP_400_BAD_REQUEST)

        if arquivo.size > self.MAX_MB * 1024 * 1024:
            return Response(
                {"detail": f"Arquivo maior que {self.MAX_MB}MB."},
                status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
            )

        # Abre e valida com Pillow
        try:
            img = Image.open(arquivo)
            img.verify()    # Verifica integridade (consome o stream)
            arquivo.seek(0) # Rebobina para releitura
            img = Image.open(arquivo)
        except UnidentifiedImageError:
            return Response({"detail": "Arquivo inválido. Envie JPG, PNG ou WebP."}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            logger.error("Pillow open error: %s", exc)
            return Response({"detail": "Erro ao abrir a imagem."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Converte para RGB → elimina transparência (fundo branco)
            if img.mode in ("RGBA", "P", "LA"):
                base = Image.new("RGB", img.size, (255, 255, 255))
                if img.mode == "P":
                    img = img.convert("RGBA")
                mask = img.split()[-1] if img.mode in ("RGBA", "LA") else None
                base.paste(img, mask=mask)
                img = base
            elif img.mode != "RGB":
                img = img.convert("RGB")

            # Crop central quadrado
            w, h = img.size
            lado = min(w, h)
            img  = img.crop(((w - lado) // 2, (h - lado) // 2, (w + lado) // 2, (h + lado) // 2))

            # Redimensiona e encoda como WebP
            img    = img.resize(self.TAMANHO_ALVO, Image.LANCZOS)
            buffer = BytesIO()
            img.save(buffer, format="WEBP", quality=self.QUALIDADE_WEBP, method=6)
            buffer.seek(0)

        except Exception as exc:
            logger.error("Pillow processing error: %s", exc)
            return Response({"detail": "Erro ao processar a imagem."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Persiste no storage (R2) primeiro para garantir atomicidade de rede
        profile = request.user
        old_foto = profile.foto_perfil if profile.foto_perfil else None
        
        nome = f"{profile.id}_{_uuid.uuid4().hex[:8]}.webp"
        profile.foto_perfil.save(nome, ContentFile(buffer.read()), save=True)

        # Remove foto anterior do storage somente após salvar a nova
        if old_foto and old_foto.name != profile.foto_perfil.name:
            try:
                old_foto.delete(save=False)
            except Exception:
                pass  # Não interrompe o fluxo se a deleção no R2 falhar

        return Response({"foto_url": profile.foto_perfil.url}, status=status.HTTP_200_OK)

class ListaInstrutoresView(generics.ListAPIView):
    """ Retorna todos os usuários que são instrutores para o select do formulário """
    serializer_class = ProfileSerializer
    authentication_classes = [SupabaseJWTAuthentication]
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get_queryset(self):
        return Profile.objects.filter(tipo_usuario='INSTRUTOR', is_active=True).order_by('nome_completo')
    
class AdminUserListView(generics.ListAPIView):
    """ GET: Retorna todos os usuários do sistema para o painel Admin """
    serializer_class = ProfileSerializer
    authentication_classes = [SupabaseJWTAuthentication]
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get_queryset(self):
        return Profile.objects.all().order_by('nome_completo')


class AdminUserUpdateView(generics.UpdateAPIView):
    """ PATCH: Permite ao Admin editar dados sensíveis (is_staff, is_active, tipo_usuario) """
    serializer_class = ProfileSerializer
    authentication_classes = [SupabaseJWTAuthentication]
    permission_classes = [IsAuthenticated, IsAdminUser]
    queryset = Profile.objects.all()


class ToggleSolicitanteView(views.APIView):
    """
    PATCH /api/users/admin/usuarios/<uuid>/toggle-solicitante/
    Ativa ou desativa a permissão de Solicitante de reservas para um usuário.
    Retorna o novo estado do campo is_solicitante.
    """
    authentication_classes = [SupabaseJWTAuthentication]
    permission_classes = [IsAuthenticated, IsAdminUser]

    def patch(self, request, pk, *args, **kwargs):
        try:
            perfil = Profile.objects.get(pk=pk)
        except Profile.DoesNotExist:
            return Response({"detail": "Usuário não encontrado."}, status=status.HTTP_404_NOT_FOUND)

        # Impede que o Admin retire a própria permissão de solicitante por engano
        if perfil.pk == request.user.pk and perfil.is_solicitante:
            return Response(
                {"detail": "Não é possível remover sua própria permissão de Solicitante."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Inverte o estado atual
        perfil.is_solicitante = not perfil.is_solicitante
        perfil.save(update_fields=["is_solicitante", "atualizado_em"])

        acao = "concedida" if perfil.is_solicitante else "removida"
        return Response({
            "is_solicitante": perfil.is_solicitante,
            "detail": f"Permissão de Solicitante {acao} para {perfil.nome_completo}."
        }, status=status.HTTP_200_OK)
