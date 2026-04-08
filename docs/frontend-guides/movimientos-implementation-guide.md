# Movimientos — Frontend Implementation Guide

**Base URL:** `http://localhost:3001/api/v1`  
**Swagger:** `http://localhost:3001/api/docs`  
**Scope:** Creación, consulta y gestión de movimientos financieros  
**Autenticación:** Sin autenticación (a implementar en el futuro)

---

## Endpoints Summary

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/movimientos` | Listar movimientos con filtros y paginación |
| GET | `/movimientos/:id` | Obtener un movimiento por ID |
| GET | `/movimientos/reembolsos-pendientes` | Ver reembolsos agrupados por persona |
| GET | `/movimientos/caja/:cajaId` | Movimientos de una caja |
| GET | `/movimientos/saldo/:cajaId` | Saldo calculado de una caja |
| POST | `/movimientos` | Crear movimiento genérico |
| POST | `/movimientos/gasto-general` | Registrar gasto general (shortcut) |
| POST | `/campamentos/:id/gastos` | Registrar gasto de campamento |
| PATCH | `/movimientos/:id` | Actualizar movimiento |
| DELETE | `/movimientos/:id` | Eliminar movimiento (soft delete) |

---

## Enums

```typescript
type TipoMovimiento = 'ingreso' | 'egreso';

type ConceptoMovimiento =
  // Ingresos
  | 'inscripcion_grupo'
  | 'inscripcion_scout_argentina'
  | 'cuota_grupo'
  | 'campamento_pago'
  | 'evento_venta_ingreso'
  | 'evento_grupo_ingreso'
  // Egresos
  | 'inscripcion_pago_scout_argentina'
  | 'campamento_gasto'
  | 'evento_venta_gasto'
  | 'evento_grupo_gasto'
  | 'gasto_general'
  | 'reembolso'
  // Ajustes y transferencias internas
  | 'ajuste_inicial'
  | 'asignacion_fondo_rama'
  | 'transferencia_baja'
  | 'uso_saldo_personal';

type MedioPago =
  | 'efectivo'
  | 'transferencia'
  | 'saldo_personal'  // Solo interno (pagos mixtos)
  | 'mixto';          // Solo interno (pagos mixtos)

// CRÍTICO: controla si el egreso impacta o no el saldo de la caja
type EstadoPago =
  | 'pagado'              // El dinero ya salió de la caja
  | 'pendiente_reembolso'; // Alguien lo adelantó, la caja NO se descuenta

type CajaType =
  | 'grupo'
  | 'rama_manada'
  | 'rama_unidad'
  | 'rama_caminantes'
  | 'rama_rovers'
  | 'personal';
```

---

## Interfaces

### Movimiento (respuesta del servidor)

```typescript
interface Movimiento {
  id: string;
  cajaId: string;
  caja: {
    id: string;
    tipo: CajaType;
    nombre: string;
  };
  tipo: TipoMovimiento;
  monto: number;
  concepto: ConceptoMovimiento;
  descripcion: string | null;
  responsableId: string;
  responsable: {
    id: string;
    nombre: string;
  };
  medioPago: MedioPago;
  requiereComprobante: boolean;
  comprobanteEntregado: boolean | null;
  estadoPago: EstadoPago;
  // Solo presente si estadoPago = 'pendiente_reembolso'
  personaAReembolsarId: string | null;
  personaAReembolsar: { id: string; nombre: string } | null;
  fecha: string; // ISO 8601
  // Relaciones opcionales (según contexto del movimiento)
  eventoId: string | null;
  campamentoId: string | null;
  inscripcionId: string | null;
  cuotaId: string | null;
  movimientoRelacionadoId: string | null;
  registradoPorId: string | null;
  // Auditoría
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}
```

### Crear movimiento (request body)

```typescript
interface CreateMovimientoDto {
  cajaId: string;           // UUID de la caja destino
  tipo: TipoMovimiento;     // 'ingreso' | 'egreso'
  monto: number;            // Positivo, máx 2 decimales
  concepto: ConceptoMovimiento;
  descripcion?: string;     // Máx 500 caracteres
  responsableId: string;    // UUID de la persona responsable
  medioPago?: MedioPago;
  requiereComprobante?: boolean;  // Default: true
  comprobanteEntregado?: boolean;
  estadoPago: EstadoPago;   // Siempre requerido
  personaAReembolsarId?: string;  // UUID, requerido si estadoPago='pendiente_reembolso'
  fecha?: string;           // ISO 8601, default: fecha actual
  // Solo uno de estos según el contexto:
  eventoId?: string;
  campamentoId?: string;
  inscripcionId?: string;
  cuotaId?: string;
}
```

### Filtros (query params GET /movimientos)

```typescript
interface FilterMovimientosQuery {
  page?: number;        // Default: 1
  limit?: number;       // Default: 20
  cajaId?: string;      // UUID exacto
  tipoCaja?: string;    // Uno o varios separados por coma: 'rama_manada,rama_unidad'
  tipo?: TipoMovimiento;
  concepto?: ConceptoMovimiento;
  responsableId?: string;
  estadoPago?: EstadoPago;
  fechaInicio?: string; // ISO 8601: '2026-01-01'
  fechaFin?: string;    // ISO 8601: '2026-12-31'
}
```

### Respuesta paginada

```typescript
interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
}
```

### Reembolsos pendientes (GET /movimientos/reembolsos-pendientes)

```typescript
interface ReembolsoPendiente {
  personaId: string;
  personaNombre: string;
  totalPendiente: number;
  movimientos: Movimiento[];
}
// Respuesta: ReembolsoPendiente[]
```

### Saldo de caja (GET /movimientos/saldo/:cajaId)

```typescript
interface SaldoCajaResponse {
  cajaId: string;
  saldo: number; // Siempre refleja solo egresos con estadoPago='pagado'
}
```

---

## Endpoints Detail

### GET /movimientos

Listado general con filtros. Soporta combinación de filtros.

**Query params:** ver `FilterMovimientosQuery` arriba.

**Respuesta 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "tipo": "egreso",
      "monto": 5000,
      "concepto": "campamento_gasto",
      "estadoPago": "pendiente_reembolso",
      "personaAReembolsarId": "uuid-persona",
      "personaAReembolsar": { "id": "uuid-persona", "nombre": "María García" },
      "fecha": "2026-01-15T10:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "totalPages": 3,
    "hasPreviousPage": false,
    "hasNextPage": true
  }
}
```

