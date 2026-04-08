# Eventos — Frontend Implementation Guide

**Base URL:** `http://localhost:3001/api/v1`  
**Swagger UI:** `http://localhost:3001/api/docs`  
**Module:** `/eventos`  
**Authentication:** None (open API — auth to be implemented)

---

## Endpoints Summary

| Method | Path | Description | Status Codes |
|--------|------|-------------|--------------|
| `GET` | `/eventos` | Listar todos los eventos | 200 |
| `GET` | `/eventos/:id` | Obtener evento por ID | 200, 404 |
| `POST` | `/eventos` | Crear evento | 201 |
| `PATCH` | `/eventos/:id` | Actualizar evento | 200, 404 |
| `DELETE` | `/eventos/:id` | Eliminar evento (soft delete) | 200, 400, 404 |
| `GET` | `/eventos/:id/productos` | Listar productos del evento | 200 |
| `POST` | `/eventos/:id/productos` | Crear producto | 201 |
| `DELETE` | `/eventos/productos/:productoId` | Eliminar producto | 200, 400, 404 |
| `GET` | `/eventos/:id/ventas` | Listar ventas del evento | 200 |
| `POST` | `/eventos/:id/ventas` | Registrar una venta | 201, 400, 404 |
| `POST` | `/eventos/:id/ventas/lote` | Registrar ventas de múltiples productos | 201, 400, 404 |
| `GET` | `/eventos/:id/kpis` | KPIs financieros del evento | 200, 404 |
| `GET` | `/eventos/:id/resumen-ventas` | Resumen de ventas por producto y vendedor | 200, 404 |
| `POST` | `/eventos/:id/cerrar` | Cerrar evento de venta y distribuir ganancias | 200, 400, 404 |
| `POST` | `/eventos/:id/ingresos` | Registrar ingreso de evento de grupo | 200, 400, 404 |
| `POST` | `/eventos/:id/gastos` | Registrar gasto del evento | 200, 404 |

---

## Enums

```typescript
enum TipoEvento {
  VENTA = 'venta',   // Evento de venta con productos (empanadas, rifas, etc.)
  GRUPO = 'grupo',   // Evento de grupo sin productos (cena, kermesse, etc.)
}

enum DestinoGanancia {
  CUENTAS_PERSONALES = 'cuentas_personales', // Ganancia distribuida a cada vendedor
  CAJA_GRUPO = 'caja_grupo',                 // Ganancia va íntegra a la caja del grupo
}

enum MedioPago {
  EFECTIVO = 'efectivo',
  TRANSFERENCIA = 'transferencia',
  SALDO_PERSONAL = 'saldo_personal',
  MIXTO = 'mixto',
}

enum EstadoPago {
  PAGADO = 'pagado',
  PENDIENTE_REEMBOLSO = 'pendiente_reembolso', // Alguien adelantó plata y hay que reembolsarle
}
```

---

## Interfaces

