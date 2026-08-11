# Módulo: Dashboard (Logs e Métricas)

Este documento descreve a estrutura para compor os dados da tela principal do **Dashboard**.

*Nota: Os cards superiores (Total de Clientes, Atividades em Andamento, etc) e os gráficos não precisam de uma tabela dedicada; eles devem ser gerados no BFF por meio de consultas `COUNT()` ou `GROUP BY` nas tabelas `clients`, `workflow_pipelines` e `fiscal_documents_matrix`.*

Para a seção de **Atividades Recentes (Recent Activity)**, sugerimos a tabela abaixo:

## Tabela: `activity_logs`

Registra o histórico de ações importantes no sistema (auditoria e feed).

| Coluna | Tipo (PostgreSQL) | Restrições / Notas | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | PRIMARY KEY, default `gen_random_uuid()` | Identificador do log. |
| `client_id` | `uuid` | FOREIGN KEY REFERENCES `clients(id)`, NULL | Cliente afetado (se aplicável). |
| `user_id` | `uuid` | FOREIGN KEY REFERENCES `auth.users(id)`, NULL| Quem realizou a ação. |
| `tipo_log` | `log_type_enum` | NOT NULL | Determina o ícone/cor no feed. |
| `titulo` | `varchar(255)` | NOT NULL | Resumo da ação (ex: "Acme Corp"). |
| `descricao` | `text` | NOT NULL | Detalhe (ex: "Envio da DCTF concluído"). |
| `created_at` | `timestamptz` | default `now()` | Quando ocorreu a atividade. |

### Tipos Customizados (Enums)
```sql
CREATE TYPE log_type_enum AS ENUM (
  'success', -- Ícone verde (Check)
  'error',   -- Ícone vermelho (Warning)
  'info',    -- Ícone azul (Document/Info)
  'sync'     -- Ícone amarelo (Refresh)
);
```
