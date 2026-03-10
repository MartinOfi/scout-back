/**
 * Scout API Types
 * Tipos TypeScript para integración con el frontend
 * Auto-generado desde el backend
 */

// ============================================================================
// ENUMS
// ============================================================================

export enum PersonaType {
  PROTAGONISTA = 'protagonista',
  EDUCADOR = 'educador',
  EXTERNA = 'externo',
}

export enum EstadoPersona {
  ACTIVO = 'activo',
  INACTIVO = 'inactivo',
}

export enum Rama {
  MANADA = 'Manada',
  UNIDAD = 'Unidad',
  CAMINANTES = 'Caminantes',
  ROVERS = 'Rovers',
}

export enum CargoEducador {
  EDUCADOR = 'Educador',
  JEFE_DE_RAMA = 'Jefe de Rama',
  JEFE_DE_GRUPO = 'Jefe de Grupo',
}

export enum CajaType {
  GRUPO = 'grupo',
  RAMA_MANADA = 'rama_manada',
  RAMA_UNIDAD = 'rama_unidad',
  RAMA_CAMINANTES = 'rama_caminantes',
  RAMA_ROVERS = 'rama_rovers',
  PERSONAL = 'personal',
}

export enum TipoMovimiento {
  INGRESO = 'ingreso',
  EGRESO = 'egreso',
}

export enum ConceptoMovimiento {
  INSCRIPCION_GRUPO = 'inscripcion_grupo',
  INSCRIPCION_SCOUT_ARGENTINA = 'inscripcion_scout_argentina',
  INSCRIPCION_PAGO_SCOUT_ARGENTINA = 'inscripcion_pago_scout_argentina',
  CUOTA_GRUPO = 'cuota_grupo',
  CAMPAMENTO_PAGO = 'campamento_pago',
  CAMPAMENTO_GASTO = 'campamento_gasto',
  EVENTO_VENTA_INGRESO = 'evento_venta_ingreso',
  EVENTO_VENTA_GASTO = 'evento_venta_gasto',
  EVENTO_GRUPO_INGRESO = 'evento_grupo_ingreso',
  EVENTO_GRUPO_GASTO = 'evento_grupo_gasto',
  GASTO_GENERAL = 'gasto_general',
  REEMBOLSO = 'reembolso',
  AJUSTE_INICIAL = 'ajuste_inicial',
  ASIGNACION_FONDO_RAMA = 'asignacion_fondo_rama',
  TRANSFERENCIA_BAJA = 'transferencia_baja',
}

export enum MedioPago {
  EFECTIVO = 'efectivo',
  TRANSFERENCIA = 'transferencia',
}

export enum EstadoPago {
  PAGADO = 'pagado',
  PENDIENTE_REEMBOLSO = 'pendiente_reembolso',
}

export enum EstadoInscripcion {
  PENDIENTE = 'pendiente',
  PARCIAL = 'parcial',
  PAGADO = 'pagado',
  BONIFICADO = 'bonificado',
}

export enum TipoInscripcion {
  GRUPO = 'grupo',
  SCOUT_ARGENTINA = 'scout_argentina',
}

export enum EstadoCuota {
  PENDIENTE = 'pendiente',
  PARCIAL = 'parcial',
  PAGADO = 'pagado',
}

export enum EstadoPagoCampamento {
  PENDIENTE = 'pendiente',
  PARCIAL = 'parcial',
  PAGADO = 'pagado',
}

export enum TipoEvento {
  VENTA = 'venta',
  GRUPO = 'grupo',
}

export enum DestinoGanancia {
  CUENTAS_PERSONALES = 'cuentas_personales',
  CAJA_GRUPO = 'caja_grupo',
}

// ============================================================================
// BASE ENTITY
// ============================================================================

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

// ============================================================================
// PERSONAS
// ============================================================================

export interface Persona extends BaseEntity {
  nombre: string;
  estado: EstadoPersona;
  tipo: PersonaType;
}

export interface Protagonista extends Persona {
  tipo: PersonaType.PROTAGONISTA;
  rama: Rama;
}

export interface Educador extends Persona {
  tipo: PersonaType.EDUCADOR;
  rama: Rama | null;
  cargo: CargoEducador;
}

export interface PersonaExterna extends Persona {
  tipo: PersonaType.EXTERNA;
  contacto: string | null;
  notas: string | null;
}

export type PersonaUnion = Protagonista | Educador | PersonaExterna;

// ============================================================================
// CAJAS
// ============================================================================

export interface Caja extends BaseEntity {
  tipo: CajaType;
  nombre: string | null;
  propietarioId: string | null;
  propietario?: Persona | null;
}

// ============================================================================
// MOVIMIENTOS
// ============================================================================