```typescript
// src/app/core/interfaces/eventos.interface.ts

// ─── Enums ───────────────────────────────────────────────────────────────────

export enum TipoEvento {
  VENTA = 'venta',
  GRUPO = 'grupo',
}

export enum DestinoGanancia {
  CUENTAS_PERSONALES = 'cuentas_personales',
  CAJA_GRUPO = 'caja_grupo',
}

export enum MedioPago {
  EFECTIVO = 'efectivo',
  TRANSFERENCIA = 'transferencia',
  SALDO_PERSONAL = 'saldo_personal',
  MIXTO = 'mixto',
}

export enum EstadoPago {
  PAGADO = 'pagado',
  PENDIENTE_REEMBOLSO = 'pendiente_reembolso',
}

// ─── Entidades ────────────────────────────────────────────────────────────────

export interface Evento {
  id: string;
  nombre: string;
  fecha: string;                           // ISO 8601 date (YYYY-MM-DD)
  descripcion: string | null;
  tipo: TipoEvento;
  destinoGanancia: DestinoGanancia | null; // Solo para TipoEvento.VENTA
  tipoEvento: string | null;               // Solo para TipoEvento.GRUPO (ej: "Kermesse")
  productos: Producto[];                   // Incluido cuando se carga con relaciones
  createdAt: string;                       // ISO 8601 datetime
  updatedAt: string;
}

export interface Producto {
  id: string;
  eventoId: string;
  nombre: string;
  precioCosto: number;
  precioVenta: number;
  createdAt: string;
  updatedAt: string;
}

export interface VentaProducto {
  id: string;
  eventoId: string;
  productoId: string;
  vendedorId: string;
  cantidad: number;
  producto?: Producto;   // Incluido con relaciones (GET /ventas)
  vendedor?: {           // Incluido con relaciones (GET /ventas)
    id: string;
    nombre: string;
  };
  createdAt: string;
  updatedAt: string;
}

// ─── DTOs de request ─────────────────────────────────────────────────────────

export interface CreateEventoDto {
  nombre: string;                  // 2–100 caracteres
  fecha: string;                   // ISO 8601 date (YYYY-MM-DD)
  descripcion?: string;
  tipo: TipoEvento;
  destinoGanancia?: DestinoGanancia; // Requerido si tipo === VENTA
  tipoEvento?: string;               // Max 50 caracteres. Solo para tipo === GRUPO
}

export interface UpdateEventoDto {
  nombre?: string;
  fecha?: string;
  descripcion?: string;
  tipo?: TipoEvento;
  destinoGanancia?: DestinoGanancia;
  tipoEvento?: string;
}

export interface CreateProductoDto {
  nombre: string;        // 2–100 caracteres
  precioCosto: number;   // Positivo, max 2 decimales
  precioVenta: number;   // Positivo, max 2 decimales
  // Nota: eventoId es tomado del parámetro :id de la URL, no del body
}

export interface CreateVentaProductoDto {
  productoId: string;  // UUID — debe pertenecer al evento
  vendedorId: string;  // UUID — debe existir en personas
  cantidad: number;    // Entero positivo
  // Nota: eventoId es tomado del parámetro :id de la URL, no del body
}

export interface RegisterVentasLoteDto {
  vendedorId: string;  // UUID — un solo vendedor para todo el lote
  items: VentaItemDto[];
}

export interface VentaItemDto {
  productoId: string; // UUID — debe pertenecer al evento
  cantidad: number;   // Entero positivo
}

export interface CerrarEventoVentaDto {
  medioPago: MedioPago;
}

export interface RegistrarIngresoEventoDto {
  monto: number;         // ≥ 0
  descripcion: string;
  responsableId: string; // UUID
  medioPago: MedioPago;
}

export interface RegistrarGastoEventoDto {
  monto: number;                  // ≥ 0
  descripcion: string;
  responsableId: string;          // UUID
  medioPago: MedioPago;
  estadoPago: EstadoPago;
  personaAReembolsarId?: string;  // UUID — requerido si estadoPago === PENDIENTE_REEMBOLSO
}

// ─── Respuestas especiales ────────────────────────────────────────────────────

export interface EventoKpis {
  totalIngresos: number;
  totalGastado: number;               // Solo gastos con estadoPago === PAGADO
  totalPendienteReembolso: number;    // Gastos con estadoPago === PENDIENTE_REEMBOLSO
  balance: number;                    // totalIngresos - totalGastado
}

export interface ResumenVentas {
  productos: ResumenProducto[];
  ventasPorVendedor: ResumenVendedor[];
  gananciaTotal: number;
}

export interface ResumenProducto {
  nombre: string;
  precioCosto: number;
  precioVenta: number;
  cantidadVendida: number;
  ganancia: number;  // (precioVenta - precioCosto) × cantidadVendida
}

export interface ResumenVendedor {
  vendedorId: string;
  vendedorNombre: string;
  cantidadTotal: number;
  gananciaTotal: number;
}
```

---

## Endpoints Detail

### 1. `GET /eventos` — Listar todos los eventos

**Descripción:** Retorna todos los eventos ordenados por fecha descendente, con sus productos incluidos.

**Auth:** ❌ No requerido

#### Request

```http
GET /api/v1/eventos
```

