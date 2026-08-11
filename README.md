# 🏢 AGTAX Tech — Gestão de Clientes & Fluxo de Trabalho Fiscal

Sistema web moderno e escalável desenvolvido para a **AGTAX Tech**, focado na gestão completa de clientes, controle sintético e analítico de checklists fiscais, acompanhamento automatizado de esteiras de trabalho por etapa/período e auditoria em tempo real.

---

## 🎯 Objetivo da Ferramenta

O **AGTAX Tech Hub** centraliza a operação fiscal e consultiva da empresa em uma plataforma integrada, permitindo:
- Acompanhar a conformidade de obrigações acessórias e documentos fiscais (EFD ICMS/IPI, EFD PIS/COFINS, SPED ECD/ECF, XMLs NFe/CTe/NFSe).
- Automatizar o ciclo de vida das **Esteiras de Trabalho** a partir da conclusão dos checklists ou cadastro de clientes.
- Gerenciar com transparência os responsáveis principais e backups de cada fase do processo.
- Armazenar caminhos de rede do servidor e observações livres por etapa em cada esteira.
- Notificar a equipe em tempo real sobre inclusões, atualizações e movimentações no sistema.

---

## 🧩 Módulos do Sistema

### 1. 📊 Dashboard Sintético
- Visão panorâmica dos indicadores operacionais da carteira de clientes.
- Contadores de clientes ativos, esteiras em andamento, concluídas e pendências.
- Gráficos e resumos visuais para tomada de decisão ágil.

### 2. 👥 Módulo de Clientes
- Cadastro individual e gestão da carteira de clientes com CNPJ, Razão Social, CNAE Principal e Segmento (Indústria, Comércio, Serviço).
- **Automação**: Ao salvar um novo cliente, o sistema inicializa automaticamente uma esteira de trabalho no módulo de fluxo.

### 3. 📋 Checklist Fiscal (Matriz de Conformidade)
- Acompanhamento por cliente, ano-base e mês-base de todos os documentos fiscais exigidos.
- Visão Sintética e Analítica com status coloridos (`Completo`, `Pendente`, `Atraso`, `Crítico`, `N/A`).
- **Importação/Exportação**: Suporte a upload em massa via arquivos Excel (`.xlsx`) e CSV.
- **Automação**: Ao salvar ou importar um checklist completo, gera esteiras de trabalho automaticamente para os períodos habilitados.

### 4. 🔀 Módulo Fluxo de Trabalho (Esteiras)
- Interface limpa (UI/UX) com cards compactos e linha do tempo de progresso por etapa.
- **Criação de Esteira por Período**: Seleção vinculada exclusivamente aos períodos com `Status Geral = Completo` no checklist.
- **Gerenciamento de Avanço/Recuo**: Botões para avançar e voltar etapas no fluxo com validação.
- **Modal de Detalhes Único com Abas**:
  - Navegação entre abas por etapa (`1. Coleta de Arquivos`, `2. Calculadora RTC`, etc.).
  - Registro de **Caminho da Rede (Pasta do Servidor)** por etapa com botão de cópia rápida.
  - Campo de **Texto Livre / Observações** individual por etapa.

### 5. ⚙️ Módulo de Configurações
- Gerenciamento dinâmico das **Fases do Fluxo de Trabalho** (`workflow_phases`): inclusão, renomeação inline, alteração de ordem e cores.
- Matriz de distribuição de **Responsáveis Principais e Backups** por fase da equipe.

### 6. 🔐 Módulo de Autenticação & Central de Notificações
- Tela de **Login e Cadastro de Usuários** integrada ao Supabase Auth.
- Notificações em tempo real (Sininho no Header) conectadas à tabela de auditoria `activity_logs`.

---

## 🛠️ Tecnologias e Linguagens Utilizadas

- **Frontend Core**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite 6](https://vitejs.dev/)
- **Estilização**: Vanilla CSS + [Tailwind CSS v4](https://tailwindcss.com/)
- **Ícones**: [Lucide React](https://lucide.dev/)
- **Roteamento**: [React Router v7](https://reactrouter.com/)
- **Banco de Dados & Autenticação**: [Supabase](https://supabase.com/) (PostgreSQL + Supabase Auth + Realtime)
- **Manipulação de Planilhas**: [SheetJS / XLSX](https://sheetjs.com/)

---

## 🚀 Como Executar o Projeto Localmente

### Pré-requisitos
- **Node.js**: `v18+` instalado
- **npm** ou **bun**

### Passos de Instalação

1. **Clonar o Repositório**:
   ```bash
   git clone git@github.com:agtaxsp-cmd/gestao_clientes.git
   cd gestao_clientes
   ```

2. **Instalar as Dependências**:
   ```bash
   npm install
   ```

3. **Configurar as Variáveis de Ambiente**:
   Crie um arquivo `.env` na raiz do projeto contendo as credenciais do Supabase:
   ```env
   VITE_SUPABASE_URL=https://kzbkebzlbiakwfdsrttz.supabase.co
   VITE_SUPABASE_ANON_KEY=sua_chave_anonima_aqui
   ```

4. **Iniciar o Servidor de Desenvolvimento**:
   ```bash
   npm run dev
   ```
   Acesse a aplicação em `http://localhost:3000`.

5. **Gerar Build de Produção**:
   ```bash
   npm run build
   ```