**Ejemplos útiles de filtrado:**
```
GET /movimientos?estadoPago=pendiente_reembolso           → ver todos los pendientes
GET /movimientos?tipo=egreso&fechaInicio=2026-01-01       → egresos desde enero
GET /movimientos?tipoCaja=rama_manada,rama_unidad         → movimientos de ramas
```

---

### POST /movimientos

Crea cualquier tipo de movimiento. Ver los flujos de ejemplo abajo para los casos de uso concretos.

**Respuesta 201:** El objeto `Movimiento` creado.

**Respuesta 400:** Validación fallida.
```json
{ "message": ["cajaId must be a UUID", "monto must be a positive number"] }
```

**Respuesta 404:** Caja, responsable o personaAReembolsar no existen.
```json
{ "message": "Persona con ID ... no encontrada" }
```

---

### POST /movimientos/gasto-general

Shortcut para crear un egreso con `concepto=gasto_general`. Útil para gastos no vinculados a ninguna entidad.

**Body:**
```json
{
  "cajaId": "uuid-caja-grupo",
  "monto": 3500,
  "descripcion": "Compra de cuerdas para actividad",
  "responsableId": "uuid-persona",
  "medioPago": "efectivo",
  "estadoPago": "pagado",
  "personaAReembolsarId": null,
  "requiereComprobante": true
}
```

---

### POST /campamentos/:id/gastos

Registra un gasto asociado a un campamento. La caja siempre es la caja de grupo (el sistema la resuelve automáticamente).

**Body:**
```json
{
  "monto": 8000,
  "descripcion": "Alquiler del predio",
  "responsableId": "uuid-persona",
  "medioPago": "transferencia",
  "estadoPago": "pendiente_reembolso",
  "personaAReembolsarId": "uuid-persona-que-adelanto"
}
```

**Respuesta 200:** `void` (sin body).

---

### GET /movimientos/reembolsos-pendientes

Devuelve todos los egresos con `estadoPago=pendiente_reembolso`, agrupados por la persona a quien se le debe devolver la plata.

**Respuesta 200:**
```json
[
  {
    "personaId": "uuid-maria",
    "personaNombre": "María García",
    "totalPendiente": 13500,
    "movimientos": [
      {
        "id": "uuid-mov1",
        "monto": 8000,
        "concepto": "campamento_gasto",
        "descripcion": "Alquiler del predio - Campamento Verano",
        "fecha": "2026-01-15T10:00:00.000Z"
      },
      {
        "id": "uuid-mov2",
        "monto": 5500,
        "concepto": "gasto_general",
        "descripcion": "Compra de botiquín",
        "fecha": "2026-01-20T09:00:00.000Z"
      }
    ]
  }
]
```

---

### GET /movimientos/saldo/:cajaId

Devuelve el saldo real disponible de la caja. **Importante:** los egresos con `estadoPago=pendiente_reembolso` NO se descuentan del saldo — ese dinero sigue en la caja hasta que se emita el reembolso real.