#### Response 200 OK

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "nombre": "Venta de empanadas",
    "fecha": "2025-06-15",
    "descripcion": "Venta para recaudar fondos para el campamento",
    "tipo": "venta",
    "destinoGanancia": "cuentas_personales",
    "tipoEvento": null,
    "productos": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "eventoId": "550e8400-e29b-41d4-a716-446655440000",
        "nombre": "Empanada de carne",
        "precioCosto": 150.00,
        "precioVenta": 300.00,
        "createdAt": "2025-06-01T10:00:00.000Z",
        "updatedAt": "2025-06-01T10:00:00.000Z"
      }
    ],
    "createdAt": "2025-06-01T10:00:00.000Z",
    "updatedAt": "2025-06-01T10:00:00.000Z"
  }
]
```

#### Response Type

```typescript
Evento[]
```

---

### 2. `GET /eventos/:id` — Obtener evento por ID

**Descripción:** Retorna un evento con sus productos incluidos.

**Auth:** ❌ No requerido

#### Path Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Sí | ID del evento |

#### Request

```http
GET /api/v1/eventos/550e8400-e29b-41d4-a716-446655440000
```

#### Response 200 OK

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "nombre": "Venta de empanadas",
  "fecha": "2025-06-15",
  "descripcion": null,
  "tipo": "venta",
  "destinoGanancia": "caja_grupo",
  "tipoEvento": null,
  "productos": [],
  "createdAt": "2025-06-01T10:00:00.000Z",
  "updatedAt": "2025-06-01T10:00:00.000Z"
}
```

#### Response 404 Not Found

```json
{
  "statusCode": 404,
  "message": "Evento con ID 550e8400-e29b-41d4-a716-446655440000 no encontrado",
  "error": "Not Found"
}
```

#### Response Type

```typescript
Evento
```

---

### 3. `POST /eventos` — Crear evento

**Auth:** ❌ No requerido (auth pendiente de implementar)

#### Request

```http
POST /api/v1/eventos
Content-Type: application/json
```

#### Body

```json
{
  "nombre": "Venta de empanadas",
  "fecha": "2025-06-15",
  "descripcion": "Venta para recaudar fondos para el campamento",
  "tipo": "venta",
  "destinoGanancia": "cuentas_personales"
}
```

#### Body Schema

| Campo | Tipo | Requerido | Validación |
|-------|------|-----------|------------|
| `nombre` | string | Sí | 2–100 caracteres |
| `fecha` | string | Sí | Formato `YYYY-MM-DD` |
| `descripcion` | string | No | — |
| `tipo` | `TipoEvento` | Sí | `venta` \| `grupo` |
| `destinoGanancia` | `DestinoGanancia` | No | Requerido si `tipo === 'venta'`. `cuentas_personales` \| `caja_grupo` |
| `tipoEvento` | string | No | Max 50 caracteres. Solo para `tipo === 'grupo'` |

#### Response 201 Created

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "nombre": "Venta de empanadas",
  "fecha": "2025-06-15",
  "descripcion": "Venta para recaudar fondos para el campamento",
  "tipo": "venta",
  "destinoGanancia": "cuentas_personales",
  "tipoEvento": null,
  "createdAt": "2025-06-01T10:00:00.000Z",
  "updatedAt": "2025-06-01T10:00:00.000Z"
}
```

#### Response 400 Bad Request

```json
{
  "statusCode": 400,
  "message": [
    "nombre must be longer than or equal to 2 characters",
    "tipo must be one of the following values: venta, grupo"
  ],
  "error": "Bad Request"
}
```

---

### 4. `PATCH /eventos/:id` — Actualizar evento

**Auth:** ❌ No requerido (auth pendiente de implementar)

#### Body (todos los campos opcionales)

```json
{
  "nombre": "Nuevo nombre",
  "fecha": "2025-07-20"
}
```

#### Response 200 OK

Retorna el evento completo actualizado (`Evento`).

#### Response 404 Not Found

```json
{
  "statusCode": 404,
  "message": "Evento con ID <id> no encontrado",
  "error": "Not Found"
}
```

---

### 5. `DELETE /eventos/:id` — Eliminar evento

**Auth:** ❌ No requerido (auth pendiente de implementar)

**Importante:** Solo se puede eliminar si el evento **no tiene movimientos asociados**. Si tiene movimientos (cierre realizado o ingresos/gastos registrados), el endpoint retorna 400.

La eliminación es un soft delete en cascada: elimina también todos los productos y ventas del evento.

#### Response 200 OK

Sin cuerpo de respuesta.

#### Response 400 Bad Request

```json
{
  "statusCode": 400,
  "message": "No se puede eliminar el evento: tiene movimientos asociados",
  "error": "Bad Request"
}
```

#### Response 404 Not Found

```json
{
  "statusCode": 404,
  "message": "Evento con ID <id> no encontrado",
  "error": "Not Found"
}
```

---

### 6. `GET /eventos/:id/productos` — Listar productos del evento

**Descripción:** Retorna los productos del evento ordenados por nombre.

**Auth:** ❌ No requerido

#### Response 200 OK

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "eventoId": "550e8400-e29b-41d4-a716-446655440000",
    "nombre": "Empanada de carne",
    "precioCosto": 150.00,
    "precioVenta": 300.00,
    "createdAt": "2025-06-01T10:00:00.000Z",
    "updatedAt": "2025-06-01T10:00:00.000Z"
  }
]
```

