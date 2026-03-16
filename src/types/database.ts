// ─── Database Schema Types ────────────────────────────────────────────────────
// Represents the full production database schema for AccountsPro

export type FieldType =
  | 'BIGINT' | 'INT' | 'SMALLINT'
  | 'VARCHAR' | 'TEXT' | 'CHAR'
  | 'DECIMAL' | 'NUMERIC' | 'FLOAT'
  | 'BOOLEAN'
  | 'TIMESTAMP' | 'DATE' | 'TIME'
  | 'UUID' | 'JSON' | 'JSONB'
  | 'ENUM';

export interface TableField {
  name: string;
  type: FieldType;
  length?: number | string;       // e.g. 255, '10,2'
  nullable: boolean;
  primaryKey?: boolean;
  foreignKey?: { table: string; field: string };
  unique?: boolean;
  default?: string;
  enumValues?: string[];
  description: string;
}

export interface TableIndex {
  name: string;
  fields: string[];
  unique?: boolean;
  description: string;
}

export interface SchemaTable {
  name: string;                   // snake_case table name
  label: string;                  // Human-readable
  module: string;                 // Which module owns it
  description: string;
  fields: TableField[];
  indexes?: TableIndex[];
  rowEstimate?: string;           // e.g. '~10K rows'
  color: string;                  // Tailwind color class for the card
}

export interface ApiEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  description: string;
  requestBody?: Record<string, string>;
  responseExample?: Record<string, unknown>;
  statusCodes: { code: number; meaning: string }[];
  auth: 'Bearer JWT' | 'API Key' | 'Public';
}

export interface SchemaModule {
  name: string;
  color: string;
  tables: string[];               // table names
  endpoints: ApiEndpoint[];
}