**Respuesta 200:**
```json
{ "cajaId": "uuid-caja-grupo", "saldo": 45000 }
```

---

## Lógica de estadoPago — Concepto Clave

Este campo determina si el movimiento impacta o no el saldo de la caja:

```
estadoPago = 'pagado'
  → El dinero ya salió de la caja físicamente
  → RESTA del saldo de la caja
  → Quien pagó: la organización directamente

estadoPago = 'pendiente_reembolso'
  → Alguien pagó de su bolsillo (adelantó el gasto)
  → NO resta del saldo de la caja (la plata sigue ahí)
  → La organización le debe ese dinero a personaAReembolsar
  → Cuando se devuelve la plata → crear movimiento REEMBOLSO (egreso, estadoPago=pagado)
```

### Regla de negocio en el frontend

Cuando `estadoPago = 'pendiente_reembolso'`:
- El campo `personaAReembolsarId` **debe** estar presente
- El `medioPago` se refiere a cómo pagó esa persona (efectivo o transferencia)
- Mostrar siempre en la UI quién adelantó la plata

---

## Error Handling

| Código | Cuándo ocurre | Qué mostrar |
|--------|---------------|-------------|
| 400 | Validación de campos | Lista de errores del campo `message[]` |
| 404 | Caja, responsable o personaAReembolsar no existen | "No se encontró el recurso" + detalle del `message` |
| 409 | Email duplicado (en educadores) | "El email ya está registrado" |

---

## Flujos de Ejemplo

### Flujo 1 — Ingreso simple (cobro de cuota)

El caso más básico: alguien paga su cuota mensual en efectivo.

```typescript
// POST /movimientos
const body: CreateMovimientoDto = {
  cajaId: 'uuid-caja-grupo',
  tipo: 'ingreso',
  monto: 2000,
  concepto: 'cuota_grupo',
  descripcion: 'Cuota marzo 2026 — Juan Pérez',
  responsableId: 'uuid-juan',
  medioPago: 'efectivo',
  estadoPago: 'pagado',          // Ingresos siempre 'pagado'
};
```

**Resultado:** La caja grupo suma $2.000.

---

### Flujo 2 — Egreso pagado directamente por la organización

Un educador compra materiales y lo paga con la plata de la caja (por ejemplo, transfiriendo desde la cuenta del grupo).

```typescript
// POST /movimientos/gasto-general
const body = {
  cajaId: 'uuid-caja-grupo',
  monto: 4500,
  descripcion: 'Compra de pintura para actividad',
  responsableId: 'uuid-educador-carlos',
  medioPago: 'transferencia',
  estadoPago: 'pagado',          // Salió de la caja → resta saldo
  requiereComprobante: true,
};
```

**Resultado:** La caja grupo resta $4.500 inmediatamente.

---

### Flujo 3 — Egreso pendiente de reembolso (gasto general)

María pagó de su bolsillo $6.000 por materiales para el grupo. La organización todavía tiene la plata — se la tiene que devolver.

```typescript
// POST /movimientos/gasto-general
const body = {
  cajaId: 'uuid-caja-grupo',
  monto: 6000,
  descripcion: 'Compra de telas para disfraz de Navidad',
  responsableId: 'uuid-maria',          // Quién hizo el gasto
  medioPago: 'efectivo',                // Cómo pagó María
  estadoPago: 'pendiente_reembolso',    // NO resta del saldo todavía
  personaAReembolsarId: 'uuid-maria',  // A quién devolver la plata
  requiereComprobante: true,
};
```

**Resultado en la caja:** saldo **no cambia** (la plata sigue en caja).  
**Aparece en:** `GET /movimientos/reembolsos-pendientes` con totalPendiente acumulado.

---

### Flujo 4 — Egreso pendiente de reembolso de un campamento

Carlos adelantó $12.000 del alquiler del predio del campamento. La plata sigue en la caja del grupo.

```typescript
// POST /campamentos/:campamentoId/gastos
const body = {
  monto: 12000,
  descripcion: 'Alquiler del predio — Camping Los Pinos',
  responsableId: 'uuid-carlos',           // Quién hizo el gasto
  medioPago: 'transferencia',             // Cómo lo pagó Carlos
  estadoPago: 'pendiente_reembolso',
  personaAReembolsarId: 'uuid-carlos',   // A Carlos le deben devolver
};
```

**Resultado en la caja grupo:** saldo **no cambia**.  
**Resultado en KPIs del campamento:**
```json
{
  "totalGastadoEfectivo": 0,        // Nada salió de caja aún
  "totalPendienteReembolso": 12000, // Comprometido, pendiente de devolver
  "balance": 8000                    // totalRecaudado - totalGastadoEfectivo
}
```

---

