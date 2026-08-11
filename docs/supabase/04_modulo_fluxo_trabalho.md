# Módulo: Fluxo de Trabalho (Pipelines)

Este documento descreve a estrutura de tabelas necessária no Supabase para suportar o módulo de **Fluxo de Trabalho**.

## Tabela: `workflow_pipelines`

Responsável por acompanhar a "esteira" (pipeline) de conformidade ativa de cada cliente.

| Coluna | Tipo (PostgreSQL) | Restrições / Notas | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | PRIMARY KEY, default `gen_random_uuid()` | Identificador único do pipeline. |
| `client_id` | `uuid` | FOREIGN KEY REFERENCES `clients(id)`, NOT NULL | Cliente em esteira (Módulo 1). |
| `status` | `pipeline_status_enum`| NOT NULL, default `'iniciado'` | Status geral do fluxo. |
| `etapa_atual` | `integer` | NOT NULL, default `1` | Índice da etapa (1 a 5). |
| `mensagem_info` | `varchar(255)` | NULL | Mensagem de detalhes (ex: "Aguardando aprovação..."). |
| `ano_referencia`| `integer` | NOT NULL | Ano base da esteira (ex: 2023). |
| `created_at` | `timestamptz` | default `now()` | Data que o fluxo foi criado. |
| `updated_at` | `timestamptz` | default `now()` | Última interação ("Última att"). |

### Regra de Negócio (Front/Back)
A `etapa_atual` (1 a 5) corresponde às fases cadastradas nas configurações:
1. Arquivos
2. Calculadora RTC
3. Compliance RTC
4. Apuração Assistida
5. Entrega e Apresentação

### Tipos Customizados (Enums)
```sql
CREATE TYPE pipeline_status_enum AS ENUM (
  'iniciado',
  'em_andamento',
  'concluido',
  'bloqueado'
);
```
