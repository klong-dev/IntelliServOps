import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a unique UUID v4 string
 */
export function generateUUID(): string {
  return uuidv4();
}

/**
 * Generate a reference number with prefix
 * Format: PREFIX-YYYYMMDD-RANDOM
 */
export function generateReferenceNumber(prefix: string): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${dateStr}-${random}`;
}

/**
 * Generate invoice number
 */
export function generateInvoiceNumber(): string {
  return generateReferenceNumber('INV');
}

/**
 * Generate contract number
 */
export function generateContractNumber(): string {
  return generateReferenceNumber('CTR');
}

/**
 * Generate ticket number
 */
export function generateTicketNumber(): string {
  return generateReferenceNumber('TKT');
}

/**
 * Generate payment reference
 */
export function generatePaymentReference(): string {
  return generateReferenceNumber('PAY');
}
