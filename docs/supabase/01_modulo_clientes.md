# Módulo: Gestão de Clientes

Este documento descreve a estrutura de tabelas necessária no Supabase para suportar o módulo de **Clientes**.

## Tabela: `clients`

Responsável por armazenar os dados cadastrais das empresas clientes.

| Coluna | Tipo (PostgreSQL) | Restrições / Notas | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | PRIMARY KEY, default `gen_random_uuid()` | Identificador único do cliente. |
| `cnpj` | `varchar(18)` | UNIQUE, NOT NULL | CNPJ formatado ou apenas números. |
| `nome_grupo` | `varchar(100)` | NULL | Nome do grupo econômico (opcional). |
| `razao_social` | `varchar(255)` | NOT NULL | Razão social completa da empresa. |
| `cnae_principal` | `varchar(20)` | NOT NULL | Código CNAE principal. |
| `segmento` | `segmento_enum` | NOT NULL | Enum: `'industria'`, `'comercio'`, `'servico'`. |
| `ui_color` | `varchar(20)` | NULL | Cor para a UI (ex: `'emerald'`, `'indigo'`). |
| `created_at` | `timestamptz` | default `now()` | Data de criação do registro. |
| `updated_at` | `timestamptz` | default `now()` | Data da última atualização. |

### Tipos Customizados (Enums)
```sql
CREATE TYPE segmento_enum AS ENUM ('industria', 'comercio', 'servico');
```

### Políticas RLS (Row Level Security) Sugeridas
- Permitir **SELECT**, **INSERT**, **UPDATE** e **DELETE** para usuários autenticados da mesma organização/tenant (caso a aplicação seja multi-tenant).
