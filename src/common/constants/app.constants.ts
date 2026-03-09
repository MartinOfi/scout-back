/**
 * Application-wide constants
 * NO magic strings - centralize all configuration values here
 */

export const APP_NAME = 'Scout - Financial Management System';
export const API_VERSION = 'v1';
export const API_PREFIX = `api/${API_VERSION}`;

/**
 * Database constants
 */
export const DB_TABLES = {
  PERSONAS: 'personas',
  CAJAS: 'cajas',
  MOVIMIENTOS: 'movimientos',
  INSCRIPCIONES: 'inscripciones',
  CAMPAMENTOS: 'campamentos',
  EVENTOS: 'eventos',
} as const;

/**
 * Soft delete configuration
 */
export const SOFT_DELETE_FIELD = 'deletedAt';

/**
 * Pagination defaults
 */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

/**
 * Validation constraints
 */
export const VALIDATION = {
  MIN_NAME_LENGTH: 2,
  MAX_NAME_LENGTH: 100,
  MIN_EMAIL_LENGTH: 5,
  MAX_EMAIL_LENGTH: 255,
  MIN_PHONE_LENGTH: 7,
  MAX_PHONE_LENGTH: 20,
} as const;
