import requests
import pandas as pd
import firebase_admin
from firebase_admin import credentials, firestore
from requests.auth import HTTPBasicAuth
from datetime import datetime, timedelta
import time
import schedule
import re
import sys

# --- CONFIGURAÇÕES DO IXC ---
IXC_URL = "https://ixc.rlnetpoa.com.br/webservice/v1"
USUARIO_API = "219"
SENHA_API = "44f52624ab4ef1ad220ed1d5dab55dc17bf9f17b98e51bb80b0699a32e3dd702"
SETORES_ALVO = ['8', '10']
DEBUG_MODE = True 

# --- CONFIGURAÇÕES DE REGRAS ---
BAIRROS_NORTE = [
    "CENTRO HISTÓRICO", "CIDADE BAIXA", "AZENHA", "MENINO DEUS", "PRAIA DE BELAS",
    "ANCHIETA", "ARQUIPÉLAGO", "BOA VISTA", "CRISTO REDENTOR", "FARRAPOS",
    "FLORESTA", "HIGIENÓPOLIS", "HUMAITÁ", "JARDIM EUROPA", "JARDIM FLORESTA",
    "JARDIM ITU", "JARDIM LINDÓIA", "JARDIM SÃO PEDRO", "NAVEGANTES",
    "PARQUE SANTA FÉ", "PASSO D'AREIA", "RUBEM BERTA", "SANTA MARIA GORETTI",
    "SANTA ROSA DE LIMA", "SÃO GERALDO", "SÃO JOÃO", "SÃO SEBASTIÃO",
    "SARANDI", "VILA IPIRANGA", "VILA NOVA SÃO LUCAS",
    "AGRONOMIA", "AUXILIADORA", "BELA VISTA", "BOM FIM", "BOM JESUS",
    "CHÁCARA DAS PEDRAS", "INDEPENDÊNCIA", "JARDIM BOTÂNICO", "JARDIM CARVALHO",
    "JARDIM DO SALSO", "JARDIM SABARÁ", "LOMBA DO PINHEIRO", "MÁRIO QUINTANA",
    "MEDIANEIRA", "MOINHOS DE VENTO", "MONT'SERRAT", "MORRO SANTANA",
    "PARTENON", "PETRÓPOLIS", "RIO BRANCO", "SANTA CECÍLIA", "SANTANA",
    "SANTO ANTÔNIO", "TRÊS FIGUEIRAS", "VILA JARDIM"
]
CIDADES_NORTE = ["GUAÍBA", "ALVORADA", "VIAMÃO", "GRAVATAÍ", "CANOAS"]

# --- INICIALIZAÇÃO FIREBASE ---
if not firebase_admin._apps:
    cred = credentials.Certificate("serviceAccountKey.json")
    firebase_admin.initialize_app(cred)
db = firestore.client()

def get_auth(): return HTTPBasicAuth(USUARIO_API, SENHA_API)

# --- FUNÇÕES UTILITÁRIAS ---
def normalize_text(text):
    if not text: return ""
    return str(text).upper().strip()

def is_nortenho(bairro, cidade):
    bairro_norm = normalize_text(bairro)
    cidade_norm = normalize_text(cidade)
    if any(c in cidade_norm for c in CIDADES_NORTE): return True
    if any(b in bairro_norm for b in BAIRROS_NORTE): return True
    return False

def get_periodo_calculado(mes=None, ano=None):
    hoje = datetime.now()
    mes = mes or hoje.month
    ano = ano or hoje.year
    
    dt_ref = datetime(ano, mes, 1)
    prev_month_dt = dt_ref - timedelta(days=1)
    
    start_date = datetime(prev_month_dt.year, prev_month_dt.month, 29)
    end_date = datetime(ano, mes, 28)
    
    return start_date, end_date

def get_nome_flexivel(session, tabela, id_val, possiveis_campos, cache):
    if not id_val or str(id_val) in ['0', '', 'None']: return "-"
    id_s = str(id_val)
    if id_s in cache: return cache[id_s]
    try:
        r = session.post(f"{IXC_URL}/{tabela}", json={'qtype':'id','query':id_s,'oper':'=','rp':'1'}, auth=get_auth()).json()
        if r and r.get('registros'):
            reg = r['registros'][0]
            val = next((reg[k] for k in possiveis_campos if k in reg and reg[k]), "-")
            cache[id_s] = val
            return val
    except: pass
    return "-"