#### Response Type

```typescript
Producto[]
```

---

### 7. `POST /eventos/:id/productos` — Crear producto

**Descripción:** Agrega un producto al evento. El `eventoId` se toma del parámetro de la URL, **no se envía en el body**.

**Auth:** ❌ No requerido

#### Body

```json
{
  "nombre": "Empanada de carne",
  "precioCosto": 150.00,
  "precioVenta": 300.00
}
```

#### Body Schema

| Campo | Tipo | Requerido | Validación |
|-------|------|-----------|------------|
| `nombre` | string | Sí | 2–100 caracteres |
| `precioCosto` | number | Sí | Positivo, max 2 decimales |
| `precioVenta` | number | Sí | Positivo, max 2 decimales |

#### Response 201 Created

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "eventoId": "550e8400-e29b-41d4-a716-446655440000",
  "nombre": "Empanada de carne",
  "precioCosto": 150.00,
  "precioVenta": 300.00,
  "createdAt": "2025-06-01T10:00:00.000Z",
  "updatedAt": "2025-06-01T10:00:00.000Z"
}
```

#### Response 404 Not Found

```json
{
  "statusCode": 404,
  "message": "Evento con ID <id> no encontrado",
  "error": "Not Found"
}
```

---

### 8. `DELETE /eventos/productos/:productoId` — Eliminar producto

**Importante:** El path es `/eventos/productos/:productoId` (sin `/:id/` del evento). Solo se puede eliminar si el evento **no tiene movimientos**.

#### Response 200 OK

Sin cuerpo de respuesta.

#### Response 400 Bad Request

```json
{
  "statusCode": 400,
  "message": "No se puede eliminar: el evento tiene movimientos asociados",
  "error": "Bad Request"
}
```

---

### 9. `GET /eventos/:id/ventas` — Listar ventas del evento

**Descripción:** Retorna todas las ventas con las relaciones `producto` y `vendedor` cargadas. Ordenadas por fecha descendente.

**Auth:** ❌ No requerido

#### Response 200 OK

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440010",
    "eventoId": "550e8400-e29b-41d4-a716-446655440000",
    "productoId": "550e8400-e29b-41d4-a716-446655440001",
    "vendedorId": "550e8400-e29b-41d4-a716-446655440002",
    "cantidad": 5,
    "producto": {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "nombre": "Empanada de carne",
      "precioCosto": 150.00,
      "precioVenta": 300.00
    },
    "vendedor": {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "nombre": "Juan Pérez"
    },
    "createdAt": "2025-06-15T14:00:00.000Z",
    "updatedAt": "2025-06-15T14:00:00.000Z"
  }
]
```

#### Response Type

```typescript
VentaProducto[]
```

---

### 10. `POST /eventos/:id/ventas` — Registrar una venta

**Descripción:** Registra la venta de un producto por un vendedor. El `eventoId` se toma de la URL.

**Validaciones del backend:**
- El `productoId` debe existir y pertenecer al evento
- El `vendedorId` debe existir como persona

#### Body

```json
{
  "productoId": "550e8400-e29b-41d4-a716-446655440001",
  "vendedorId": "550e8400-e29b-41d4-a716-446655440002",
  "cantidad": 5
}
```

#### Body Schema

| Campo | Tipo | Requerido | Validación |
|-------|------|-----------|------------|
| `productoId` | UUID | Sí | Debe pertenecer al evento |
| `vendedorId` | UUID | Sí | Debe existir en personas |
| `cantidad` | number | Sí | Entero positivo |