export interface Movimiento extends BaseEntity {
  cajaId: string;
  tipo: TipoMovimiento;
  monto: number;
  concepto: ConceptoMovimiento;
  descripcion: string | null;
  responsableId: string;
  medioPago: MedioPago;
  requiereComprobante: boolean;
  comprobanteEntregado: boolean | null;
  estadoPago: EstadoPago;
  personaAReembolsarId: string | null;
  fecha: string;
  eventoId: string | null;
  campamentoId: string | null;
  inscripcionId: string | null;
  cuotaId: string | null;
  caja?: Caja;
  responsable?: Persona;
  personaAReembolsar?: Persona | null;
}

// ============================================================================
// INSCRIPCIONES
// ============================================================================

export interface Inscripcion extends BaseEntity {
  personaId: string;
  tipo: TipoInscripcion;
  ano: number;
  montoTotal: number;
  montoBonificado: number;
  declaracionDeSalud: boolean;
  autorizacionDeImagen: boolean;
  salidasCercanas: boolean;
  autorizacionIngreso: boolean;
  persona?: Persona;
  estado?: EstadoInscripcion;
  montoPagado?: number;
}

// ============================================================================
// CUOTAS
// ============================================================================

export interface Cuota extends BaseEntity {
  personaId: string;
  nombre: string;
  ano: number;
  montoTotal: number;
  montoPagado: number;
  estado: EstadoCuota;
  persona?: Persona;
}

// ============================================================================
// CAMPAMENTOS
// ============================================================================

export interface Campamento extends BaseEntity {
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  costoPorPersona: number;
  cuotasBase: number;
  descripcion: string | null;
  participantes?: Persona[];
}

// ============================================================================
// EVENTOS
// ============================================================================

export interface Evento extends BaseEntity {
  nombre: string;
  fecha: string;
  descripcion: string | null;
  tipo: TipoEvento;
  destinoGanancia: DestinoGanancia | null;
  tipoEvento: string | null;
  productos?: Producto[];
}

export interface Producto extends BaseEntity {
  eventoId: string;
  nombre: string;
  precioCosto: number;
  precioVenta: number;
  evento?: Evento;
}

export interface VentaProducto extends BaseEntity {
  eventoId: string;
  productoId: string;
  vendedorId: string;
  cantidad: number;
  evento?: Evento;
  producto?: Producto;
  vendedor?: Persona;
}

// ============================================================================
// DTOs - PERSONAS
// ============================================================================

export interface CreateProtagonistaDto {
  nombre: string;
  rama: Rama;
}

export interface CreateEducadorDto {
  nombre: string;
  rama?: Rama;
  cargo: CargoEducador;
}

export interface CreatePersonaExternaDto {
  nombre: string;
  contacto?: string;
  notas?: string;
}

export interface UpdatePersonaDto {
  nombre?: string;
  estado?: EstadoPersona;
  rama?: Rama;
  cargo?: CargoEducador;
  contacto?: string;
  notas?: string;
}

// ============================================================================
// DTOs - CAJAS
// ============================================================================

export interface CreateCajaDto {
  tipo: CajaType;
  nombre?: string;
  propietarioId?: string;
}

// ============================================================================
// DTOs - MOVIMIENTOS
// ============================================================================

export interface CreateMovimientoDto {
  cajaId: string;
  tipo: TipoMovimiento;
  monto: number;
  concepto: ConceptoMovimiento;
  descripcion?: string;
  responsableId: string;
  medioPago: MedioPago;
  requiereComprobante?: boolean;
  comprobanteEntregado?: boolean;
  estadoPago: EstadoPago;
  personaAReembolsarId?: string;
  fecha?: string;
  eventoId?: string;
  campamentoId?: string;
  inscripcionId?: string;
  cuotaId?: string;
}

export interface UpdateMovimientoDto {
  monto?: number;
  descripcion?: string;
  medioPago?: MedioPago;
  requiereComprobante?: boolean;
  comprobanteEntregado?: boolean;
  estadoPago?: EstadoPago;
  personaAReembolsarId?: string;
  fecha?: string;
}

export interface GastoGeneralDto {
  cajaId: string;
  monto: number;
  descripcion: string;
  responsableId: string;
  medioPago: MedioPago;
  estadoPago: EstadoPago;
  personaAReembolsarId?: string;
  requiereComprobante?: boolean;
}

// ============================================================================
// DTOs - INSCRIPCIONES
// ============================================================================

export interface CreateInscripcionDto {
  personaId: string;
  tipo: TipoInscripcion;
  ano: number;
  montoTotal: number;
  montoBonificado?: number;
  declaracionDeSalud?: boolean;
  autorizacionDeImagen?: boolean;
  salidasCercanas?: boolean;
  autorizacionIngreso?: boolean;
}

