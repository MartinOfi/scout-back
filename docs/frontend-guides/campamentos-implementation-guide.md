# Campamentos — Frontend Implementation Guide

**Base URL:** `http://localhost:3001/api/v1`  
**Swagger UI:** `http://localhost:3001/api/docs`  
**Module:** `/campamentos`  
**Authentication:** None (open API — auth to be implemented)

---

## Endpoints Summary

| Method | Path | Description | Status Codes |
|--------|------|-------------|--------------|
| `GET` | `/campamentos` | Listar todos los campamentos | 200 |
| `GET` | `/campamentos/:id` | Obtener campamento por ID | 200, 404 |
| `GET` | `/campamentos/:id/detalle` | Vista completa: participantes + movimientos + KPIs | 200, 404 |
| `GET` | `/campamentos/:id/resumen-financiero` | Resumen financiero del campamento | 200 |
| `GET` | `/campamentos/:id/pagos-por-participante` | Seguimiento de pagos por participante | 200 |
| `POST` | `/campamentos` | Crear campamento | 201 |
| `PATCH` | `/campamentos/:id` | Actualizar campamento | 200, 404 |
| `DELETE` | `/campamentos/:id` | Eliminar campamento (soft delete) | 200, 404 |
| `POST` | `/campamentos/:id/participantes` | Agregar participante | 200, 400 |
| `DELETE` | `/campamentos/:id/participantes/:personaId` | Remover participante | 200 |
| `POST` | `/campamentos/:id/pagos/:personaId` | Registrar pago de participante | 200, 400, 404 |
| `DELETE` | `/campamentos/:id/pagos/:movimientoId` | Eliminar pago (con reversión de saldo) | 200, 404 |
| `POST` | `/campamentos/:id/gastos` | Registrar gasto del campamento | 200 |

---

## Enums

```typescript
enum FiltroMovimientosCampamento {
  TODOS = 'todos',       // Todos los movimientos (ingreso + egreso, incluye USO_SALDO_PERSONAL)
  INGRESOS = 'ingresos', // Solo pagos recibidos de participantes (INGRESO)
  EGRESOS = 'egresos',   // Todos los egresos (incluyendo USO_SALDO_PERSONAL)
  GASTOS = 'gastos',     // Solo compras/gastos reales (excluye USO_SALDO_PERSONAL)
}

enum EstadoPagoCampamento {
  PENDIENTE = 'pendiente', // No ha realizado ningún pago
  PARCIAL = 'parcial',     // Ha pagado algo, pero no el total
  PAGADO = 'pagado',       // Ha pagado el total del costoPorPersona
}

enum TipoMovimiento {
  INGRESO = 'ingreso',
  EGRESO = 'egreso',
}

// Importante: este campo permite distinguir el TIPO SEMÁNTICO de cada movimiento
enum ConceptoMovimiento {
  // Campamentos
  CAMPAMENTO_PAGO = 'campamento_pago',         // Ingreso: pago de participante
  CAMPAMENTO_GASTO = 'campamento_gasto',        // Egreso: gasto real (compras, traslado, etc.)
  USO_SALDO_PERSONAL = 'uso_saldo_personal',    // Egreso: descuento de cuenta personal (contabilidad interna)

  // Otros conceptos (referencia)
  INSCRIPCION_GRUPO = 'inscripcion_grupo',
  INSCRIPCION_SCOUT_ARGENTINA = 'inscripcion_scout_argentina',
  INSCRIPCION_PAGO_SCOUT_ARGENTINA = 'inscripcion_pago_scout_argentina',
  CUOTA_GRUPO = 'cuota_grupo',
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

enum MedioPago {
  EFECTIVO = 'efectivo',
  TRANSFERENCIA = 'transferencia',
  SALDO_PERSONAL = 'saldo_personal', // Pago 100% con cuenta personal
  MIXTO = 'mixto',                   // Combinación efectivo/transferencia + saldo personal
}

enum EstadoPago {
  PAGADO = 'pagado',
  PENDIENTE_REEMBOLSO = 'pendiente_reembolso', // El responsable pagó de su bolsillo, se le debe reembolsar
}

enum PersonaType {
  PROTAGONISTA = 'protagonista',
  EDUCADOR = 'educador',
  EXTERNA = 'externo',
}

enum Rama {
  MANADA = 'Manada',
  UNIDAD = 'Unidad',
  CAMINANTES = 'Caminantes',
  ROVERS = 'Rovers',
}
```

