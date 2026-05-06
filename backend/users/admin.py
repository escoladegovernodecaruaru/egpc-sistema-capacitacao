from django.contrib import admin
from django.urls import path
from django.shortcuts import render, redirect
from django.contrib import messages
from django.core.files.uploadedfile import InMemoryUploadedFile
import csv
import io
from .models import Profile, OTPCode, ServidorRH, TicketDenunciaMatricula

@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ('cpf', 'nome_completo', 'tipo_usuario', 'is_active', 'is_staff')
    search_fields = ('cpf', 'nome_completo', 'email')
    list_filter = ('tipo_usuario', 'is_active', 'is_staff')

@admin.register(OTPCode)
class OTPCodeAdmin(admin.ModelAdmin):
    list_display = ('email', 'codigo', 'proposito', 'usado', 'criado_em', 'expira_em')
    search_fields = ('email', 'codigo')
    list_filter = ('usado', 'proposito')

@admin.register(ServidorRH)
class ServidorRHAdmin(admin.ModelAdmin):
    list_display = ('matricula', 'cpf', 'nome_base', 'cargo', 'importado_em')
    search_fields = ('matricula', 'cpf', 'nome_base')
    change_list_template = "admin/users/servidorrh_changelist.html"

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path('import-csv/', self.admin_site.admin_view(self.import_csv), name='servidorrh-import-csv'),
        ]
        return custom_urls + urls

    def import_csv(self, request):
        if request.method == "POST":
            csv_file = request.FILES.get("csv_file")
            
            if not csv_file:
                messages.error(request, "Nenhum arquivo enviado.")
                return redirect("..")
                
            if not csv_file.name.endswith('.csv'):
                messages.error(request, "O arquivo deve ser formato CSV.")
                return redirect("..")
                
            try:
                decoded_file = csv_file.read().decode('utf-8')
                io_string = io.StringIO(decoded_file)
                # Assume que o CSV tem cabeçalho: cpf, matricula, nome_base, cargo
                reader = csv.DictReader(io_string, delimiter=',')
                
                count = 0
                for row in reader:
                    cpf = row.get('cpf', '').strip()
                    matricula = row.get('matricula', '').strip()
                    nome = row.get('nome_base', '').strip()
                    cargo = row.get('cargo', '').strip()
                    
                    if cpf and matricula:
                        ServidorRH.objects.update_or_create(
                            cpf=cpf,
                            matricula=matricula,
                            defaults={
                                'nome_base': nome,
                                'cargo': cargo
                            }
                        )
                        count += 1
                        
                messages.success(request, f"{count} servidores importados com sucesso da Base do RH.")
            except Exception as e:
                messages.error(request, f"Erro ao processar o CSV: {e}")
                
            return redirect("..")
            
        return redirect("..")

@admin.register(TicketDenunciaMatricula)
class TicketDenunciaMatriculaAdmin(admin.ModelAdmin):
    list_display = ('id', 'matricula_reclamada', 'user_denunciante', 'status', 'criado_em')
    search_fields = ('matricula_reclamada', 'user_denunciante__cpf', 'user_denunciante__nome_completo')
    list_filter = ('status',)
    readonly_fields = ('criado_em', 'resolvido_em')
