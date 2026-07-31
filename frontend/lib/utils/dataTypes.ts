/**
 * Utilitários para formatação e detecção de tipos de dados
 */

import { ColumnMetadata } from '@/types/api';

/**
 * Tipos de dados suportados
 */
export type DataType = 'string' | 'integer' | 'double' | 'datetime' | 'boolean' | 'unknown';

/**
 * Mapeia tipos do Trino para tipos simplificados
 */
export function mapTrinoTypeToDataType(trinoType: string): DataType {
  const lowerType = trinoType.toLowerCase();
  
  // Tipos inteiros
  if (lowerType.includes('int') || lowerType.includes('bigint') || lowerType.includes('smallint') || lowerType.includes('tinyint')) {
    return 'integer';
  }
  
  // Tipos decimais/flutuantes
  if (lowerType.includes('double') || lowerType.includes('real') || lowerType.includes('decimal') || lowerType.includes('float') || lowerType.includes('numeric')) {
    return 'double';
  }
  
  // Tipos de data/hora
  if (lowerType.includes('date') || lowerType.includes('time') || lowerType.includes('timestamp')) {
    return 'datetime';
  }
  
  // Tipos booleanos
  if (lowerType.includes('boolean') || lowerType === 'bool') {
    return 'boolean';
  }
  
  // Padrão: string
  return 'string';
}

/**
 * Detecta o tipo de dado a partir do valor (fallback quando tipo não disponível)
 */
export function detectDataType(value: any): DataType {
  if (value === null || value === undefined) {
    return 'unknown';
  }
  
  if (typeof value === 'boolean') {
    return 'boolean';
  }
  
  if (typeof value === 'number') {
    // Verifica se é inteiro ou decimal
    return Number.isInteger(value) ? 'integer' : 'double';
  }
  
  if (typeof value === 'string') {
    // Tenta detectar se é uma data
    if (/^\d{4}-\d{2}-\d{2}/.test(value) || /^\d{2}\/\d{2}\/\d{4}/.test(value)) {
      return 'datetime';
    }
    return 'string';
  }
  
  if (value instanceof Date) {
    return 'datetime';
  }
  
  return 'unknown';
}

/**
 * Formata um valor baseado no tipo de dado
 */
export function formatValue(value: any, dataType: DataType): string {
  if (value === null || value === undefined) {
    return '-';
  }
  
  switch (dataType) {
    case 'integer':
      return formatInteger(value);
    
    case 'double':
      return formatDouble(value);
    
    case 'datetime':
      return formatDateTime(value);
    
    case 'boolean':
      return value ? 'Sim' : 'Não';
    
    case 'string':
    default:
      return String(value);
  }
}

/**
 * Formata um número inteiro
 */
function formatInteger(value: any): string {
  const num = typeof value === 'number' ? value : parseInt(String(value), 10);
  if (isNaN(num)) {
    return String(value);
  }
  return num.toLocaleString('pt-BR');
}

/**
 * Formata um número decimal
 */
function formatDouble(value: any): string {
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num)) {
    return String(value);
  }
  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Formata uma data/hora
 */
function formatDateTime(value: any): string {
  let date: Date;
  
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'string') {
    date = new Date(value);
  } else if (typeof value === 'number') {
    date = new Date(value);
  } else {
    return String(value);
  }
  
  if (isNaN(date.getTime())) {
    return String(value);
  }
  
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Obtém a largura padrão para um tipo de dado
 */
export function getColumnWidth(dataType: DataType): number {
  switch (dataType) {
    case 'integer':
      return 120;
    case 'double':
      return 150;
    case 'datetime':
      return 180;
    case 'boolean':
      return 100;
    case 'string':
    default:
      return 200;
  }
}

/**
 * Obtém o alinhamento padrão para um tipo de dado
 */
export function getColumnAlign(dataType: DataType): 'left' | 'right' | 'center' {
  switch (dataType) {
    case 'integer':
    case 'double':
      return 'right';
    case 'boolean':
      return 'center';
    case 'string':
    case 'datetime':
    default:
      return 'left';
  }
}

/**
 * Obtém o tipo de dado para uma coluna
 */
export function getColumnDataType(columnName: string, columnTypes?: ColumnMetadata[]): DataType {
  if (columnTypes) {
    const columnMeta = columnTypes.find(col => col.name === columnName);
    if (columnMeta) {
      return mapTrinoTypeToDataType(columnMeta.type);
    }
  }
  
  // Fallback: inferir do nome da coluna
  const lowerName = columnName.toLowerCase();
  if (lowerName.includes('id') || lowerName.includes('num')) {
    return 'integer';
  }
  if (lowerName.includes('date') || lowerName.includes('time') || lowerName.includes('created') || lowerName.includes('updated')) {
    return 'datetime';
  }
  if (lowerName.includes('price') || lowerName.includes('amount') || lowerName.includes('total') || lowerName.includes('value')) {
    return 'double';
  }
  
  return 'string';
}
