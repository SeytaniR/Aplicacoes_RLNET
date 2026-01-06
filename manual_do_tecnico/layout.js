// Configurações Globais
const CONFIG = {
    version: "1.0",
    dev: "Filipe Cruz",
    logoPath: "logorlnet.png",
    storageKey: "rlnet_manual_progress_v1"
};

// Definição do Menu
const menuItems = [
    { file: "index.html", icon: "fa-home", title: "Início", isModule: false },
    { file: "01_cultura.html", icon: "fa-users", title: "01. Cultura", isModule: true },
    { file: "02_seguranca.html", icon: "fa-hard-hat", title: "02. Segurança", isModule: true },
    { file: "03_redes.html", icon: "fa-network-wired", title: "03. Redes", isModule: true },
    { file: "04_wifi.html", icon: "fa-wifi", title: "04. Wi-Fi", isModule: true },
    { file: "05_fibra.html", icon: "fa-bezier-curve", title: "05. Fibra Óptica", isModule: true },
    { file: "06_instalacao.html", icon: "fa-screwdriver-wrench", title: "06. Instalação", isModule: true },
    { file: "07_reparo.html", icon: "fa-wrench", title: "07. Reparo", isModule: true },
    { file: "08_ferramentas.html", icon: "fa-toolbox", title: "08. Ferramentas", isModule: true },
    { file: "09_atendimento.html", icon: "fa-headset", title: "09. Atendimento", isModule: true },
    { file: "10_cqi.html", icon: "fa-clipboard-check", title: "10. CQI", isModule: true },
    { file: "11_carreira.html", icon: "fa-chart-line", title: "11. Carreira", isModule: true },
	{ file: "12_prova.html", icon: "fa-graduation-cap", title: "12. Avaliação Final", isModule: true },
	{ file: "../index.html", icon: "fa-sign-out-alt", title: "VOLTAR AO LAUNCHER", isModule: false }

];

document.addEventListener("DOMContentLoaded", () => {
    injectStyles();
    injectFavicon();
    setupStructure();
    injectLayoutComponents();
    renderHomeGrid();
    injectModuleStatusButton(); // Nova função para botão na página interna
    updateGlobalProgressUI();   // Atualiza barra de progresso se existir
    setupInteractivity();
});

// --- GERENCIAMENTO DE ESTADO (CACHE) ---
function getModuleStatus(filename) {
    const progress = JSON.parse(localStorage.getItem(CONFIG.storageKey) || '{}');
    return !!progress[filename];
}

function toggleModuleStatus(filename) {
    const progress = JSON.parse(localStorage.getItem(CONFIG.storageKey) || '{}');
    progress[filename] = !progress[filename];
    localStorage.setItem(CONFIG.storageKey, JSON.stringify(progress));
    
    // Dispara eventos para atualizar UI em tempo real
    updateGlobalProgressUI();
    renderHomeGrid(); // Re-renderiza grid se estiver na home
    updateModuleButtonUI(filename); // Atualiza botão interno se estiver na página
    return progress[filename];
}

// --- ESTILOS ---
function injectStyles() {
    const style = document.createElement('style');
    style.innerHTML = `
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        
        @media (max-width: 768px) {
            .mobile-compact { padding-left: 0.75rem !important; padding-right: 0.75rem !important; }
            .header-compact { height: 3.5rem !important; } /* 56px no mobile */
            .card-compact { padding: 1rem !important; }
        }
        
        .glass-overlay {
            background: rgba(0, 0, 0, 0.4);
            backdrop-filter: blur(4px);
        }
        /* Estilos do Botão de Conclusão */
        .status-btn-check { transition: all 0.3s ease; }
        .status-btn-check:hover { transform: scale(1.1); }
        .module-done { border-color: #22c55e !important; background-color: #f0fdf4 !important; }
        .module-done .status-icon { color: #22c55e !important; }
        .check-circle-active { color: #22c55e; }
        .check-circle-inactive { color: #cbd5e1; }
    `;
    document.head.appendChild(style);
}

function injectFavicon() {
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
    }
    link.href = CONFIG.logoPath;
}

function setupStructure() {
    const appLayout = document.getElementById('app-layout');
    if (appLayout) {
        const wrapper = appLayout.parentElement;
        if (wrapper && wrapper.tagName === 'DIV') {
            wrapper.classList.add('md:pl-64', 'transition-all', 'duration-300', 'flex', 'flex-col', 'min-h-screen');
        }
    }
}