---

## Interfaces

### Entidad principal

```typescript
interface Campamento {
  id: string;               // UUID
  nombre: string;           // Ej: "Campamento de Verano 2026"
  fechaInicio: string;      // ISO date string "2026-01-15T00:00:00.000Z"
  fechaFin: string;         // ISO date string "2026-01-22T00:00:00.000Z"
  costoPorPersona: number;  // Costo individual en pesos
  cuotasBase: number;       // Cantidad de cuotas sugeridas (informativo)
  descripcion: string | null;
  createdAt: string;
  updatedAt: string;
}
```

### DTOs de request

```typescript
// POST /campamentos
interface CreateCampamento {
  nombre: string;           // 2–100 caracteres, requerido
  fechaInicio: string;      // ISO date, requerido ("2026-01-15")
  fechaFin: string;         // ISO date, requerido ("2026-01-22")
  costoPorPersona: number;  // > 0, máx 2 decimales, requerido
  cuotasBase?: number;      // >= 1, opcional (default: 1)
  descripcion?: string;     // opcional
}

// PATCH /campamentos/:id
interface UpdateCampamento {
  nombre?: string;          // 2–100 caracteres
  fechaInicio?: string;     // ISO date
  fechaFin?: string;        // ISO date
  costoPorPersona?: number; // > 0, máx 2 decimales
  cuotasBase?: number;      // >= 1
  descripcion?: string;
}

// POST /campamentos/:id/participantes
interface AddParticipante {
  personaId: string; // UUID de la persona a agregar
}

// POST /campamentos/:id/pagos/:personaId
interface PagarCampamento {
  montoPagado: number;            // >= 0. Monto en efectivo/transferencia
  montoConSaldoPersonal?: number; // >= 0, opcional. Monto desde cuenta personal
  medioPago?: MedioPago;          // Solo si montoPagado > 0
  descripcion?: string;           // opcional
}

// POST /campamentos/:id/gastos
interface RegistrarGasto {
  monto: number;               // requerido
  descripcion: string;         // requerido
  responsableId: string;       // UUID de quien pagó el gasto, requerido
  medioPago: 'efectivo' | 'transferencia'; // requerido
  estadoPago: EstadoPago;      // 'pagado' | 'pendiente_reembolso', requerido
  personaAReembolsarId?: string; // UUID — solo si estadoPago = 'pendiente_reembolso'
}
```

### DTOs de response

```typescript
// Respuesta de POST /campamentos/:id/pagos/:personaId
interface ResultadoPago {
  movimientoIngreso: {
    id: string;
    monto: number;
    concepto: ConceptoMovimiento; // siempre 'campamento_pago'
    medioPago: MedioPago;
  };
  movimientoEgresoPersonal?: {   // presente solo si se usó saldo personal
    id: string;
    monto: number;
  };
  desglose: {
    montoSaldoPersonal: number;  // monto descontado de cuenta personal
    montoFisico: number;         // monto en efectivo o transferencia
    total: number;               // montoSaldoPersonal + montoFisico
  };
}

// Respuesta de DELETE /campamentos/:id/pagos/:movimientoId
interface EliminarPagoResponse {
  movimientosEliminados: string[]; // IDs de movimientos eliminados (1 o 2 si había saldo personal)
  montoRevertido: number;          // Monto total revertido
}
```

### Respuesta de GET /:id/detalle (CampamentoDetalle)

