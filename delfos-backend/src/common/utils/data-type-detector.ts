/**
 * Utilitário para detectar tipos de dados dinamicamente a partir dos valores retornados
 */

import { ColumnMetadata } from '../../trino/dto/execute-query-response.dto';

/**
 * Detecta o tipo de dado de um valor
 */
function detectValueType(value: any): string {
  if (value === null || value === undefined) {
    return 'varchar'; // Não podemos determinar o tipo de NULL
  }

  // Boolean
  if (typeof value === 'boolean') {
    return 'boolean';
  }

  // Number
  if (typeof value === 'number') {
    // Verificar se é inteiro ou decimal
    if (Number.isInteger(value)) {
      return 'integer';
    } else {
      return 'double';
    }
  }

  // String
  if (typeof value === 'string') {
    // Tentar detectar se é uma data/timestamp
    if (isDateString(value)) {
      return 'timestamp';
    }
    // Tentar detectar se é um número em formato string
    if (isNumericString(value)) {
      // Verificar se tem casas decimais
      if (value.includes('.') || value.includes(',')) {
        return 'double';
      } else {
        return 'integer';
      }
    }
    return 'varchar';
  }

  // Date object
  if (value instanceof Date) {
    return 'timestamp';
  }

  // Array ou Object - tratar como varchar/JSON
  if (Array.isArray(value) || typeof value === 'object') {
    return 'varchar';
  }

  return 'varchar'; // Padrão
}

/**
 * Verifica se uma string é uma data válida
 */
function isDateString(value: string): boolean {
  // Padrões comuns de data
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}/, // YYYY-MM-DD
    /^\d{2}\/\d{2}\/\d{4}/, // DD/MM/YYYY
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, // ISO datetime
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/, // YYYY-MM-DD HH:mm:ss
  ];

  return datePatterns.some(pattern => pattern.test(value)) && !isNaN(Date.parse(value));
}

/**
 * Verifica se uma string representa um número
 */
function isNumericString(value: string): boolean {
  // Remove espaços e caracteres de formatação numérica
  const cleaned = value.trim().replace(/[.,]/g, '');
  return /^\d+$/.test(cleaned);
}

/**
 * Determina o tipo mais comum de uma coluna baseado em todos os valores
 */
function determineColumnType(values: any[], columnName: string): string {
  if (values.length === 0) {
    // Se não há valores, tentar inferir do nome da coluna
    return inferTypeFromColumnName(columnName);
  }

  // Contar ocorrências de cada tipo
  const typeCounts: Record<string, number> = {};
  let nonNullCount = 0;

  for (const value of values) {
    if (value !== null && value !== undefined) {
      const detectedType = detectValueType(value);
      typeCounts[detectedType] = (typeCounts[detectedType] || 0) + 1;
      nonNullCount++;
    }
  }

  // Se todos os valores são NULL, inferir do nome
  if (nonNullCount === 0) {
    return inferTypeFromColumnName(columnName);
  }

  // Encontrar o tipo mais comum
  let mostCommonType = 'varchar';
  let maxCount = 0;

  for (const [type, count] of Object.entries(typeCounts)) {
    if (count > maxCount) {
      maxCount = count;
      mostCommonType = type;
    }
  }

  // Se o tipo mais comum representa menos de 50% dos valores não-nulos,
  // usar varchar como padrão (dados mistos)
  if (maxCount / nonNullCount < 0.5) {
    return inferTypeFromColumnName(columnName);
  }

  return mostCommonType;
}

/**
 * Infere o tipo de dado a partir do nome da coluna (fallback)
 */
function inferTypeFromColumnName(columnName: string): string {
  const lowerName = columnName.toLowerCase();

  // IDs e números
  if (
    lowerName.includes('id') ||
    lowerName.includes('num') ||
    lowerName.includes('count') ||
    lowerName.includes('quantity')
  ) {
    return 'integer';
  }

  // Datas e timestamps
  if (
    lowerName.includes('date') ||
    lowerName.includes('time') ||
    lowerName.includes('created') ||
    lowerName.includes('updated') ||
    lowerName.includes('modified') ||
    lowerName.includes('timestamp')
  ) {
    return 'timestamp';
  }

  // Valores monetários e decimais
  if (
    lowerName.includes('price') ||
    lowerName.includes('amount') ||
    lowerName.includes('total') ||
    lowerName.includes('value') ||
    lowerName.includes('cost') ||
    lowerName.includes('rate') ||
    lowerName.includes('percent') ||
    lowerName.includes('ratio')
  ) {
    return 'double';
  }

  // Booleanos
  if (
    lowerName.includes('is_') ||
    lowerName.includes('has_') ||
    lowerName.includes('can_') ||
    lowerName.startsWith('is') ||
    lowerName.startsWith('has') ||
    lowerName.startsWith('can')
  ) {
    return 'boolean';
  }

  // Padrão: varchar
  return 'varchar';
}

/**
 * Detecta tipos de dados para todas as colunas dinamicamente
 */
export function detectColumnTypes(
  data: Record<string, any>[],
  columns: string[],
): ColumnMetadata[] {
  if (data.length === 0 || columns.length === 0) {
    return columns.map((col) => ({
      name: col,
      type: inferTypeFromColumnName(col),
    }));
  }

  // Para cada coluna, coletar todos os valores e determinar o tipo
  return columns.map((columnName) => {
    const values = data.map((row) => row[columnName]);
    const detectedType = determineColumnType(values, columnName);

    return {
      name: columnName,
      type: detectedType,
    };
  });
}