#### Response 201 Created

Retorna la `VentaProducto` creada.

#### Response 400 Bad Request

```json
{
  "statusCode": 400,
  "message": "El producto no pertenece a este evento",
  "error": "Bad Request"
}
```

---

### 11. `POST /eventos/:id/ventas/lote` — Registrar ventas en lote

**Descripción:** Permite registrar en una sola request la venta de varios productos por parte de un **mismo vendedor**. Ideal para el flujo de rendición donde cada participante informa cuánto vendió de cada producto.

**Importante:** Enviar a `/eventos/:id/ventas/lote` **antes** que a `/eventos/:id/ventas` si hay rutas similares — el router interpreta `lote` como `:id` si el orden no es correcto.

#### Body

```json
{
  "vendedorId": "550e8400-e29b-41d4-a716-446655440002",
  "items": [
    { "productoId": "550e8400-e29b-41d4-a716-446655440001", "cantidad": 5 },
    { "productoId": "550e8400-e29b-41d4-a716-446655440003", "cantidad": 3 }
  ]
}
```

#### Body Schema

| Campo | Tipo | Requerido | Validación |
|-------|------|-----------|------------|
| `vendedorId` | UUID | Sí | Debe existir como persona |
| `items` | `VentaItemDto[]` | Sí | Mínimo 1 item |
| `items[].productoId` | UUID | Sí | Debe pertenecer al evento |
| `items[].cantidad` | number | Sí | Entero positivo |

#### Response 201 Created

```typescript
VentaProducto[]  // Array con todas las ventas creadas
```

---

### 12. `GET /eventos/:id/kpis` — KPIs financieros del evento

**Descripción:** Retorna totales financieros calculados desde los movimientos asociados al evento.

**Conceptos:**
- `totalIngresos`: suma de todos los movimientos de tipo `ingreso`
- `totalGastado`: suma de egresos con `estadoPago === 'pagado'` (plata ya salió)
- `totalPendienteReembolso`: suma de egresos con `estadoPago === 'pendiente_reembolso'` (alguien adelantó y espera reembolso)
- `balance`: `totalIngresos - totalGastado` (no descuenta pendientes)

#### Response 200 OK

```json
{
  "totalIngresos": 45000.00,
  "totalGastado": 12000.00,
  "totalPendienteReembolso": 3000.00,
  "balance": 33000.00
}
```

#### Response Type

```typescript
EventoKpis
```

---

### 13. `GET /eventos/:id/resumen-ventas` — Resumen de ventas

**Descripción:** Retorna el detalle de ventas agrupado por producto y por vendedor. Solo disponible para eventos de tipo `VENTA`.

#### Response 200 OK

```json
{
  "productos": [
    {
      "nombre": "Empanada de carne",
      "precioCosto": 150.00,
      "precioVenta": 300.00,
      "cantidadVendida": 20,
      "ganancia": 3000.00
    }
  ],
  "ventasPorVendedor": [
    {
      "vendedorId": "550e8400-e29b-41d4-a716-446655440002",
      "vendedorNombre": "Juan Pérez",
      "cantidadTotal": 12,
      "gananciaTotal": 1800.00
    }
  ],
  "gananciaTotal": 3000.00
}
```

#### Response Type

```typescript
ResumenVentas
```

---

### 14. `POST /eventos/:id/cerrar` — Cerrar evento de venta

**Descripción:** Cierra un evento de tipo `VENTA` y genera los movimientos financieros de distribución de ganancias.

**Comportamiento según `destinoGanancia`:**
- `caja_grupo`: Se crea **un único** movimiento de ingreso en la caja del grupo con la ganancia total
- `cuentas_personales`: Se crea **un movimiento por cada vendedor** en su cuenta personal con su ganancia proporcional

**Importante:** Solo funciona con eventos `tipo === 'venta'`. Llamarlo en un evento de grupo retorna 400.

#### Body

```json
{
  "medioPago": "efectivo"
}
```

| Campo | Tipo | Requerido | Validación |
|-------|------|-----------|------------|
| `medioPago` | `MedioPago` | Sí | `efectivo` \| `transferencia` \| `saldo_personal` \| `mixto` |