```typescript
interface CampamentoDetalle {
  campamento: CampamentoInfo;
  participantes: ParticipantePago[];
  movimientos: MovimientoCampamento[]; // Filtrados según query param
  kpis: CampamentoKpis;               // Siempre sobre TODOS los movimientos
}

interface CampamentoInfo {
  id: string;
  nombre: string;
  fechaInicio: string;      // ISO date string
  fechaFin: string;         // ISO date string
  costoPorPersona: number;
  cuotasBase: number;
  descripcion: string | null;
}

interface ParticipantePago {
  id: string;
  nombre: string;
  tipo: PersonaType;
  rama: Rama | null;
  costoPorPersona: number;     // Costo individual del campamento
  totalPagado: number;         // Suma de todos sus pagos (INGRESO con CAMPAMENTO_PAGO)
  saldoPendiente: number;      // costoPorPersona - totalPagado
  estadoPago: EstadoPagoCampamento;
  pagos: PagoParticipante[];   // Historial de pagos individuales
}

interface PagoParticipante {
  movimientoId: string;
  fecha: string;         // ISO datetime string
  monto: number;
  medioPago: MedioPago;
}

interface MovimientoCampamento {
  id: string;
  fecha: string;                 // ISO datetime string
  tipo: TipoMovimiento;          // 'ingreso' | 'egreso'
  concepto: ConceptoMovimiento;  // Ver nota crítica abajo
  monto: number;
  descripcion: string | null;
  medioPago: MedioPago;
  estadoPago: EstadoPago;
  responsableId: string;
  responsableNombre: string;
}

interface CampamentoKpis {
  totalARecaudar: number;              // costoPorPersona × cantidad de participantes
  totalRecaudado: number;              // Suma de todos los CAMPAMENTO_PAGO (ingresos)
  totalGastado: number;                // Suma de todos los CAMPAMENTO_GASTO (solo gastos reales)
  balance: number;                     // totalRecaudado - totalGastado
  deudaTotal: number;                  // totalARecaudar - totalRecaudado
  cantidadParticipantes: number;
  participantesPagadosCompleto: number;
  participantesPagadosParcial: number;
  participantesPendientes: number;
}
```

---

## Endpoints en Detalle

### GET `/campamentos`

Lista todos los campamentos del sistema.

**Response 200:**
```json
[
  {
    "id": "uuid",
    "nombre": "Campamento de Verano 2026",
    "fechaInicio": "2026-01-15T00:00:00.000Z",
    "fechaFin": "2026-01-22T00:00:00.000Z",
    "costoPorPersona": 25000,
    "cuotasBase": 3,
    "descripcion": "Sierra de la Ventana",
    "createdAt": "...",
    "updatedAt": "..."
  }
]
```

---

### GET `/campamentos/:id`

**Response 200:** Objeto `Campamento` completo.  
**Response 404:** `{ "message": "Campamento no encontrado", "statusCode": 404 }`

---

### GET `/campamentos/:id/detalle`

Vista completa del campamento. Es el endpoint principal para la pantalla de gestión.

**Query params:**

| Param | Tipo | Requerido | Default | Descripción |
|-------|------|-----------|---------|-------------|
| `filtroMovimientos` | `FiltroMovimientosCampamento` | No | `todos` | Filtra la lista `movimientos` de la respuesta: `todos`, `ingresos`, `egresos`, `gastos` |

> **Importante:** Los `kpis` siempre se calculan sobre **todos** los movimientos, independientemente del filtro elegido. El filtro solo afecta la lista `movimientos` que se devuelve.

**Ejemplo de request:**
```
GET /campamentos/abc-123/detalle?filtroMovimientos=gastos
```

**Response 200:** `CampamentoDetalle`

---

### GET `/campamentos/:id/resumen-financiero`

Resumen financiero resumido del campamento (sin detalle de participantes individuales).

**Response 200:** Objeto con métricas financieras del campamento.

---

### GET `/campamentos/:id/pagos-por-participante`

Lista de cada participante con sus pagos individuales y estado de deuda.

**Response 200:**
```json
[
  {
    "participanteId": "uuid",
    "participanteNombre": "Juan Pérez",
    "costoPorPersona": 25000,
    "totalPagado": 15000,
    "saldoPendiente": 10000,
    "pagos": [
      {
        "fecha": "2026-01-10T10:30:00.000Z",
        "monto": 15000,
        "medioPago": "efectivo"
      }
    ]
  }
]
```

---

### POST `/campamentos`

Crea un nuevo campamento.

**Request body:**
```json
{
  "nombre": "Campamento de Verano 2026",
  "fechaInicio": "2026-01-15",
  "fechaFin": "2026-01-22",
  "costoPorPersona": 25000,
  "cuotasBase": 3,
  "descripcion": "Sierra de la Ventana"
}
```

