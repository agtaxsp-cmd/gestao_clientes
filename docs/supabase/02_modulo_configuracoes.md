# Módulo: Configurações e Responsáveis

Este documento descreve a estrutura de tabelas necessária no Supabase para suportar o módulo de **Configurações (Membros da Equipe e Matriz de Atribuições)**.

## Tabela: `team_members`

Responsável por armazenar os membros da equipe que podem ser alocados no fluxo de trabalho.

| Coluna | Tipo (PostgreSQL) | Restrições / Notas | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | PRIMARY KEY, default `gen_random_uuid()` | Identificador único do membro. |
| `nome` | `varchar(255)` | NOT NULL | Nome completo do membro. |
| `cargo` | `varchar(100)` | NOT NULL | Ex: 'Consultor de Inovação', 'Coordenador'. |
| `iniciais` | `varchar(3)` | NOT NULL | Iniciais para o Avatar na UI (Ex: 'FH'). |
| `ui_color_bg` | `varchar(50)` | NOT NULL | Classe de cor de fundo (ex: 'bg-indigo-100'). |
| `ui_color_text` | `varchar(50)` | NOT NULL | Classe de cor do texto (ex: 'text-indigo-700'). |
| `created_at` | `timestamptz` | default `now()` | Data de criação. |

---

## Tabela: `workflow_assignments`

Responsável por armazenar a matriz padrão de atribuições (quem é o responsável principal e o backup de cada fase do fluxo padrão).

| Coluna | Tipo (PostgreSQL) | Restrições / Notas | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | PRIMARY KEY, default `gen_random_uuid()` | Identificador da regra de atribuição. |
| `fase_fluxo` | `fase_enum` | UNIQUE, NOT NULL | Fase do fluxo de trabalho. |
| `responsavel_principal_id`| `uuid` | FOREIGN KEY REFERENCES `team_members(id)` | Membro principal alocado. |
| `responsavel_backup_id` | `uuid` | FOREIGN KEY REFERENCES `team_members(id)`, NULL | Membro de backup alocado. |
| `updated_at` | `timestamptz` | default `now()` | Última atualização da atribuição. |

### Tipos Customizados (Enums)
```sql
CREATE TYPE fase_enum AS ENUM (
  'coleta_arquivos',
  'calculadora_rtc',
  'compliance_rtc',
  'apuracao_assistida',
  'entrega_apresentacao'
);
```