#### Response 200 OK

Sin cuerpo de respuesta.

#### Response 400 Bad Request

```json
{
  "statusCode": 400,
  "message": "Solo se pueden cerrar eventos de venta",
  "error": "Bad Request"
}
```

---

### 15. `POST /eventos/:id/ingresos` — Registrar ingreso de evento de grupo

**Descripción:** Registra un ingreso en la caja del grupo asociado a un evento de tipo `GRUPO` (cena, kermesse, etc.). Para eventos de tipo `VENTA` se usa el endpoint `/cerrar`.

**Importante:** Solo funciona con eventos `tipo === 'grupo'`. Llamarlo en un evento de venta retorna 400.

#### Body

```json
{
  "monto": 10000.00,
  "descripcion": "Venta de entradas",
  "responsableId": "550e8400-e29b-41d4-a716-446655440002",
  "medioPago": "efectivo"
}
```

#### Body Schema

| Campo | Tipo | Requerido | Validación |
|-------|------|-----------|------------|
| `monto` | number | Sí | ≥ 0 |
| `descripcion` | string | Sí | — |
| `responsableId` | UUID | Sí | Debe existir como persona |
| `medioPago` | `MedioPago` | Sí | Valor válido del enum |

#### Response 200 OK

Sin cuerpo de respuesta.

#### Response 400 Bad Request

```json
{
  "statusCode": 400,
  "message": "Este endpoint es solo para eventos de grupo",
  "error": "Bad Request"
}
```

---

### 16. `POST /eventos/:id/gastos` — Registrar gasto del evento

**Descripción:** Registra un egreso en la caja del grupo asociado al evento. Funciona para **ambos tipos** de evento (venta y grupo). El concepto del movimiento se asigna automáticamente según el tipo de evento.

**Casos de uso:**
- `estadoPago: 'pagado'` → El grupo ya pagó el gasto directamente
- `estadoPago: 'pendiente_reembolso'` → Alguien del grupo adelantó su plata y hay que reembolsarle. En este caso se debe enviar `personaAReembolsarId`.

#### Body

```json
{
  "monto": 5000.00,
  "descripcion": "Compra de materiales",
  "responsableId": "550e8400-e29b-41d4-a716-446655440002",
  "medioPago": "efectivo",
  "estadoPago": "pendiente_reembolso",
  "personaAReembolsarId": "550e8400-e29b-41d4-a716-446655440003"
}
```

#### Body Schema

| Campo | Tipo | Requerido | Validación |
|-------|------|-----------|------------|
| `monto` | number | Sí | ≥ 0 |
| `descripcion` | string | Sí | — |
| `responsableId` | UUID | Sí | Debe existir como persona |
| `medioPago` | `MedioPago` | Sí | Valor válido del enum |
| `estadoPago` | `EstadoPago` | Sí | `pagado` \| `pendiente_reembolso` |
| `personaAReembolsarId` | UUID | No | Requerido si `estadoPago === 'pendiente_reembolso'` |

#### Response 200 OK

Sin cuerpo de respuesta.

---

## Error Handling

### HTTP Status Codes

| Código | Descripción | Cuándo ocurre |
|--------|-------------|---------------|
| 200 | OK | GET, PATCH, POST (cierre/ingreso/gasto) exitoso |
| 201 | Created | POST (crear evento/producto/venta) exitoso |
| 400 | Bad Request | Validación fallida, o regla de negocio violada |
| 404 | Not Found | Evento, producto, vendedor o persona no existe |
| 500 | Internal Server Error | Error inesperado del servidor |

### Mensajes de validación frecuentes

| Situación | Mensaje |
|-----------|---------|
| Evento no encontrado | `Evento con ID <id> no encontrado` |
| Producto no encontrado | `Producto con ID <id> no encontrado` |
| Producto de otro evento | `El producto no pertenece a este evento` |
| Eliminar evento con movimientos | `No se puede eliminar el evento: tiene movimientos asociados` |
| Eliminar producto con movimientos | `No se puede eliminar: el evento tiene movimientos asociados` |
| Cerrar evento de grupo | `Solo se pueden cerrar eventos de venta` |
| Ingreso en evento de venta | `Este endpoint es solo para eventos de grupo` |
| Campo requerido faltante | `<campo> should not be empty` |
| Enum inválido | `<campo> must be one of the following values: <valores>` |
| UUID inválido | `<campo> must be a UUID` |
| Número esperado | `<campo> must be a number conforming to the specified constraints` |