function injectLayoutComponents() {
    const appContainer = document.getElementById('app-layout');
    if (!appContainer) return;

    const currentPath = window.location.pathname.split("/").pop() || "index.html";
    
    // SIDEBAR (Ajustado padding nos itens do menu para mobile)
    const sidebarHTML = `
        <aside id="sidebar" class="fixed inset-y-0 left-0 z-50 w-64 bg-[#003366] text-white transform -translate-x-full md:translate-x-0 transition-transform duration-300 shadow-2xl flex flex-col">
            <div class="h-16 md:h-20 flex items-center justify-center bg-white border-b border-gray-200 p-3 md:p-4">
                 <img src="${CONFIG.logoPath}" class="h-full object-contain max-w-[80%]" alt="RL NET" 
                      onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                 <div class="hidden flex-col items-center justify-center text-[#003366]">
                    <i class="fas fa-wifi text-2xl text-[#FFD700]"></i>
                    <span class="font-black text-xl tracking-tighter">RL NET</span>
                </div>
            </div>
<nav class="flex-1 overflow-y-auto py-2 md:py-4">
    <ul class="space-y-0.5 md:space-y-1 px-2">
        ${menuItems.map(item => {
            const isActive = currentPath === item.file;
            const isDone = item.isModule && getModuleStatus(item.file);
            const checkIcon = isDone ? '<i class="fas fa-check-circle text-green-400 text-xs ml-auto"></i>' : '';
            
            return `
            <li>
                <a href="${item.file}" class="flex items-center gap-3 px-3 py-2.5 md:px-4 md:py-3 text-sm font-medium rounded-lg transition-all duration-200 group ${isActive ? 'bg-[#0055A4] text-white shadow-md translate-x-1' : 'text-blue-100 hover:bg-[#004488] hover:text-[#FFD700]'}">
                    <i class="fas ${item.icon} w-5 text-center ${isActive ? 'text-[#FFD700]' : 'group-hover:text-[#FFD700]'}"></i>
                    <span>${item.title}</span>
                    ${checkIcon}
                </a>
            </li>
            `;
        }).join('')}

        <li class="mt-6 pt-4 border-t border-blue-800/50">
            <a href="../index.html" class="flex items-center gap-3 px-3 py-2.5 md:px-4 md:py-3 text-sm font-bold rounded-lg transition-all duration-200 text-orange-400 hover:bg-orange-500/10 hover:text-orange-300">
                <i class="fas fa-sign-out-alt w-5 text-center"></i>
                <span>VOLTAR AO LAUNCHER</span>
            </a>
        </li>
    </ul>
</nav>
        </aside>
        <div id="mobile-overlay" class="fixed inset-0 z-40 hidden md:hidden glass-overlay transition-opacity duration-300"></div>
    `;

    // HEADER (Mais compacto: h-14 no mobile vs h-16 no desktop)
    const headerHTML = `
        <header class="header-compact h-14 md:h-16 bg-white shadow-sm flex items-center justify-between px-3 md:px-8 sticky top-0 z-30 w-full transition-all">
            <div class="flex items-center gap-2 md:gap-3">
                <button id="mobile-menu-btn" class="md:hidden text-[#003366] text-lg p-1.5 rounded hover:bg-gray-100 focus:outline-none transition-colors">
                    <i class="fas fa-bars"></i>
                </button>
                <h1 class="text-sm md:text-lg font-bold text-[#003366] truncate leading-tight">
                    Manual do Técnico
                </h1>
            </div>
            <!-- Área do Botão de Ação (Injetado via JS nas páginas internas) -->
            <div id="header-actions"></div>
        </header>
    `;

    // FOOTER (Reduzido padding vertical)
    const footerHTML = `
        <footer class="mt-auto py-4 px-4 border-t border-gray-200 bg-white">
            <div class="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-2 text-xs text-gray-500 font-medium">
                <div class="flex items-center gap-2">
                    <span class="bg-blue-50 text-[#003366] px-2 py-1 rounded">v${CONFIG.version}</span>
                </div>
                <div class="text-center md:text-right">
                    <p>Dev. <span class="text-[#003366] font-bold">${CONFIG.dev}</span></p>
                    <p class="text-[10px] mt-0.5 opacity-70">&copy; ${new Date().getFullYear()} RL NET</p>
                </div>
            </div>
        </footer>
    `;

    document.body.insertAdjacentHTML('afterbegin', sidebarHTML);
    appContainer.insertAdjacentHTML('afterbegin', headerHTML);
    appContainer.insertAdjacentHTML('beforeend', footerHTML);
}

// --- FUNÇÕES DE UI ---

