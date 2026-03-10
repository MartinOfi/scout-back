# Scout API Reference

> Documentación completa de la API para integración con el frontend.
> Base URL: `http://localhost:3001/api/v1`

## Tabla de Contenidos

- [Enums](#enums)
- [Interfaces de Entidades](#interfaces-de-entidades)
- [DTOs](#dtos)
- [Endpoints](#endpoints)
  - [Personas](#personas)
  - [Cajas](#cajas)
  - [Movimientos](#movimientos)
  - [Inscripciones](#inscripciones)
  - [Cuotas](#cuotas)
  - [Campamentos](#campamentos)
  - [Eventos](#eventos)

---

## Enums

```typescript
// ============================================================================
// PERSONAS
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

// ============================================================================
// CAJAS Y MOVIMIENTOS
// ============================================================================

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

// ============================================================================
// INSCRIPCIONES Y CUOTAS
// ============================================================================

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

// ============================================================================
// CAMPAMENTOS
// ============================================================================

export enum EstadoPagoCampamento {
  PENDIENTE = 'pendiente',
  PARCIAL = 'parcial',
  PAGADO = 'pagado',
}

// ============================================================================
// EVENTOS
// ============================================================================

export enum TipoEvento {
  VENTA = 'venta',
  GRUPO = 'grupo',
}

export enum DestinoGanancia {
  CUENTAS_PERSONALES = 'cuentas_personales',
  CAJA_GRUPO = 'caja_grupo',
}
```

---

## Interfaces de Entidades

### BaseEntity

Todas las entidades heredan de esta base:

```typescript
interface BaseEntity {
  id: string;           // UUID auto-generado
  createdAt: Date;      // Timestamp de creación
  updatedAt: Date;      // Timestamp de actualización
  deletedAt: Date | null; // Soft delete (null si no está eliminado)
}
```

### Persona (Abstract)

```typescript
interface Persona extends BaseEntity {
  nombre: string;
  estado: EstadoPersona;
  tipo: PersonaType;    // Discriminador para el tipo
}
```

### Protagonista

```typescript
interface Protagonista extends Persona {
  tipo: PersonaType.PROTAGONISTA;
  rama: Rama;           // Obligatorio
}
```

### Educador

```typescript
interface Educador extends Persona {
  tipo: PersonaType.EDUCADOR;
  rama: Rama | null;    // Opcional
  cargo: CargoEducador; // Obligatorio
}
```

### PersonaExterna

```typescript
interface PersonaExterna extends Persona {
  tipo: PersonaType.EXTERNA;
  contacto: string | null;
  notas: string | null;
}
```

### Caja

```typescript
interface Caja extends BaseEntity {
  tipo: CajaType;
  nombre: string | null;
  propietarioId: string | null;  // Solo para tipo PERSONAL
  propietario?: Persona | null;  // Relación (solo en respuestas con include)
}
```

### Movimiento

```typescript
interface Movimiento extends BaseEntity {
  cajaId: string;
  tipo: TipoMovimiento;
  monto: number;                    // Decimal, siempre positivo
  concepto: ConceptoMovimiento;
  descripcion: string | null;
  responsableId: string;
  medioPago: MedioPago;
  requiereComprobante: boolean;
  comprobanteEntregado: boolean | null;
  estadoPago: EstadoPago;
  personaAReembolsarId: string | null;
  fecha: Date;
  eventoId: string | null;
  campamentoId: string | null;
  inscripcionId: string | null;
  cuotaId: string | null;

  // Relaciones (solo en respuestas con include)
  caja?: Caja;
  responsable?: Persona;
  personaAReembolsar?: Persona | null;
}
```

### Inscripcion

```typescript
interface Inscripcion extends BaseEntity {
  personaId: string;
  tipo: TipoInscripcion;
  ano: number;
  montoTotal: number;           // Decimal
  montoBonificado: number;      // Decimal, default 0
  declaracionDeSalud: boolean;  // Solo para SCOUT_ARGENTINA
  autorizacionDeImagen: boolean; // Solo para SCOUT_ARGENTINA
  salidasCercanas: boolean;      // Solo para SCOUT_ARGENTINA
  autorizacionIngreso: boolean;  // Solo para SCOUT_ARGENTINA

  // Relación
  persona?: Persona;

  // Calculado (no almacenado)
  estado?: EstadoInscripcion;   // Calculado desde movimientos
  montoPagado?: number;         // Calculado desde movimientos
}
```

### Cuota

```typescript
interface Cuota extends BaseEntity {
  personaId: string;
  nombre: string;
  ano: number;
  montoTotal: number;     // Decimal
  montoPagado: number;    // Decimal, default 0
  estado: EstadoCuota;

  // Relación
  persona?: Persona;
}
```

### Campamento

```typescript
interface Campamento extends BaseEntity {
  nombre: string;
  fechaInicio: Date;
  fechaFin: Date;
  costoPorPersona: number;  // Decimal
  cuotasBase: number;       // Default 1, informativo
  descripcion: string | null;

  // Relación ManyToMany
  participantes?: Persona[];
}
```

### Evento

```typescript
interface Evento extends BaseEntity {
  nombre: string;
  fecha: Date;
  descripcion: string | null;
  tipo: TipoEvento;
  destinoGanancia: DestinoGanancia | null;  // Solo para tipo VENTA
  tipoEvento: string | null;                 // Solo para tipo GRUPO

  // Relación OneToMany
  productos?: Producto[];
}
```

### Producto

```typescript
interface Producto extends BaseEntity {
  eventoId: string;
  nombre: string;
  precioCosto: number;    // Decimal
  precioVenta: number;    // Decimal

  // Relación
  evento?: Evento;
}
```

### VentaProducto

```typescript
interface VentaProducto extends BaseEntity {
  eventoId: string;
  productoId: string;
  vendedorId: string;
  cantidad: number;

  // Relaciones
  evento?: Evento;
  producto?: Producto;
  vendedor?: Persona;
}
```

---

## DTOs

### Personas

#### CreateProtagonistaDto

```typescript
interface CreateProtagonistaDto {
  nombre: string;    // Min: 2, Max: 100
  rama: Rama;        // Obligatorio
}
```

#### CreateEducadorDto

```typescript
interface CreateEducadorDto {
  nombre: string;          // Min: 2, Max: 100
  rama?: Rama;             // Opcional
  cargo: CargoEducador;    // Obligatorio
}
```

#### CreatePersonaExternaDto

```typescript
interface CreatePersonaExternaDto {
  nombre: string;       // Min: 2, Max: 100
  contacto?: string;    // Max: 100, opcional
  notas?: string;       // Opcional
}
```

#### UpdatePersonaDto

```typescript
interface UpdatePersonaDto {
  nombre?: string;           // Min: 2, Max: 100
  estado?: EstadoPersona;
  rama?: Rama;
  cargo?: CargoEducador;
  contacto?: string;         // Max: 100
  notas?: string;
}
```

### Cajas

#### CreateCajaDto

```typescript
interface CreateCajaDto {
  tipo: CajaType;
  nombre?: string;           // Max: 100
  propietarioId?: string;    // UUID, solo para tipo PERSONAL
}
```

### Movimientos

#### CreateMovimientoDto

```typescript
interface CreateMovimientoDto {
  cajaId: string;                        // UUID
  tipo: TipoMovimiento;
  monto: number;                         // Positivo, max 2 decimales
  concepto: ConceptoMovimiento;
  descripcion?: string;                  // Max: 500
  responsableId: string;                 // UUID
  medioPago: MedioPago;
  requiereComprobante?: boolean;
  comprobanteEntregado?: boolean;
  estadoPago: EstadoPago;
  personaAReembolsarId?: string;         // UUID
  fecha?: Date;                          // Default: now
  eventoId?: string;                     // UUID
  campamentoId?: string;                 // UUID
  inscripcionId?: string;                // UUID
  cuotaId?: string;                      // UUID
}
```

#### UpdateMovimientoDto

```typescript
interface UpdateMovimientoDto {
  monto?: number;                 // Positivo, max 2 decimales
  descripcion?: string;           // Max: 500
  medioPago?: MedioPago;
  requiereComprobante?: boolean;
  comprobanteEntregado?: boolean;
  estadoPago?: EstadoPago;
  personaAReembolsarId?: string;  // UUID
  fecha?: Date;
}
```

### Inscripciones

#### CreateInscripcionDto

```typescript
interface CreateInscripcionDto {
  personaId: string;              // UUID
  tipo: TipoInscripcion;
  ano: number;                    // Min: 2020, Max: 2100
  montoTotal: number;             // Positivo, max 2 decimales
  montoBonificado?: number;       // Min: 0, max 2 decimales
  // Solo requeridos para SCOUT_ARGENTINA:
  declaracionDeSalud?: boolean;
  autorizacionDeImagen?: boolean;
  salidasCercanas?: boolean;
  autorizacionIngreso?: boolean;
}
```

#### UpdateInscripcionDto

```typescript
interface UpdateInscripcionDto {
  montoBonificado?: number;       // Min: 0, max 2 decimales
  declaracionDeSalud?: boolean;
  autorizacionDeImagen?: boolean;
  salidasCercanas?: boolean;
  autorizacionIngreso?: boolean;
}
```

### Cuotas

#### CreateCuotaDto

```typescript
interface CreateCuotaDto {
  personaId: string;    // UUID
  nombre: string;       // Min: 2, Max: 100
  ano: number;          // Min: 2020, Max: 2100
  montoTotal: number;   // Positivo, max 2 decimales
}
```

### Campamentos

#### CreateCampamentoDto

```typescript
interface CreateCampamentoDto {
  nombre: string;           // Min: 2, Max: 100
  fechaInicio: Date;
  fechaFin: Date;
  costoPorPersona: number;  // Positivo, max 2 decimales
  cuotasBase?: number;      // Min: 1
  descripcion?: string;
}
```

#### UpdateCampamentoDto

```typescript
interface UpdateCampamentoDto {
  nombre?: string;           // Min: 2, Max: 100
  fechaInicio?: Date;
  fechaFin?: Date;
  costoPorPersona?: number;  // Positivo, max 2 decimales
  cuotasBase?: number;       // Min: 1
  descripcion?: string;
}
```

#### AddParticipanteDto

```typescript
interface AddParticipanteDto {
  personaId: string;   // UUID
}
```

### Eventos

#### CreateEventoDto

```typescript
interface CreateEventoDto {
  nombre: string;                    // Min: 2, Max: 100
  fecha: Date;
  descripcion?: string;
  tipo: TipoEvento;
  destinoGanancia?: DestinoGanancia; // Solo para tipo VENTA
  tipoEvento?: string;               // Max: 50, solo para tipo GRUPO
}
```

#### UpdateEventoDto

```typescript
interface UpdateEventoDto {
  nombre?: string;                   // Min: 2, Max: 100
  fecha?: Date;
  descripcion?: string;
  destinoGanancia?: DestinoGanancia;
  tipoEvento?: string;               // Max: 50
}
```

#### CreateProductoDto

```typescript
interface CreateProductoDto {
  eventoId: string;      // UUID
  nombre: string;        // Min: 2, Max: 100
  precioCosto: number;   // Positivo, max 2 decimales
  precioVenta: number;   // Positivo, max 2 decimales
}
```

#### CreateVentaProductoDto

```typescript
interface CreateVentaProductoDto {
  eventoId: string;      // UUID
  productoId: string;    // UUID
  vendedorId: string;    // UUID
  cantidad: number;      // Positivo
}
```

---

## Endpoints

### Personas

Base: `/personas`

| Método | Ruta | DTO Request | Response | Descripción |
|--------|------|-------------|----------|-------------|
| GET | `/personas` | - | `Persona[]` | Lista personas. Query: `tipo`, `soloActivos` |
| GET | `/personas/con-deudas` | - | `Persona[]` | Personas con deudas pendientes |
| GET | `/personas/:id` | - | `Persona` | Obtener persona por ID |
| POST | `/personas/protagonistas` | `CreateProtagonistaDto` | `Protagonista` | Crear protagonista |
| POST | `/personas/educadores` | `CreateEducadorDto` | `Educador` | Crear educador |
| POST | `/personas/externas` | `CreatePersonaExternaDto` | `PersonaExterna` | Crear persona externa |
| PATCH | `/personas/:id` | `UpdatePersonaDto` | `Persona` | Actualizar persona |
| POST | `/personas/:id/dar-de-baja` | - | `{ saldoTransferido: number }` | Dar de baja (transfiere saldo) |
| DELETE | `/personas/:id` | - | `Persona` | Eliminar (soft delete) |

#### Ejemplos

```typescript
// GET /personas?tipo=protagonista&soloActivos=true
// Response:
[
  {
    "id": "uuid",
    "nombre": "Juan Pérez",
    "tipo": "protagonista",
    "estado": "activo",
    "rama": "Unidad",
    "createdAt": "2026-01-01T00:00:00Z",
    "updatedAt": "2026-01-01T00:00:00Z",
    "deletedAt": null
  }
]

// POST /personas/protagonistas
// Body:
{
  "nombre": "María García",
  "rama": "Manada"
}
// Response: Protagonista creado

// POST /personas/educadores
// Body:
{
  "nombre": "Carlos López",
  "rama": "Unidad",
  "cargo": "Jefe de Rama"
}
// Response: Educador creado
```

---

### Cajas

Base: `/cajas`

| Método | Ruta | DTO Request | Response | Descripción |
|--------|------|-------------|----------|-------------|
| GET | `/cajas` | - | `Caja[]` | Lista cajas. Query: `tipo` |
| GET | `/cajas/grupo` | - | `Caja` | Obtener caja del grupo |
| GET | `/cajas/:id` | - | `Caja` | Obtener caja por ID |
| POST | `/cajas` | `CreateCajaDto` | `Caja` | Crear caja |
| DELETE | `/cajas/:id` | - | `Caja` | Eliminar (soft delete) |

#### Ejemplos

```typescript
// GET /cajas?tipo=personal
// Response:
[
  {
    "id": "uuid",
    "tipo": "personal",
    "nombre": "Cuenta Juan",
    "propietarioId": "persona-uuid",
    "createdAt": "2026-01-01T00:00:00Z",
    "updatedAt": "2026-01-01T00:00:00Z",
    "deletedAt": null
  }
]

// POST /cajas
// Body:
{
  "tipo": "personal",
  "nombre": "Cuenta María",
  "propietarioId": "persona-uuid"
}
```

---

### Movimientos

Base: `/movimientos`

| Método | Ruta | DTO Request | Response | Descripción |
|--------|------|-------------|----------|-------------|
| GET | `/movimientos` | - | `Movimiento[]` | Lista movimientos. Query: `cajaId`, `tipo`, `concepto`, `responsableId`, `estadoPago`, `fechaInicio`, `fechaFin` |
| GET | `/movimientos/reembolsos-pendientes` | - | `object[]` | Reembolsos pendientes agrupados por persona |
| GET | `/movimientos/caja/:cajaId` | - | `Movimiento[]` | Movimientos de una caja |
| GET | `/movimientos/responsable/:responsableId` | - | `Movimiento[]` | Movimientos de un responsable |
| GET | `/movimientos/evento/:eventoId` | - | `Movimiento[]` | Movimientos de un evento |
| GET | `/movimientos/campamento/:campamentoId` | - | `Movimiento[]` | Movimientos de un campamento |
| GET | `/movimientos/inscripcion/:inscripcionId` | - | `Movimiento[]` | Movimientos de una inscripción |
| GET | `/movimientos/cuota/:cuotaId` | - | `Movimiento[]` | Movimientos de una cuota |
| GET | `/movimientos/saldo/:cajaId` | - | `{ cajaId: string, saldo: number }` | Saldo calculado de una caja |
| GET | `/movimientos/:id` | - | `Movimiento` | Obtener movimiento por ID |
| POST | `/movimientos` | `CreateMovimientoDto` | `Movimiento` | Crear movimiento |
| POST | `/movimientos/gasto-general` | Ver abajo | `Movimiento` | Registrar gasto general |
| PATCH | `/movimientos/:id` | `UpdateMovimientoDto` | `Movimiento` | Actualizar movimiento |
| DELETE | `/movimientos/:id` | - | `Movimiento` | Eliminar (soft delete) |

#### Gasto General Body

```typescript
interface GastoGeneralBody {
  cajaId: string;
  monto: number;
  descripcion: string;
  responsableId: string;
  medioPago: MedioPago;
  estadoPago: EstadoPago;
  personaAReembolsarId?: string;
  requiereComprobante?: boolean;
}
```

#### Ejemplos

```typescript
// GET /movimientos?tipo=egreso&fechaInicio=2026-01-01&fechaFin=2026-12-31
// Response:
[
  {
    "id": "uuid",
    "cajaId": "caja-uuid",
    "tipo": "egreso",
    "monto": 1500.00,
    "concepto": "gasto_general",
    "descripcion": "Compra materiales",
    "responsableId": "persona-uuid",
    "medioPago": "efectivo",
    "estadoPago": "pagado",
    "fecha": "2026-03-01T00:00:00Z"
  }
]

// POST /movimientos
// Body:
{
  "cajaId": "caja-uuid",
  "tipo": "ingreso",
  "monto": 5000.00,
  "concepto": "cuota_grupo",
  "responsableId": "persona-uuid",
  "medioPago": "transferencia",
  "estadoPago": "pagado",
  "cuotaId": "cuota-uuid"
}
```

---

### Inscripciones

Base: `/inscripciones`

| Método | Ruta | DTO Request | Response | Descripción |
|--------|------|-------------|----------|-------------|
| GET | `/inscripciones` | - | `Inscripcion[]` | Lista inscripciones. Query: `ano`, `tipo` |
| GET | `/inscripciones/persona/:personaId` | - | `Inscripcion[]` | Inscripciones de una persona |
| GET | `/inscripciones/:id` | - | `Inscripcion` | Obtener inscripción con estado calculado |
| POST | `/inscripciones` | `CreateInscripcionDto` | `Inscripcion` | Crear inscripción |
| PATCH | `/inscripciones/:id` | `UpdateInscripcionDto` | `Inscripcion` | Actualizar inscripción |
| DELETE | `/inscripciones/:id` | - | `Inscripcion` | Eliminar (soft delete) |

#### Ejemplos

```typescript
// GET /inscripciones?ano=2026&tipo=scout_argentina
// Response:
[
  {
    "id": "uuid",
    "personaId": "persona-uuid",
    "tipo": "scout_argentina",
    "ano": 2026,
    "montoTotal": 15000.00,
    "montoBonificado": 0,
    "declaracionDeSalud": true,
    "autorizacionDeImagen": true,
    "salidasCercanas": true,
    "autorizacionIngreso": false,
    "estado": "pendiente",
    "montoPagado": 0
  }
]

// POST /inscripciones
// Body (SCOUT_ARGENTINA):
{
  "personaId": "persona-uuid",
  "tipo": "scout_argentina",
  "ano": 2026,
  "montoTotal": 15000.00,
  "declaracionDeSalud": true,
  "autorizacionDeImagen": true,
  "salidasCercanas": true,
  "autorizacionIngreso": false
}

// Body (GRUPO - campos de autorización opcionales):
{
  "personaId": "persona-uuid",
  "tipo": "grupo",
  "ano": 2026,
  "montoTotal": 5000.00
}
```

---

### Cuotas

Base: `/cuotas`

| Método | Ruta | DTO Request | Response | Descripción |
|--------|------|-------------|----------|-------------|
| GET | `/cuotas` | - | `Cuota[]` | Lista cuotas. Query: `ano` |
| GET | `/cuotas/persona/:personaId` | - | `Cuota[]` | Cuotas de una persona |
| GET | `/cuotas/:id` | - | `Cuota` | Obtener cuota por ID |
| POST | `/cuotas` | `CreateCuotaDto` | `Cuota` | Crear cuota |
| POST | `/cuotas/:id/pago` | Ver abajo | `object` | Registrar pago de cuota |
| DELETE | `/cuotas/:id` | - | `Cuota` | Eliminar (soft delete) |

#### Pago Cuota Body

```typescript
interface PagoCuotaBody {
  monto: number;
  medioPago: MedioPago;
  responsableId: string;
}
```

#### Ejemplos

```typescript
// POST /cuotas
// Body:
{
  "personaId": "persona-uuid",
  "nombre": "Cuota Marzo 2026",
  "ano": 2026,
  "montoTotal": 3000.00
}

// POST /cuotas/:id/pago
// Body:
{
  "monto": 1500.00,
  "medioPago": "efectivo",
  "responsableId": "persona-uuid"
}
```

---

### Campamentos

Base: `/campamentos`

| Método | Ruta | DTO Request | Response | Descripción |
|--------|------|-------------|----------|-------------|
| GET | `/campamentos` | - | `Campamento[]` | Lista campamentos |
| GET | `/campamentos/:id` | - | `Campamento` | Obtener campamento por ID |
| GET | `/campamentos/:id/resumen-financiero` | - | `object` | Resumen financiero del campamento |
| GET | `/campamentos/:id/pagos-por-participante` | - | `object[]` | Tracking de pagos por participante |
| POST | `/campamentos` | `CreateCampamentoDto` | `Campamento` | Crear campamento |
| PATCH | `/campamentos/:id` | `UpdateCampamentoDto` | `Campamento` | Actualizar campamento |
| POST | `/campamentos/:id/participantes` | `AddParticipanteDto` | `Campamento` | Agregar participante |
| DELETE | `/campamentos/:id/participantes/:personaId` | - | `Campamento` | Quitar participante |
| POST | `/campamentos/:id/pagos` | Ver abajo | `object` | Registrar pago de participante |
| POST | `/campamentos/:id/gastos` | Ver abajo | `object` | Registrar gasto del campamento |
| DELETE | `/campamentos/:id` | - | `Campamento` | Eliminar (soft delete) |

#### Pago Campamento Body

```typescript
interface PagoCampamentoBody {
  personaId: string;
  monto: number;
  medioPago: MedioPago;
}
```

#### Gasto Campamento Body

```typescript
interface GastoCampamentoBody {
  monto: number;
  descripcion: string;
  responsableId: string;
  medioPago: MedioPago;
  estadoPago: EstadoPago;
  personaAReembolsarId?: string;
}
```

#### Resumen Financiero Response

```typescript
interface ResumenFinancieroCampamento {
  campamentoId: string;
  totalEsperado: number;      // costoPorPersona * participantes
  totalRecaudado: number;     // Suma de pagos
  totalGastos: number;        // Suma de gastos
  balance: number;            // recaudado - gastos
  participantes: number;
}
```

#### Ejemplos

```typescript
// POST /campamentos
// Body:
{
  "nombre": "Campamento de Verano 2026",
  "fechaInicio": "2026-01-15",
  "fechaFin": "2026-01-20",
  "costoPorPersona": 25000.00,
  "cuotasBase": 3,
  "descripcion": "Campamento anual"
}

// POST /campamentos/:id/participantes
// Body:
{
  "personaId": "persona-uuid"
}

// POST /campamentos/:id/pagos
// Body:
{
  "personaId": "persona-uuid",
  "monto": 10000.00,
  "medioPago": "transferencia"
}
```

---

### Eventos

Base: `/eventos`

| Método | Ruta | DTO Request | Response | Descripción |
|--------|------|-------------|----------|-------------|
| GET | `/eventos` | - | `Evento[]` | Lista eventos |
| GET | `/eventos/:id` | - | `Evento` | Obtener evento por ID |
| POST | `/eventos` | `CreateEventoDto` | `Evento` | Crear evento |
| PATCH | `/eventos/:id` | `UpdateEventoDto` | `Evento` | Actualizar evento |
| DELETE | `/eventos/:id` | - | `Evento` | Eliminar (soft delete) |

#### Productos

| Método | Ruta | DTO Request | Response | Descripción |
|--------|------|-------------|----------|-------------|
| GET | `/eventos/:id/productos` | - | `Producto[]` | Lista productos del evento |
| POST | `/eventos/:id/productos` | `CreateProductoDto` | `Producto` | Crear producto |
| DELETE | `/eventos/productos/:productoId` | - | `Producto` | Eliminar producto |

#### Ventas

| Método | Ruta | DTO Request | Response | Descripción |
|--------|------|-------------|----------|-------------|
| GET | `/eventos/:id/ventas` | - | `VentaProducto[]` | Lista ventas del evento |
| POST | `/eventos/:id/ventas` | `CreateVentaProductoDto` | `VentaProducto` | Registrar venta |
| GET | `/eventos/:id/resumen-ventas` | - | `object` | Resumen de ventas |

#### Cierre e Ingresos/Gastos

| Método | Ruta | DTO Request | Response | Descripción |
|--------|------|-------------|----------|-------------|
| POST | `/eventos/:id/cerrar` | `{ medioPago: MedioPago }` | `object` | Cerrar evento y distribuir ganancias |
| POST | `/eventos/:id/ingresos` | Ver abajo | `object` | Registrar ingreso |
| POST | `/eventos/:id/gastos` | Ver abajo | `object` | Registrar gasto |

#### Ingreso Evento Body

```typescript
interface IngresoEventoBody {
  monto: number;
  descripcion: string;
  responsableId: string;
  medioPago: MedioPago;
}
```

#### Gasto Evento Body

```typescript
interface GastoEventoBody {
  monto: number;
  descripcion: string;
  responsableId: string;
  medioPago: MedioPago;
  estadoPago: EstadoPago;
  personaAReembolsarId?: string;
}
```

#### Resumen Ventas Response

```typescript
interface ResumenVentas {
  eventoId: string;
  totalVentas: number;
  totalCosto: number;
  gananciaTotal: number;
  ventasPorProducto: {
    productoId: string;
    nombre: string;
    cantidadVendida: number;
    ingresos: number;
    costo: number;
    ganancia: number;
  }[];
  ventasPorVendedor: {
    vendedorId: string;
    nombre: string;
    cantidadVendida: number;
    ganancia: number;
  }[];
}
```

#### Ejemplos

```typescript
// POST /eventos (Evento de venta)
// Body:
{
  "nombre": "Venta de Tortas",
  "fecha": "2026-04-15",
  "tipo": "venta",
  "destinoGanancia": "cuentas_personales",
  "descripcion": "Venta para recaudar fondos"
}

// POST /eventos (Evento de grupo)
// Body:
{
  "nombre": "Cena Aniversario",
  "fecha": "2026-05-20",
  "tipo": "grupo",
  "tipoEvento": "cena",
  "descripcion": "Cena por el aniversario del grupo"
}

// POST /eventos/:id/productos
// Body:
{
  "eventoId": "evento-uuid",
  "nombre": "Torta de Chocolate",
  "precioCosto": 500.00,
  "precioVenta": 800.00
}

// POST /eventos/:id/ventas
// Body:
{
  "eventoId": "evento-uuid",
  "productoId": "producto-uuid",
  "vendedorId": "persona-uuid",
  "cantidad": 5
}

// POST /eventos/:id/cerrar
// Body:
{
  "medioPago": "efectivo"
}
```

---

## Respuestas de Error

Todas las respuestas de error siguen este formato:

```typescript
interface ErrorResponse {
  statusCode: number;
  message: string | string[];
  error: string;
}
```

### Códigos Comunes

| Código | Descripción |
|--------|-------------|
| 400 | Bad Request - Datos inválidos |
| 404 | Not Found - Recurso no encontrado |
| 409 | Conflict - Conflicto (ej: inscripción duplicada) |
| 500 | Internal Server Error |

#### Ejemplos

```json
// 400 Bad Request (validación fallida)
{
  "statusCode": 400,
  "message": ["nombre must be longer than or equal to 2 characters"],
  "error": "Bad Request"
}

// 404 Not Found
{
  "statusCode": 404,
  "message": "Persona not found",
  "error": "Not Found"
}

// 409 Conflict
{
  "statusCode": 409,
  "message": "Ya existe una inscripción de este tipo para esta persona en el año 2026",
  "error": "Conflict"
}
```

---

## Notas Importantes

1. **Soft Delete**: Todas las entidades usan soft delete. Los registros no se eliminan físicamente, solo se marca `deletedAt`.

2. **Saldo Calculado**: El saldo de las cajas NUNCA se almacena. Siempre se calcula sumando ingresos y restando egresos.

3. **Estado de Inscripción**: El estado de las inscripciones se calcula dinámicamente basándose en los pagos registrados.

4. **Sin Autenticación**: Actualmente la API no tiene autenticación. Todos los endpoints son públicos.

5. **Fechas**: Todas las fechas se manejan en formato ISO 8601 con timezone (`timestamptz`).

6. **Decimales**: Los montos se almacenan con precisión de 2 decimales (10,2).

7. **UUIDs**: Todos los IDs son UUID v4 generados automáticamente.
