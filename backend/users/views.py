import logging
from django.conf import settings
from django.utils import timezone
from rest_framework import status, views, generics
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAdminUser
from .models import Profile
from .serializers import ProfileSerializer
import random
from datetime import timedelta
from django.core.mail import send_mail
from django.conf import settings
from .models import OTPCode
from django.db import transaction
from rest_framework.throttling import AnonRateThrottle
logger = logging.getLogger(__name__)


class PreValidateProfileView(views.APIView):
    """
    Endpoint de pré-validação de Cadastro.
    Verifica se CPF, E-mail ou Telefone já existem antes de iniciar o fluxo de cadastro.
    Retorna 400 com os campos conflitantes ou 200 se tudo estiver disponível.
    """
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        cpf      = request.data.get('cpf')
        email    = request.data.get('email')

        errors = {}

        fantasma = Profile.objects.filter(cpf=cpf).first()
        EMAIL_FANTASMA = f'pendente_{cpf}@escola.local'

        if cpf and fantasma and fantasma.email != EMAIL_FANTASMA:
            errors['cpf'] = 'Este CPF já está cadastrado no sistema.'

        if email and Profile.objects.filter(email=email).exists():
            errors['email'] = 'Este e-mail já está em uso.'

        # NOTA: validação de unicidade de telefone REMOVIDA (número corporativo pode ser compartilhado)

        if errors:
            return Response({"status": "error", "errors": errors}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"status": "success", "message": "Dados disponíveis para cadastro."}, status=status.HTTP_200_OK)

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
            "email_real": profile.email,    # para autenticação no frontend
        }, status=status.HTTP_200_OK)