# --- CORE DO SISTEMA ---
def executar_processamento(manual_month=None, manual_year=None):
    print(f"\n[{datetime.now()}] >>> INICIANDO CICLO DE ATUALIZAÇÃO <<<")
    
    start_date, end_date = get_periodo_calculado(manual_month, manual_year)
    periodo_str = f"{end_date.year}-{end_date.month:02d}"
    print(f"Período Alvo: {start_date.strftime('%d/%m/%Y')} a {end_date.strftime('%d/%m/%Y')} (Chave: {periodo_str})")

    # Atualizar Metadata de Períodos Disponíveis (Para o Frontend)
    try:
        db.collection('metadata').document('periods').set({
            'available': firestore.ArrayUnion([periodo_str])
        }, merge=True)
    except: pass

    # 1. Carregar Técnicos
    try:
        print("Carregando técnicos do Firebase...")
        techs_ref = db.collection('technicians').stream()
        valid_tech_ids = set()
        tech_names = {}
        for t in techs_ref:
            valid_tech_ids.add(t.id)
            tech_names[t.id] = t.to_dict().get('nome', 'Sem Nome')
        
        print(f"Total de Técnicos monitorados: {len(valid_tech_ids)}")
        
        # Carregar Configs
        comm_doc = db.collection('settings').document('commissions').get()
        commission_rules = comm_doc.to_dict().get('values', {}) if comm_doc.exists else {}
        fixed_drop_price = comm_doc.to_dict().get('fixed_diag_169', 5.00) if comm_doc.exists else 5.00
        
        eval_doc = db.collection('evaluations').document(periodo_str).get()
        evaluations = eval_doc.to_dict() if eval_doc.exists else {}

    except Exception as e:
        print(f"CRITICAL ERROR Firebase: {e}")
        return

    # 2. Busca no IXC
    session = requests.Session()
    session.headers.update({'Content-Type': 'application/json', 'ixcsoft': 'listar'})
    
    query_date = start_date.strftime('%Y-%m-%d')
    print(f"Consultando IXC API desde: {query_date}...")
    
    payload = {
        'qtype': 'su_oss_chamado.data_fechamento', 'query': query_date, 'oper': '>=', 
        'rp': '10000', 'sortname': 'su_oss_chamado.data_fechamento', 'sortorder': 'desc'
    }
    
    try:
        resp = session.post(f"{IXC_URL}/su_oss_chamado", json=payload, auth=get_auth())
        candidatos = [x for x in resp.json().get('registros', []) if x.get('status') == 'F']
        print(f"Registros brutos: {len(resp.json().get('registros', []))} | Filtrados (F): {len(candidatos)}")
    except Exception as e:
        print(f"CRITICAL ERROR IXC: {e}")
        return

    caches = {'diag': {}, 'assunto': {}, 'login': {}, 'cidade': {}}
    stats_buffer = {} 
    processed_count = 0
    ignored_reasons = {"Data Fora": 0, "Setor Inválido": 0, "Técnico Não Monitorado": 0, "Erro Detalhe": 0}

    # Inicializar buffer
    for t_id in valid_tech_ids:
        stats_buffer[t_id] = {
            'executor': 0, 'lancador': 0, 'amigavel': 0, 'nortenho': 0,
            'corporativo': 0, 'preventor': 0, 'salvador': 0, 'lagartixo': 0,
            'commission_total': 0.0, 
            'bairros_stats': {}, 'assuntos_stats': {}, 'diagnosticos_stats': {},
            'os_history': []
        }

    print("Processando detalhes...")
    
    for i, resumo in enumerate(candidatos):
        if i % 100 == 0: print(f"   ... {i}/{len(candidatos)} ...")

        try:
            dt_fechamento = datetime.strptime(resumo['data_fechamento'], '%Y-%m-%d %H:%M:%S')
            if not (start_date <= dt_fechamento <= end_date + timedelta(days=1)): 
                 ignored_reasons["Data Fora"] += 1
                 continue
        except: continue

        try:
            det = session.post(f"{IXC_URL}/su_oss_chamado", json={'qtype':'id','query':resumo['id'],'oper':'=','rp':'1'}, auth=get_auth()).json()
            if not det.get('registros'):
                 ignored_reasons["Erro Detalhe"] += 1
                 continue
            full = det['registros'][0]
            
            os_tech_id = str(full.get('id_tecnico'))
            if os_tech_id not in valid_tech_ids:
                ignored_reasons["Técnico Não Monitorado"] += 1
                continue

            setor_os = str(full.get('setor') or full.get('id_setor') or '0')
            if setor_os not in SETORES_ALVO: 
                ignored_reasons["Setor Inválido"] += 1
                continue

            tech_id = os_tech_id
            
            razao, cnpj, bairro, cidade = "-", "-", "-", "-"
            if full.get('id_cliente'):
                cli = session.post(f"{IXC_URL}/cliente", json={'qtype':'id','query':full['id_cliente'],'oper':'=','rp':'1'}, auth=get_auth()).json()
                if cli and cli.get('registros'):
                    c = cli['registros'][0]
                    razao = c.get('razao') or c.get('nome') or "Sem Nome"
                    cnpj = c.get('cnpj_cpf', '')
                    bairro = c.get('bairro', '-')
                    cidade = get_nome_flexivel(session, 'cidade', c.get('id_cidade'), ['nome'], caches['cidade'])
            
            id_assunto = full.get('id_assunto')
            id_diag = full.get('id_su_diagnostico') or full.get('id_diagnostico')
            assunto_nome = get_nome_flexivel(session, 'su_oss_assunto', id_assunto, ['assunto'], caches['assunto'])
            diag_nome = get_nome_flexivel(session, 'su_diagnostico', id_diag, ['diagnostico', 'nome', 'descricao'], caches['diag'])

            # --- CÁLCULO DE KPIS ---
            s = stats_buffer[tech_id]
            s['executor'] += 1
            
            if str(id_diag) == '169':
                s['lancador'] += 1
                s['commission_total'] += float(fixed_drop_price)
            if str(id_diag) in ['171', '202']: s['lagartixo'] += 1
            if str(id_diag) in ['177', '121', '187']: s['preventor'] += 1
            if str(id_assunto) == '7': s['salvador'] += 1
            if str(id_assunto) in ['42', '107']: s['amigavel'] += 1
            if is_nortenho(bairro, cidade): s['nortenho'] += 1
            
            clean_cnpj = re.sub(r'\D', '', str(cnpj))
            if len(clean_cnpj) > 11: s['corporativo'] += 1
            
            if str(id_assunto) in commission_rules:
                s['commission_total'] += float(commission_rules[str(id_assunto)])

            # Stats Agregados
            b_key = f"{bairro} - {cidade}"
            s['bairros_stats'][b_key] = s['bairros_stats'].get(b_key, 0) + 1
            s['assuntos_stats'][assunto_nome] = s['assuntos_stats'].get(assunto_nome, 0) + 1
            s['diagnosticos_stats'][diag_nome] = s['diagnosticos_stats'].get(diag_nome, 0) + 1
            
            s['os_history'].append({
                'id': resumo['id'],
                'data': dt_fechamento.strftime('%d/%m %H:%M'),
                'cliente': razao[:20],
                'assunto': assunto_nome,
                'diag': diag_nome
            })

            processed_count += 1

        except Exception as e: continue

    print(f"Sucesso: {processed_count} | Ignorados: {ignored_reasons}")
    print("Salvando no Firebase...")
    
    batch = db.batch()
    if caches['assunto']:
        db.collection('metadata').document('subjects').set({'items': caches['assunto']}, merge=True)

    for tech_id, data in stats_buffer.items():
        nota_xp = float(evaluations.get(tech_id, 0))
        score_positivos = (
            data['executor'] + data['lancador'] + data['amigavel'] + 
            data['nortenho'] + data['corporativo'] + data['preventor'] + 
            data['salvador'] + nota_xp 
        )
        meticuloso = score_positivos - (data['lagartixo'] * 5)
        
        data['os_history'].sort(key=lambda x: x['data'], reverse=True)
        
        final_doc = {
            'periodo': periodo_str,
            'updated_at': firestore.SERVER_TIMESTAMP,
            'tech_id': tech_id,
            'kpis': {
                'executor': data['executor'], 'lancador': data['lancador'],
                'experiencialista': nota_xp, 'amigavel': data['amigavel'],
                'nortenho': data['nortenho'], 'corporativo': data['corporativo'],
                'preventor': data['preventor'], 'salvador': data['salvador'],
                'lagartixo': data['lagartixo'], 'meticuloso': meticuloso
            },
            'financeiro': { 'comissao_prevista': round(data['commission_total'], 2) },
            'dashboard': { 
                'bairros': data['bairros_stats'], 
                'assuntos': data['assuntos_stats'],
                'diagnosticos': data['diagnosticos_stats']
            },
            'history': data['os_history']
        }
        ref = db.collection('monthly_stats').document(f"{periodo_str}_{tech_id}")
        batch.set(ref, final_doc)

    batch.commit()
    print(">>> CICLO FINALIZADO <<<")

if __name__ == "__main__":
    print("Nexus Motor Iniciado (v1.5).")
    
    entrada = input("Digite Mês/Ano (MM/AAAA) para escanear [Enter = Mês Atual]: ").strip()
    m, y = None, None
    if entrada:
        try:
            parts = entrada.split('/')
            m = int(parts[0])
            y = int(parts[1])
            executar_processamento(m, y)
        except:
            print("Formato inválido. Usando data atual.")
            executar_processamento()
    else:
        executar_processamento()
    
    # PERGUNTA DE LOOP
    choice = input("\nManter o sistema rodando automaticamente a cada 30 minutos? (S/N): ").strip().upper()
    if choice == 'S':
        print("Entrando em modo agendado (A cada 30 min)...")
        schedule.every(30).minutes.do(executar_processamento)
        while True:
            try:
                schedule.run_pending()
                time.sleep(1)
            except KeyboardInterrupt: break
    else:
        print("Encerrando.")
        sys.exit()