### Flujo 5 — Consultar todos los reembolsos pendientes del grupo

Vista de "le debemos plata a estas personas":

```typescript
// GET /movimientos/reembolsos-pendientes
const reembolsos = await fetch('/api/v1/movimientos/reembolsos-pendientes');

// Respuesta
[
  {
    personaId: 'uuid-carlos',
    personaNombre: 'Carlos López',
    totalPendiente: 17500, // 12000 (predio) + 5500 (compra)
    movimientos: [ /* ... */ ]
  },
  {
    personaId: 'uuid-maria',
    personaNombre: 'María García',
    totalPendiente: 6000,
    movimientos: [ /* ... */ ]
  }
]
```

---

### Flujo 6 — Emitir el reembolso (cerrar el ciclo)

Cuando la organización le devuelve la plata a Carlos, se crea un nuevo movimiento de egreso `PAGADO`:

```typescript
// POST /movimientos
const body: CreateMovimientoDto = {
  cajaId: 'uuid-caja-grupo',
  tipo: 'egreso',
  monto: 12000,
  concepto: 'reembolso',
  descripcion: 'Reembolso predio campamento — Carlos López',
  responsableId: 'uuid-carlos',
  medioPago: 'transferencia',
  estadoPago: 'pagado',   // Ahora SÍ sale de la caja
};
```

**Resultado:** La caja grupo resta $12.000. Carlos ya no aparece en reembolsos pendientes (los movimientos anteriores siguen como `pendiente_reembolso`, pero el ciclo de deuda ya se cerró en la realidad con este nuevo registro).

> **Nota:** El sistema actualmente no marca automáticamente los movimientos `pendiente_reembolso` como "ya reembolsados" al crear el movimiento `reembolso`. Es responsabilidad del frontend mostrar el historial completo y del admin gestionar manualmente el seguimiento.

---

## Recomendaciones de UI

### Distinción visual por estadoPago

| estadoPago | Color sugerido | Ícono | Etiqueta |
|---|---|---|---|
| `pagado` (ingreso) | Verde | ↑ | Cobrado |
| `pagado` (egreso) | Rojo | ↓ | Pagado |
| `pendiente_reembolso` | Naranja/Amarillo | ⏳ | Pendiente reembolso |

### Formulario de creación de egreso

```
1. Mostrar selector "¿Quién pagó esto?"
   → estadoPago = 'pagado'      → La organización (no pedir personaAReembolsarId)
   → estadoPago = 'pendiente_reembolso' → Una persona (mostrar selector de persona)

2. Si estadoPago = 'pendiente_reembolso':
   → Mostrar campo "Persona a reembolsar" (selector de personas)
   → Agregar aviso: "Este gasto NO descontará del saldo de la caja hasta que se emita el reembolso"

3. medioPago: solo mostrar 'efectivo' y 'transferencia' en formularios manuales
   ('saldo_personal' y 'mixto' son internos y no deben aparecer en el selector)
```

### Widget de reembolsos pendientes

Útil en el dashboard o en la vista de cada persona:

```
┌─────────────────────────────────────┐
│ Reembolsos pendientes               │
├─────────────────────────────────────┤
│ Carlos López       $17.500   [Ver]  │
│ María García        $6.000   [Ver]  │
├─────────────────────────────────────┤
│ Total a devolver   $23.500          │
└─────────────────────────────────────┘
```

### KPIs de campamento

Mostrar siempre los tres valores juntos para que quede claro el estado real:

```
┌──────────────────────────────────────────────┐
│ Financiero del campamento                    │
├───────────────────────┬──────────────────────┤
│ Recaudado             │  $45.000             │
│ Gastado (efectivo)    │  $12.000  ← restó    │
│ Pendiente reembolso   │   $8.000  ← no restó │
│ Balance disponible    │  $33.000             │
└───────────────────────┴──────────────────────┘
```

---

## Conceptos por caso de uso

| Caso de uso | tipo | concepto | estadoPago |
|---|---|---|---|
| Cobro de cuota mensual | ingreso | `cuota_grupo` | pagado |
| Cobro inscripción grupo | ingreso | `inscripcion_grupo` | pagado |
| Pago de campamento | ingreso | `campamento_pago` | pagado |
| Gasto de campamento (caja pagó) | egreso | `campamento_gasto` | pagado |
| Gasto de campamento (persona adelantó) | egreso | `campamento_gasto` | pendiente_reembolso |
| Gasto general (caja pagó) | egreso | `gasto_general` | pagado |
| Gasto general (persona adelantó) | egreso | `gasto_general` | pendiente_reembolso |
| Devolución de plata a persona | egreso | `reembolso` | pagado |
| Carga de saldo inicial (migración) | ingreso | `ajuste_inicial` | pagado |