// 1. Grade da Home com Botão de Check (Layout Compacto Mobile)
function renderHomeGrid() {
    const gridContainer = document.getElementById('home-module-grid');
    if (!gridContainer) return;

    const modules = menuItems.filter(item => item.isModule);
    
    gridContainer.innerHTML = modules.map(item => {
        const isDone = getModuleStatus(item.file);
        
        return `
        <div class="relative bg-white p-4 md:p-6 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 border-b-4 ${isDone ? 'border-green-500 bg-green-50' : 'border-transparent hover:border-[#FFD700]'} group flex flex-col items-center text-center h-full">
            
            <!-- Botão de Check Flutuante -->
            <button onclick="event.preventDefault(); toggleModuleStatus('${item.file}')" 
                    class="absolute top-2 right-2 md:top-3 md:right-3 p-1.5 md:p-2 rounded-full hover:bg-gray-100 transition-colors z-10"
                    title="${isDone ? 'Marcar como não lido' : 'Marcar como concluído'}">
                <i class="fas ${isDone ? 'fa-check-circle text-green-500 text-lg md:text-xl' : 'fa-circle text-gray-200 text-lg md:text-xl'} status-icon"></i>
            </button>

            <a href="${item.file}" class="flex flex-col items-center w-full h-full">
                <div class="w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center mb-3 md:mb-4 transition-colors duration-300 ${isDone ? 'bg-white' : 'bg-blue-50 group-hover:bg-[#003366]'}">
                    <i class="fas ${item.icon} text-xl md:text-3xl transition-colors ${isDone ? 'text-green-500' : 'text-[#003366] group-hover:text-[#FFD700]'}"></i>
                </div>
                <h4 class="font-bold text-sm md:text-lg text-gray-800 ${isDone ? 'text-green-800' : 'group-hover:text-[#003366]'} mb-1 md:mb-2 line-clamp-1">${item.title}</h4>
                
                <span class="text-[10px] md:text-xs font-bold uppercase tracking-wider mt-auto ${isDone ? 'text-green-600' : 'text-blue-400 group-hover:text-[#003366]'}">
                    ${isDone ? 'Concluído' : 'Acessar'}
                </span>
            </a>
        </div>
        `;
    }).join('');
}

// 2. Botão dentro da Página do Módulo (Ajustado padding)
function injectModuleStatusButton() {
    const currentPath = window.location.pathname.split("/").pop();
    // Verifica se é uma página de módulo
    const isModulePage = menuItems.some(m => m.file === currentPath && m.isModule);
    
    if (!isModulePage) return;

    const headerActions = document.getElementById('header-actions');
    if (headerActions) {
        const isDone = getModuleStatus(currentPath);
        
        // Cria o botão
        const btn = document.createElement('button');
        btn.id = 'module-status-btn';
        // Padding reduzido para mobile: px-2 py-1 vs px-3 py-1.5
        btn.className = `flex items-center gap-1.5 md:gap-2 px-2 py-1 md:px-3 md:py-1.5 rounded-lg font-bold text-xs md:text-sm transition-all border ${
            isDone 
            ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200' 
            : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
        }`;
        btn.innerHTML = getButtonContent(isDone);
        
        btn.onclick = () => {
            const newStatus = toggleModuleStatus(currentPath);
            // Atualiza visual do botão
            btn.className = `flex items-center gap-1.5 md:gap-2 px-2 py-1 md:px-3 md:py-1.5 rounded-lg font-bold text-xs md:text-sm transition-all border ${
                newStatus 
                ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200' 
                : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
            }`;
            btn.innerHTML = getButtonContent(newStatus);
        };

        headerActions.appendChild(btn);
    }
}

function getButtonContent(isDone) {
    // Texto condicional para mobile (pode ser oculto ou encurtado se quiser extrema compactação)
    return isDone 
        ? '<i class="fas fa-check-circle"></i> <span class="hidden md:inline">Concluído</span><span class="md:hidden">OK</span>' 
        : '<i class="far fa-circle"></i> <span class="hidden md:inline">Marcar como Lido</span><span class="md:hidden">Marcar</span>';
}

function updateModuleButtonUI(filename) {
    // Apenas auxiliar se precisarmos atualizar de fora
}

// 3. Barra de Progresso Geral (para o Index)
function updateGlobalProgressUI() {
    const progressContainer = document.getElementById('global-progress-container');
    if (!progressContainer) return;

    const modules = menuItems.filter(m => m.isModule);
    const total = modules.length;
    const completed = modules.filter(m => getModuleStatus(m.file)).length;
    const percentage = Math.round((completed / total) * 100);

    progressContainer.innerHTML = `
        <div class="flex justify-between items-end mb-1 md:mb-2">
            <div>
                <span class="text-[10px] md:text-xs font-bold text-gray-500 uppercase">Seu Progresso</span>
                <div class="text-xl md:text-2xl font-bold text-[#003366] leading-none">${completed}/${total} <span class="text-xs md:text-sm font-normal text-gray-400">módulos</span></div>
            </div>
            <span class="text-xs md:text-sm font-bold text-[#003366]">${percentage}%</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-1.5 md:h-2.5 overflow-hidden">
            <div class="bg-gradient-to-r from-[#003366] to-[#0055A4] h-1.5 md:h-2.5 rounded-full transition-all duration-500" style="width: ${percentage}%"></div>
        </div>
    `;
}

function setupInteractivity() {
    const btn = document.getElementById('mobile-menu-btn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobile-overlay');

    function toggleMenu() {
        const isClosed = sidebar.classList.contains('-translate-x-full');
        if (isClosed) {
            sidebar.classList.remove('-translate-x-full');
            overlay.classList.remove('hidden');
            setTimeout(() => overlay.classList.remove('opacity-0'), 10);
            document.body.style.overflow = 'hidden';
        } else {
            sidebar.classList.add('-translate-x-full');
            overlay.classList.add('opacity-0');
            setTimeout(() => overlay.classList.add('hidden'), 300);
            document.body.style.overflow = '';
        }
    }

    if(btn) btn.addEventListener('click', toggleMenu);
    if(overlay) overlay.addEventListener('click', toggleMenu);
}