---

## UI Recommendations

### TipoEvento

| Valor | Color | Icono (Material) | Descripción para el usuario |
|-------|-------|------------------|-----------------------------|
| `venta` | `#F59E0B` (amber) | `store` | Evento de venta |
| `grupo` | `#3B82F6` (blue) | `groups` | Evento de grupo |

### DestinoGanancia

| Valor | Descripción para el usuario |
|-------|----------------------------|
| `cuentas_personales` | "Ganancia va a cada vendedor" |
| `caja_grupo` | "Ganancia va a la caja del grupo" |

### EstadoPago (para gastos)

| Valor | Color | Icono | Descripción |
|-------|-------|-------|-------------|
| `pagado` | `#10B981` (green) | `check_circle` | Pagado |
| `pendiente_reembolso` | `#F59E0B` (amber) | `schedule` | Pendiente de reembolso |

### KPIs — Sugerencia de tarjetas

```
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│  💰 Total Ingresos  │  │  📉 Total Gastado   │  │  ⏳ Por Reembolsar  │  │  📊 Balance         │
│  $45.000            │  │  $12.000            │  │  $3.000             │  │  $33.000            │
│  (green)            │  │  (red)              │  │  (amber)            │  │  (blue)             │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘
```

---

## Example Flows

### Flujo: Evento de venta (empanadas)

```
1. Crear evento
   POST /eventos { nombre: "Venta de empanadas", tipo: "venta", destinoGanancia: "cuentas_personales", fecha: "2025-06-15" }

2. Agregar productos
   POST /eventos/:id/productos { nombre: "Empanada de carne", precioCosto: 150, precioVenta: 300 }
   POST /eventos/:id/productos { nombre: "Empanada de verdura", precioCosto: 120, precioVenta: 250 }

3. Registrar gastos previos (compra de ingredientes)
   POST /eventos/:id/gastos { monto: 8000, descripcion: "Ingredientes", responsableId: ..., medioPago: "efectivo", estadoPago: "pendiente_reembolso", personaAReembolsarId: ... }

4. El día del evento: registrar ventas en lote por vendedor
   POST /eventos/:id/ventas/lote { vendedorId: ..., items: [{ productoId: ..., cantidad: 12 }, { productoId: ..., cantidad: 8 }] }

5. Ver resumen antes de cerrar
   GET /eventos/:id/resumen-ventas

6. Cerrar el evento y distribuir ganancias
   POST /eventos/:id/cerrar { medioPago: "efectivo" }

7. Verificar KPIs finales
   GET /eventos/:id/kpis
```

### Flujo: Evento de grupo (cena scout)

```
1. Crear evento
   POST /eventos { nombre: "Cena Anual", tipo: "grupo", tipoEvento: "Cena", fecha: "2025-07-20" }

2. Registrar gastos de preparación
   POST /eventos/:id/gastos { monto: 15000, descripcion: "Compra de comida", ..., estadoPago: "pagado" }

3. Registrar ingresos (venta de entradas)
   POST /eventos/:id/ingresos { monto: 25000, descripcion: "Venta de entradas", ..., medioPago: "efectivo" }
   POST /eventos/:id/ingresos { monto: 10000, descripcion: "Venta de bebidas", ..., medioPago: "efectivo" }

4. Ver balance
   GET /eventos/:id/kpis
   → balance: 25000 + 10000 - 15000 = 20000
```

### Flujo: Consulta de lista con detalle

```
1. Listar eventos ordenados por fecha
   GET /eventos
   → Mostrar card por evento con nombre, fecha, tipo

2. Click en un evento de venta
   GET /eventos/:id        → Datos básicos y productos del evento
   GET /eventos/:id/kpis   → Tarjetas de ingresos/gastos/balance
   GET /eventos/:id/resumen-ventas → Tabla de ventas por vendedor

3. Click en un evento de grupo
   GET /eventos/:id        → Datos básicos
   GET /eventos/:id/kpis   → Tarjetas financieras
```
