import firebase_admin
from firebase_admin import credentials, firestore

# --- CONFIGURAÇÃO ---
# Certifique-se de que o arquivo serviceAccountKey.json está na mesma pasta
cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred)

db = firestore.client()

def setup_initial_data():
    print("Iniciando setup do Nexus...")

    # 1. Configurar Tabela de Comissões Padrão
    # O frontend irá ler/editar isso depois
    commissions_ref = db.collection('settings').document('commissions')
    
    if not commissions_ref.get().exists:
        print("Criando tabela de comissões padrão...")
        commissions_ref.set({
            'values': {
                '7': 5.00, # ID 7 - SEM ACESSO (Exemplo inicial)
            },
            'fixed_diag_169': 5.00 # Valor fixo do Cabo Drop
        })
    else:
        print("Tabela de comissões já existe.")

    # 2. Criar coleção de metadata para Assuntos (vazio inicialmente)
    subjects_ref = db.collection('metadata').document('subjects')
    if not subjects_ref.get().exists:
        print("Criando registro de assuntos...")
        subjects_ref.set({'items': {}}) # Vai ser populado pelo backend
    else:
        print("Registro de assuntos já existe.")

    print("Setup concluído com sucesso!")

if __name__ == "__main__":
    setup_initial_data()