export interface UpdateInscripcionDto {
  montoBonificado?: number;
  declaracionDeSalud?: boolean;
  autorizacionDeImagen?: boolean;
  salidasCercanas?: boolean;
  autorizacionIngreso?: boolean;
}

// ============================================================================
// DTOs - CUOTAS
// ============================================================================

export interface CreateCuotaDto {
  personaId: string;
  nombre: string;
  ano: number;
  montoTotal: number;
}

export interface PagoCuotaDto {
  monto: number;
  medioPago: MedioPago;
  responsableId: string;
}

// ============================================================================
// DTOs - CAMPAMENTOS
// ============================================================================

export interface CreateCampamentoDto {
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  costoPorPersona: number;
  cuotasBase?: number;
  descripcion?: string;
}

export interface UpdateCampamentoDto {
  nombre?: string;
  fechaInicio?: string;
  fechaFin?: string;
  costoPorPersona?: number;
  cuotasBase?: number;
  descripcion?: string;
}

export interface AddParticipanteDto {
  personaId: string;
}

export interface PagoCampamentoDto {
  personaId: string;
  monto: number;
  medioPago: MedioPago;
}

export interface GastoCampamentoDto {
  monto: number;
  descripcion: string;
  responsableId: string;
  medioPago: MedioPago;
  estadoPago: EstadoPago;
  personaAReembolsarId?: string;
}

// ============================================================================
// DTOs - EVENTOS
// ============================================================================

export interface CreateEventoDto {
  nombre: string;
  fecha: string;
  descripcion?: string;
  tipo: TipoEvento;
  destinoGanancia?: DestinoGanancia;
  tipoEvento?: string;
}

export interface UpdateEventoDto {
  nombre?: string;
  fecha?: string;
  descripcion?: string;
  destinoGanancia?: DestinoGanancia;
  tipoEvento?: string;
}

export interface CreateProductoDto {
  eventoId: string;
  nombre: string;
  precioCosto: number;
  precioVenta: number;
}

export interface CreateVentaProductoDto {
  eventoId: string;
  productoId: string;
  vendedorId: string;
  cantidad: number;
}

export interface IngresoEventoDto {
  monto: number;
  descripcion: string;
  responsableId: string;
  medioPago: MedioPago;
}

export interface GastoEventoDto {
  monto: number;
  descripcion: string;
  responsableId: string;
  medioPago: MedioPago;
  estadoPago: EstadoPago;
  personaAReembolsarId?: string;
}

export interface CerrarEventoDto {
  medioPago: MedioPago;
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

export interface SaldoCajaResponse {
  cajaId: string;
  saldo: number;
}

export interface DarDeBajaResponse {
  saldoTransferido: number;
}

export interface ResumenFinancieroCampamento {
  campamentoId: string;
  totalEsperado: number;
  totalRecaudado: number;
  totalGastos: number;
  balance: number;
  participantes: number;
}

export interface PagoParticipante {
  personaId: string;
  nombre: string;
  montoPagado: number;
  montoEsperado: number;
  estado: EstadoPagoCampamento;
}

export interface ResumenVentasProducto {
  productoId: string;
  nombre: string;
  cantidadVendida: number;
  ingresos: number;
  costo: number;
  ganancia: number;
}

export interface ResumenVentasVendedor {
  vendedorId: string;
  nombre: string;
  cantidadVendida: number;
  ganancia: number;
}

export interface ResumenVentas {
  eventoId: string;
  totalVentas: number;
  totalCosto: number;
  gananciaTotal: number;
  ventasPorProducto: ResumenVentasProducto[];
  ventasPorVendedor: ResumenVentasVendedor[];
}

export interface ReembolsoPendiente {
  personaId: string;
  nombre: string;
  montoTotal: number;
  movimientos: Movimiento[];
}

// ============================================================================
// ERROR RESPONSE
// ============================================================================

export interface ErrorResponse {
  statusCode: number;
  message: string | string[];
  error: string;
}

// ============================================================================
// QUERY PARAMS
// ============================================================================

export interface PersonasQueryParams {
  tipo?: PersonaType;
  soloActivos?: boolean;
}

export interface CajasQueryParams {
  tipo?: CajaType;
}

export interface MovimientosQueryParams {
  cajaId?: string;
  tipo?: TipoMovimiento;
  concepto?: ConceptoMovimiento;
  responsableId?: string;
  estadoPago?: EstadoPago;
  fechaInicio?: string;
  fechaFin?: string;
}

export interface InscripcionesQueryParams {
  ano?: number;
  tipo?: TipoInscripcion;
}

export interface CuotasQueryParams {
  ano?: number;
}