class RegisterProfileView(views.APIView):
    """
    Endpoint de cadastro nativo do Perfil no Django.
    Recebe os dados do usuário, incluindo a senha, e cria a conta localmente.
    """
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        data           = request.data
        cpf            = data.get('cpf')
        email          = data.get('email')
        password       = data.get('password')
        telefone       = data.get('telefone')
        data_nascimento= data.get('data_nascimento')
        nome_completo  = data.get('nome_completo')
        nome_social    = data.get('nome_social', '')
        tipo_usuario   = data.get('tipo_usuario', Profile.UserType.CIDADAO)
        dados_servidor = data.get('dados_servidor', {})

        # 1. Validações Básicas
        if not all([cpf, email, nome_completo, password]):
            return Response(
                {"detail": "CPF, E-mail, Nome Completo e Senha são obrigatórios."},
                status=status.HTTP_400_BAD_REQUEST
            )

        matricula = dados_servidor.get('matricula')
        matricula_chefe = dados_servidor.get('matricula_chefe')

        if matricula and matricula_chefe and matricula == matricula_chefe:
            return Response(
                {"detail": "A matrícula da sua chefia não pode ser idêntica a sua própria."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 2. Verifica se CPF ou E-mail já existem (exceto se for instrutor fantasma)
        fantasma = Profile.objects.filter(cpf=cpf).first()
        
        # Padrão unificado de e-mail fantasma: pendente_{cpf}@escola.local
        EMAIL_FANTASMA = f'pendente_{cpf}@escola.local'
        
        if fantasma:
            if fantasma.email != EMAIL_FANTASMA:
                return Response({"detail": "CPF já está em uso."}, status=status.HTTP_400_BAD_REQUEST)
        elif Profile.objects.filter(email=email).exists():
            return Response({"detail": "Este e-mail já está em uso."}, status=status.HTTP_400_BAD_REQUEST)

        # 3. Criação ou Atualização no Banco de Dados
        try:
            with transaction.atomic():
                if fantasma:
                    # OTIMIZAÇÃO GIGANTE: Como nós controlamos o ID agora, não precisamos mais
                    # deletar o fantasma e reatribuir as turmas. Basta atualizar o perfil dele!
                    profile = fantasma
                    profile.email = email
                    profile.telefone = telefone or None
                    profile.nome_completo = nome_completo
                    profile.data_nascimento = data_nascimento
                    profile.nome_social = nome_social or None
                    profile.tipo_usuario = tipo_usuario
                    profile.dados_servidor = dados_servidor
                    profile.data_ultima_confirmacao = timezone.now().date()
                    profile.set_password(password) # Criptografa a senha!
                    profile.save()
                else:
                    # Cria um usuário novo do zero
                    profile = Profile(
                        cpf=cpf,
                        email=email,
                        telefone=telefone or None,
                        nome_completo=nome_completo,
                        data_nascimento=data_nascimento,
                        nome_social=nome_social or None,
                        tipo_usuario=tipo_usuario,
                        dados_servidor=dados_servidor,
                        data_ultima_confirmacao=timezone.now().date()
                    )
                    profile.set_password(password) # Criptografa a senha!
                    profile.save()

        except Exception as exc:
            import logging
            logger = logging.getLogger(__name__)
            logger.error("Erro ao criar Profile local: %s", exc)
            return Response(
                {"detail": f"Erro interno ao criar perfil: {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        # Retorna os dados do perfil recém-criado
        from .serializers import ProfileSerializer
        serializer = ProfileSerializer(profile)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class MyProfileView(views.APIView):
    """
    GET   /api/users/auth/me/   → dados do perfil autenticado
    PATCH /api/users/auth/me/   → atualiza campos permitidos (nome_social, telefone, email_chefe)
    """
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
        for campo_ds in ("secretaria", "matricula"):
            if campo_ds in request.data:
                valor_ds = request.data[campo_ds]
                dados_servidor_atual[campo_ds] = valor_ds if valor_ds != "" else None
                ds_changed = True

        if ds_changed:
            campos_alterados["dados_servidor"] = dados_servidor_atual

        # Matrícula da chefia: aceita qualquer valor informado, sem validar existência no banco.
        # A responsabilidade pela exatidão é do servidor.
        if "matricula_chefe" in request.data:
            nova_matricula_chefe = request.data["matricula_chefe"]
            if nova_matricula_chefe:
                dados_servidor_atual['matricula_chefe'] = nova_matricula_chefe
                campos_alterados["dados_servidor"] = dados_servidor_atual
            else:
                if 'matricula_chefe' in dados_servidor_atual:
                    del dados_servidor_atual['matricula_chefe']
                campos_alterados["dados_servidor"] = dados_servidor_atual


        # Matrícula: aceita qualquer valor — a responsabilidade é do servidor.
        # A validação contra a base do RH foi REMOVIDA intencionalmente.
        if 'matricula' in request.data:
            nova_matricula = request.data['matricula']
            # Impede que matrícula e matrícula da chefia sejam iguais
            mat_chefe = dados_servidor_atual.get('matricula_chefe')
            if nova_matricula and mat_chefe and nova_matricula == mat_chefe:
                return Response(
                    {"detail": "A matrícula funcional não pode ser idêntica à da chefia."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            dados_servidor_atual['matricula'] = nova_matricula if nova_matricula else None
            campos_alterados["dados_servidor"] = dados_servidor_atual

        if not campos_alterados:
            return Response({"detail": "Nenhum campo editável foi enviado."}, status=status.HTTP_400_BAD_REQUEST)

        # Valida unicidade do e-mail (exclui o próprio usuário)
        novo_email = campos_alterados.get("email")
        if novo_email and Profile.objects.exclude(id=profile.id).filter(email=novo_email).exists():
            return Response(
                {"detail": "Este e-mail já está em uso por outra conta."},
                status=status.HTTP_400_BAD_REQUEST
            )

        for campo, valor in campos_alterados.items():
            setattr(profile, campo, valor)
        profile.save(update_fields=list(campos_alterados.keys()) + ["atualizado_em"])

        return Response(ProfileSerializer(profile).data, status=status.HTTP_200_OK)

class DenunciarMatriculaView(views.APIView):
    """
    POST /api/users/auth/denunciar-matricula/
    Permite a um servidor denunciar uma matrícula que está sendo usada indevidamente.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        matricula = request.data.get("matricula")
        if not matricula:
            return Response({"detail": "Matrícula é obrigatória."}, status=status.HTTP_400_BAD_REQUEST)

        from users.models import TicketDenunciaMatricula
        
        ticket = TicketDenunciaMatricula.objects.create(
            user_denunciante=request.user,
            matricula_reclamada=matricula
        )
        
        return Response({"detail": "Denúncia registrada com sucesso. A equipe analisará o caso.", "ticket_id": ticket.id}, status=status.HTTP_201_CREATED)


class MinhaEquipeView(views.APIView):
    """
    GET /api/users/equipe/
    Retorna os subordinados com histórico completo de capacitação e frequência presencial.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        from users.models import RelacaoChefia
        from users.serializers import ProfileSerializer
        from cursos.models import Inscricao, RegistroPresenca, EventoTurma

        relacoes = RelacaoChefia.objects.filter(chefe=request.user).select_related('servidor')

        data = []
        for rel in relacoes:
            servidor = rel.servidor
            inscricoes = Inscricao.objects.filter(perfil=servidor).select_related(
                'turma', 'turma__curso'
            ).order_by('-data_inscricao')

            historico = []
            for insc in inscricoes:
                turma = insc.turma
                total_eventos = EventoTurma.objects.filter(turma=turma).count()
                presencas = RegistroPresenca.objects.filter(
                    inscricao=insc,
                    status__in=['PRESENTE', 'JUSTIFICADA']
                ).count()
                perc_freq = round((presencas / total_eventos * 100), 1) if total_eventos > 0 else None

                historico.append({
                    "turma_codigo": turma.codigo_turma,
                    "curso_titulo": turma.curso.titulo,
                    "status": insc.status,
                    "nota": float(insc.nota) if insc.nota is not None else None,
                    "data_inicio": turma.data_inicio,
                    "data_fim": turma.data_fim,
                    "frequencia_percent": perc_freq,
                    "presencas": presencas,
                    "total_aulas": total_eventos,
                })

            data.append({
                "id_relacao": rel.id,
                "status": rel.status,
                "data_solicitacao": rel.data_solicitacao,
                "servidor": ProfileSerializer(servidor).data,
                "historico_capacitacao": historico,
            })

        return Response(data, status=status.HTTP_200_OK)

class ResponderChefiaView(views.APIView):
    """
    POST /api/users/equipe/responder/
    O chefe aceita ou recusa/desliga um servidor.
    Payload: {"id_relacao": 1, "acao": "ACEITAR" | "RECUSAR"}
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        from users.models import RelacaoChefia
        id_relacao = request.data.get("id_relacao")
        acao = request.data.get("acao")
        
        if not id_relacao or acao not in ["ACEITAR", "RECUSAR"]:
            return Response({"detail": "Dados inválidos."}, status=status.HTTP_400_BAD_REQUEST)
            
        rel = RelacaoChefia.objects.filter(id=id_relacao, chefe=request.user).first()
        if not rel:
            return Response({"detail": "Relação não encontrada."}, status=status.HTTP_404_NOT_FOUND)
            
        if acao == "ACEITAR":
            rel.status = RelacaoChefia.Status.ACEITO
            rel.save()
            return Response({"detail": "Vínculo aceito."}, status=status.HTTP_200_OK)
        else:
            rel.delete()
            return Response({"detail": "Vínculo removido."}, status=status.HTTP_200_OK)

class FotoPerfilView(views.APIView):
    """
    POST /api/users/auth/foto/
    Recebe multipart/form-data com campo 'foto'.
    Pipeline: Pillow → crop 400×400 → WebP q85 → R2 (ou local) → URL salva no Profile.
    """
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
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get_queryset(self):
        return Profile.objects.filter(tipo_usuario='INSTRUTOR', is_active=True).order_by('nome_completo')
    
class AdminUserListView(generics.ListAPIView):
    """ GET: Retorna todos os usuários do sistema para o painel Admin """
    serializer_class = ProfileSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get_queryset(self):
        return Profile.objects.all().order_by('nome_completo')


class AdminUserUpdateView(generics.UpdateAPIView):
    """ PATCH: Permite ao Admin editar dados sensíveis do usuário """
    permission_classes = [IsAuthenticated, IsAdminUser]
    queryset = Profile.objects.all()

    def get_serializer_class(self):
        return ProfileSerializer

    def partial_update(self, request, *args, **kwargs):
        perfil = self.get_object()
        
        # Campos que o Admin pode editar
        CAMPOS_PERMITIDOS = {
            'email', 'nome_completo', 'tipo_usuario', 'is_active', 'is_staff',
            'is_solicitante', 'bloqueado_ate', 'esta_de_licenca'
        }
        
        data_filtrada = {k: v for k, v in request.data.items() if k in CAMPOS_PERMITIDOS}
        
        if not data_filtrada:
            return Response(
                {"detail": "Nenhum campo editável enviado. Campos permitidos: " + ', '.join(sorted(CAMPOS_PERMITIDOS))},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Valida unicidade de e-mail
        novo_email = data_filtrada.get('email')
        if novo_email and Profile.objects.exclude(pk=perfil.pk).filter(email=novo_email).exists():
            return Response({"detail": "Este e-mail já está em uso."}, status=status.HTTP_400_BAD_REQUEST)
        
        for campo, valor in data_filtrada.items():
            setattr(perfil, campo, valor if valor != "" else None)
        perfil.save(update_fields=list(data_filtrada.keys()) + ['atualizado_em'])
        
        return Response(ProfileSerializer(perfil).data, status=status.HTTP_200_OK)


class ToggleSolicitanteView(views.APIView):
    """
    PATCH /api/users/admin/usuarios/<uuid>/toggle-solicitante/
    Ativa ou desativa a permissão de Solicitante de reservas para um usuário.
    Retorna o novo estado do campo is_solicitante.
    """
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

class ImpersonateUserView(views.APIView):
    """
    POST /api/users/admin/usuarios/<uuid>/impersonate/
    Permite ao admin logar como outro usuário gerando um token temporário.
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request, pk, *args, **kwargs):
        try:
            target_user = Profile.objects.get(pk=pk)
        except Profile.DoesNotExist:
            return Response({"detail": "Usuário não encontrado."}, status=status.HTTP_404_NOT_FOUND)

        if target_user.is_superuser:
            return Response({"detail": "Não é permitido fazer impersonate de um superusuário."}, status=status.HTTP_403_FORBIDDEN)

        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken.for_user(target_user)
        # Opcionalmente, pode adicionar uma claim 'impersonator_id' no token se desejar rastrear
        refresh['impersonator_id'] = str(request.user.id)

        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'detail': f'Sessão iniciada como {target_user.nome_completo}'
        }, status=status.HTTP_200_OK)
        return Response({
            "is_solicitante": perfil.is_solicitante,
            "detail": f"Permissão de Solicitante {acao} para {perfil.nome_completo}."
        }, status=status.HTTP_200_OK)


class SendOtpView(views.APIView):
    """
    Gera um código OTP, salva no banco (vencimento em 5min) e envia por e-mail.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email")

        if not email:
            return Response({"detail": "E-mail é obrigatório."},
                            status=status.HTTP_400_BAD_REQUEST)

        # 1) Apaga OTPs antigos deste usuário (limpeza)
        OTPCode.objects.filter(email=email).delete()

        # 2) Gera código de 6 dígitos
        codigo = str(random.randint(100000, 999999))
        vencimento = timezone.now() + timedelta(minutes=5)

        # 3) Salva no banco
        OTPCode.objects.create(
            email=email,
            codigo=codigo,
            expira_em=vencimento,
        )

        # 4) Envia e-mail usando as configurações reais do settings.py
        try:
            send_mail(
                subject="Código de Verificação — Escola de Governo",
                message=f"Seu código de verificação é: {codigo}\n\nEle expira em 5 minutos.",
                from_email=settings.EMAIL_HOST_USER,
                recipient_list=[email],
                fail_silently=False,
            )
        except Exception as e:
            # Se der erro no envio real, não barra o cadastro – apenas loga
            logger.error(f"Erro ao enviar OTP para {email}: {e}")

        return Response({"detail": "Código enviado com sucesso."})


class ValidateOtpView(views.APIView):
    """
    Valida o código OTP e, se OK, gera o Access JWT e Refresh Token usando HS256.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email")
        codigo_input = request.data.get("codigo")

        if not (email and codigo_input):
            return Response({"detail": "E-mail e código são obrigatórios."},
                            status=status.HTTP_400_BAD_REQUEST)

        # Busca o OTP válido
        otp = OTPCode.objects.filter(email=email, usado=False).first()

        if not otp:
            return Response({"detail": "Nenhum código pendente para este e-mail."},
                            status=status.HTTP_400_BAD_REQUEST)

        if otp.expira_em < timezone.now():
            otp.usado = True
            otp.save()
            return Response({"detail": "Código expirado."},
                            status=status.HTTP_400_BAD_REQUEST)

        if otp.codigo != codigo_input:
            return Response({"detail": "Código inválido."},
                            status=status.HTTP_400_BAD_REQUEST)

        # Marcar como usado
        otp.usado = True
        otp.save()

        # Tenta buscar o perfil para gerar tokens (Login/Recuperação)
        try:
            profile = Profile.objects.get(email=email)
            
            # Dados que vão no payload
            payload = {
                "user_id": str(profile.id),
                "email": profile.email,
                "nome": profile.nome_completo,
                "tipo": profile.tipo_usuario,
                "exp": timezone.now() + timedelta(minutes=15),
            }

            # Gera Access Token e Refresh Token usando HS256
            import jose.jwt as jose_jwt # Garantindo que o import está disponível
            access = jose_jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")
            refresh = jose_jwt.encode({"user_id": str(profile.id)}, settings.SECRET_KEY, algorithm="HS256")

            return Response({
                "access": access,
                "refresh": refresh,
                "user": {
                    "id": profile.id,
                    "email": profile.email,
                    "nome": profile.nome_completo,
                    "tipo_usuario": profile.tipo_usuario,
                },
            })
        except Profile.DoesNotExist:
            # Se o perfil não existe, mas o OTP é válido, retornamos sucesso sem tokens.
            # Isso é usado no fluxo de Cadastro (Registro).
            return Response({
                "status": "success",
                "message": "E-mail verificado com sucesso. Prossiga com o cadastro.",
                "verified_email": email
            }, status=status.HTTP_200_OK)


class ResetPasswordView(views.APIView):
    """ POST: Altera a senha caso o usuário envie um código OTP válido """
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email')
        codigo = request.data.get('codigo') # Exigimos o código de novo como "senha temporária" de autorização
        new_password = request.data.get('password')

        otp_record = OTPCode.objects.filter(email=email, codigo=codigo, proposito='recuperacao', usado=True).order_by('-criado_em').first()

        # Verifica se existe um OTP recente que foi validado com sucesso
        if not otp_record or (timezone.now() - otp_record.criado_em) > timedelta(minutes=15):
            return Response({"detail": "Sessão de recuperação inválida ou expirada."}, status=status.HTTP_403_FORBIDDEN)

        try:
            profile = Profile.objects.get(email=email)
            profile.set_password(new_password)
            profile.save()
            # Destrói o OTP para que não possa ser usado para trocar a senha duas vezes
            otp_record.delete()
            
            return Response({"detail": "Senha atualizada com sucesso!"}, status=status.HTTP_200_OK)
        except Profile.DoesNotExist:
            return Response({"detail": "Usuário não encontrado."}, status=status.HTTP_404_NOT_FOUND)

class BuscarNomeCpfView(views.APIView):
    """ GET: Retorna o nome do usuário a partir do CPF (Apenas para Staff) """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not request.user.is_staff:
            return Response({"detail": "Sem permissão."}, status=status.HTTP_403_FORBIDDEN)
            
        cpf = request.query_params.get('cpf', '').replace(r'\D', '')
        if len(cpf) != 11:
            return Response({"detail": "CPF inválido."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            profile = Profile.objects.get(cpf=cpf)
            return Response({"nome": profile.nome_social or profile.nome_completo}, status=status.HTTP_200_OK)
        except Profile.DoesNotExist:
            return Response({"detail": "Usuário não encontrado."}, status=status.HTTP_404_NOT_FOUND)


# ─── Secretarias ──────────────────────────────────────────────────────────────

class SecretariaListView(views.APIView):
    """
    GET  /api/users/secretarias/  → lista todas as secretarias ativas (público para dropdowns)
    POST /api/users/secretarias/  → cria uma nova secretaria (apenas Admin)
    """
    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated(), IsAdminUser()]
        return [AllowAny()]

    def get(self, request):
        from users.models import Secretaria
        ativas = Secretaria.objects.filter(is_active=True).values('id', 'sigla', 'nome')
        return Response(list(ativas), status=status.HTTP_200_OK)

    def post(self, request):
        from users.models import Secretaria
        sigla = (request.data.get('sigla') or '').strip().upper()
        nome  = (request.data.get('nome')  or '').strip()

        if not sigla or not nome:
            return Response({"detail": "Sigla e Nome são obrigatórios."}, status=status.HTTP_400_BAD_REQUEST)
        if len(sigla) > 15:
            return Response({"detail": "A sigla deve ter no máximo 15 caracteres."}, status=status.HTTP_400_BAD_REQUEST)
        if Secretaria.objects.filter(sigla=sigla).exists():
            return Response({"detail": f"Já existe uma secretaria com a sigla '{sigla}'."}, status=status.HTTP_400_BAD_REQUEST)

        sec = Secretaria.objects.create(sigla=sigla, nome=nome)
        return Response({'id': sec.id, 'sigla': sec.sigla, 'nome': sec.nome}, status=status.HTTP_201_CREATED)


class SecretariaDetailView(views.APIView):
    """
    PATCH /api/users/secretarias/<id>/  → edita sigla/nome (apenas Admin)
    DELETE /api/users/secretarias/<id>/ → desativa (soft delete) (apenas Admin)
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def _get(self, pk):
        from users.models import Secretaria
        try:
            return Secretaria.objects.get(pk=pk)
        except Secretaria.DoesNotExist:
            return None

    def patch(self, request, pk):
        from users.models import Secretaria
        sec = self._get(pk)
        if not sec:
            return Response({"detail": "Secretaria não encontrada."}, status=status.HTTP_404_NOT_FOUND)

        sigla = (request.data.get('sigla') or sec.sigla).strip().upper()
        nome  = (request.data.get('nome')  or sec.nome).strip()

        if len(sigla) > 15:
            return Response({"detail": "A sigla deve ter no máximo 15 caracteres."}, status=status.HTTP_400_BAD_REQUEST)
        if Secretaria.objects.exclude(pk=pk).filter(sigla=sigla).exists():
            return Response({"detail": f"Já existe outra secretaria com a sigla '{sigla}'."}, status=status.HTTP_400_BAD_REQUEST)

        sec.sigla = sigla
        sec.nome  = nome
        if 'is_active' in request.data:
            sec.is_active = bool(request.data['is_active'])
        sec.save()
        return Response({'id': sec.id, 'sigla': sec.sigla, 'nome': sec.nome, 'is_active': sec.is_active})

    def delete(self, request, pk):
        from users.models import Secretaria
        sec = self._get(pk)
        if not sec:
            return Response({"detail": "Secretaria não encontrada."}, status=status.HTTP_404_NOT_FOUND)
        sec.is_active = False
        sec.save(update_fields=['is_active'])
        return Response({"detail": "Secretaria desativada."}, status=status.HTTP_200_OK)
