# Módulo: Checklist (Matriz de Documentos Fiscais)

Este documento descreve a estrutura de tabelas necessária no Supabase para suportar o módulo de **Checklist / Matriz de Conformidade**.

## Tabela: `fiscal_documents_matrix`

Responsável por acompanhar o status de cada obrigação acessória para um determinado cliente e ano base.

| Coluna | Tipo (PostgreSQL) | Restrições / Notas | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | PRIMARY KEY, default `gen_random_uuid()` | Identificador único do registro de matriz. |
| `client_id` | `uuid` | FOREIGN KEY REFERENCES `clients(id)`, NOT NULL | Cliente relacionado (Módulo 1). |
| `ano_base` | `integer` | NOT NULL | Ano de referência (ex: 2023). |
| `efd_icms_ipi` | `status_doc_enum` | NOT NULL, default `'na'` | Status da obrigação. |
| `efd_pis_cofins` | `status_doc_enum` | NOT NULL, default `'na'` | Status da obrigação. |
| `sped_ecd` | `status_doc_enum` | NOT NULL, default `'na'` | Status da obrigação. |
| `sped_ecf` | `status_doc_enum` | NOT NULL, default `'na'` | Status da obrigação. |
| `xml_nfe` | `status_doc_enum` | NOT NULL, default `'na'` | Status da obrigação. |
| `xml_cte` | `status_doc_enum` | NOT NULL, default `'na'` | Status da obrigação. |
| `xml_nfse` | `status_doc_enum` | NOT NULL, default `'na'` | Status da obrigação. |
| `status_geral` | `status_geral_enum`| NOT NULL, default `'pendente'` | Resumo do status global. |
| `updated_at` | `timestamptz` | default `now()` | Última atualização do checklist. |

*Nota 1: Recomenda-se criar uma restrição de unicidade (UNIQUE CONSTRAINT) combinando `client_id` e `ano_base` para garantir que um cliente tenha apenas uma matriz por ano.*

*Nota 2 (Interface): Na interface do módulo, as colunas "Razão Social", "Grupo" e "CNPJ" são exibidas junto com esta matriz. Para a modelagem no Supabase, a tabela `fiscal_documents_matrix` não deve duplicar essas colunas, pois elas já pertencem à tabela `clients`. O BFF (Backend For Frontend) deverá realizar um JOIN entre `fiscal_documents_matrix` e `clients` através da chave `client_id` para consultar e retornar essas informações consolidadas.*

### Tipos Customizados (Enums)
```sql
CREATE TYPE status_doc_enum AS ENUM (
  'compliant', -- Entregue / Conforme
  'pending',   -- Pendente / Em andamento
  'critical',  -- Atrasado / Faltante
  'na'         -- Não Aplicável
);

CREATE TYPE status_geral_enum AS ENUM (
  'completo',
  'pendente',
  'atraso'
);
```