**Response 201:** Objeto `Campamento` creado.

---

### PATCH `/campamentos/:id`

Actualiza campos del campamento. Todos los campos son opcionales.

**Response 200:** Objeto `Campamento` actualizado.  
**Response 404:** Campamento no encontrado.

---

### DELETE `/campamentos/:id`

Soft delete del campamento (no se elimina físicamente de la base de datos).

**Response 200:** Campamento eliminado.

---

### POST `/campamentos/:id/participantes`

Agrega una persona como participante del campamento.

**Request body:**
```json
{ "personaId": "uuid-de-la-persona" }
```

**Response 200:** Campamento actualizado con el participante incluido.  
**Response 400:** La persona ya es participante del campamento.

---

### DELETE `/campamentos/:id/participantes/:personaId`

Remueve a un participante del campamento.

**Response 200:** Campamento actualizado sin el participante.

---

### POST `/campamentos/:id/pagos/:personaId`

Registra un pago de un participante para el campamento. Soporta pagos mixtos (efectivo/transferencia + saldo personal).

**Lógica de pago:**
- `montoPagado`: dinero físico (efectivo o transferencia)
- `montoConSaldoPersonal`: descuento de la cuenta personal del participante
- El total descontado al saldo pendiente = `montoPagado + montoConSaldoPersonal`

**Escenarios comunes:**

| Escenario | montoPagado | montoConSaldoPersonal | medioPago |
|-----------|-------------|----------------------|-----------|
| Solo efectivo | 5000 | omitido | `efectivo` |
| Solo saldo personal | 0 | 5000 | omitido |
| Mixto | 3000 | 2000 | `efectivo` |

**Request body:**
```json
{
  "montoPagado": 5000,
  "montoConSaldoPersonal": 3000,
  "medioPago": "efectivo",
  "descripcion": "Primer cuota"
}
```

**Response 200:** `ResultadoPago`
```json
{
  "movimientoIngreso": {
    "id": "uuid",
    "monto": 8000,
    "concepto": "campamento_pago",
    "medioPago": "mixto"
  },
  "movimientoEgresoPersonal": {
    "id": "uuid",
    "monto": 3000
  },
  "desglose": {
    "montoSaldoPersonal": 3000,
    "montoFisico": 5000,
    "total": 8000
  }
}
```

**Response 400:** Datos inválidos o saldo personal insuficiente.  
**Response 404:** Campamento o persona no encontrada.

---

### DELETE `/campamentos/:id/pagos/:movimientoId`

Elimina un pago de campamento. Si el pago utilizó saldo personal, también revierte automáticamente el movimiento de egreso asociado a la cuenta personal.

> El `movimientoId` debe ser el ID del movimiento **INGRESO** (`campamento_pago`), no el egreso de saldo personal.

**Response 200:**
```json
{
  "movimientosEliminados": ["uuid-ingreso", "uuid-egreso-personal"],
  "montoRevertido": 8000
}
```

**Response 404:** Campamento o movimiento no encontrado.

---

### POST `/campamentos/:id/gastos`

Registra un gasto real del campamento (compras, traslado, alquiler de lugar, etc.).

**Request body:**
```json
{
  "monto": 5000,
  "descripcion": "Compra de alimentos para el campamento",
  "responsableId": "uuid-persona-que-pago",
  "medioPago": "efectivo",
  "estadoPago": "pendiente_reembolso",
  "personaAReembolsarId": "uuid-persona-a-reembolsar"
}
```

> Si `estadoPago` es `pendiente_reembolso`, incluir `personaAReembolsarId` para identificar a quién se le debe el reembolso.

**Response 200:** Movimiento de gasto creado.

---

## Manejo de Errores

### Códigos HTTP

| Código | Significado |
|--------|-------------|
| 200 | Operación exitosa |
| 201 | Recurso creado |
| 400 | Validación fallida o regla de negocio violada |
| 404 | Recurso no encontrado |

### Formato de error estándar (NestJS)

```json
{
  "statusCode": 404,
  "message": "Campamento no encontrado",
  "error": "Not Found"
}
```

### Errores de validación (400)

```json
{
  "statusCode": 400,
  "message": [
    "nombre must be longer than or equal to 2 characters",
    "costoPorPersona must be a positive number"
  ],
  "error": "Bad Request"
}
```

### Mensajes de error de negocio comunes

| Situación | Mensaje |
|-----------|---------|
| Participante ya inscrito | `"La persona ya es participante de este campamento"` |
| Saldo personal insuficiente | `"Saldo personal insuficiente"` |
| Campamento no encontrado | `"Campamento no encontrado"` |
| Persona no encontrada | `"Persona no encontrada"` |

---

## Nota Crítica: Movimientos y el campo `concepto`

Cuando un participante paga usando saldo personal, el sistema crea **dos movimientos** vinculados por el mismo `campamentoId`:

| tipo | concepto | Significado |
|------|----------|-------------|
| `ingreso` | `campamento_pago` | Pago recibido del participante |
| `egreso` | `uso_saldo_personal` | Descuento de la cuenta personal (contabilidad interna) |

**El campo `concepto` es la clave para distinguirlos en la UI:**

- `CAMPAMENTO_PAGO`: mostrar en lista de pagos recibidos
- `CAMPAMENTO_GASTO`: mostrar en lista de gastos del campamento  
- `USO_SALDO_PERSONAL`: movimiento interno — **no mostrar como gasto real en la UI**

**Usar el filtro `filtroMovimientos=gastos`** para obtener solo gastos reales (excluye automáticamente `USO_SALDO_PERSONAL`).

**KPI `totalGastado`** en la respuesta del endpoint `/detalle` ya excluye `USO_SALDO_PERSONAL` — solo refleja gastos reales del campamento.

---

## Recomendaciones de UI

### Colores sugeridos para `EstadoPagoCampamento`

| Estado | Color |
|--------|-------|
| `pendiente` | Rojo / error |
| `parcial` | Amarillo / warning |
| `pagado` | Verde / success |

### Colores sugeridos para `EstadoPago` (gastos)

| Estado | Color |
|--------|-------|
| `pagado` | Verde / success |
| `pendiente_reembolso` | Naranja / warning |

### Iconos sugeridos para `concepto` en lista de movimientos

| Concepto | Icono |
|----------|-------|
| `campamento_pago` | Dinero entrante / flecha arriba |
| `campamento_gasto` | Carrito / compra |
| `uso_saldo_personal` | Cuenta / billetera (si se muestra) |

---

## Flujos de uso típicos

### Flujo 1: Crear campamento y agregar participantes

```
1. POST /campamentos           → crear campamento
2. POST /campamentos/:id/participantes  → agregar persona 1
3. POST /campamentos/:id/participantes  → agregar persona 2
4. GET  /campamentos/:id/detalle        → ver estado actual
```

### Flujo 2: Registrar pago de participante

```
1. GET  /campamentos/:id/detalle                  → ver saldo pendiente
2. POST /campamentos/:id/pagos/:personaId          → registrar pago
3. GET  /campamentos/:id/detalle?filtroMovimientos=ingresos → confirmar
```

### Flujo 3: Registrar gasto del campamento

```
1. POST /campamentos/:id/gastos                   → registrar gasto
2. GET  /campamentos/:id/detalle?filtroMovimientos=gastos  → ver gastos reales
```

### Flujo 4: Ver estado financiero completo

```
GET /campamentos/:id/detalle
→ kpis.totalARecaudar    : cuánto se espera recaudar en total
→ kpis.totalRecaudado    : cuánto se recaudó hasta ahora
→ kpis.totalGastado      : cuánto se gastó (solo gastos reales)
→ kpis.balance           : totalRecaudado - totalGastado (fondos disponibles)
→ kpis.deudaTotal        : totalARecaudar - totalRecaudado (deuda pendiente)
```

### Flujo 5: Anular un pago

```
1. GET  /campamentos/:id/detalle?filtroMovimientos=ingresos
        → identificar movimientoId del pago a eliminar
2. DELETE /campamentos/:id/pagos/:movimientoId
        → el sistema revierte automáticamente el saldo personal si aplica
```
