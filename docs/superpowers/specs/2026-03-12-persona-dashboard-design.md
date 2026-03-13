# Persona Dashboard API Design

**Date:** 2026-03-12
**Status:** Approved
**Author:** Claude Code (Brainstorming Session)

## Overview

Backend endpoint that provides a consolidated view of a person's financial and administrative status for frontend dashboard consumption.

## Requirements Summary

| Aspect | Decision |
|--------|----------|
| Scope | Only Protagonistas and Educadores (with personal accounts) |
| Inscriptions | Current year + past years with pending debt |
| Cuotas | Same criteria as inscriptions |
| Movements | Last 5 |
| Documents | Personal docs (Protagonista only) + Inscription authorizations |
| Debt Display | Summary by category + item details |
| Endpoint | Single `GET /personas/:id/dashboard` |

## Endpoint Specification

### Request

```
GET /api/v1/personas/:id/dashboard
```

**Path Parameters:**
- `id` (string, required): UUID of the person

**Validations:**
- Person must exist → 404 if not found
- Person must be Protagonista or Educador → 400 if PersonaExterna

### Response

**HTTP 200 OK**

```typescript
interface PersonaDashboardDto {
  persona: {
    id: string;
    nombre: string;
    tipo: 'Protagonista' | 'Educador';
    estado: 'activo' | 'inactivo';
    rama: 'MANADA' | 'UNIDAD' | 'CAMINANTES' | 'ROVERS' | null;
    cargo?: 'EDUCADOR' | 'JEFE_DE_RAMA' | 'JEFE_DE_GRUPO'; // Educador only
  };

  cuentaPersonal: {
    id: string;
    saldo: number; // Calculated from movements
  };

  documentacionPersonal?: { // Protagonista only, null for Educador
    partidaNacimiento: boolean;
    dni: boolean;
    dniPadres: boolean;
    carnetObraSocial: boolean;
    completa: boolean; // true if all are true
  };

  inscripciones: {
    resumen: {
      total: number;    // Sum of pending balances
      cantidad: number; // Count of items with debt
    };
    items: Array<{
      id: string;
      tipo: 'GRUPO' | 'SCOUT_ARGENTINA';
      ano: number;
      montoTotal: number;
      montoBonificado: number;
      montoPagado: number;
      saldoPendiente: number;
      estado: 'PENDIENTE' | 'PARCIAL' | 'PAGADO';
      autorizaciones?: { // SCOUT_ARGENTINA only
        declaracionDeSalud: boolean;
        autorizacionDeImagen: boolean;
        salidasCercanas: boolean;
        autorizacionIngreso: boolean;
        certificadoAptitudFisica: boolean;
        completas: boolean;
      };
    }>;
  };

  cuotas: {
    resumen: {
      total: number;
      cantidad: number;
    };
    items: Array<{
      id: string;
      nombre: string;
      ano: number;
      montoTotal: number;
      montoPagado: number;
      saldoPendiente: number;
      estado: 'PENDIENTE' | 'PARCIAL' | 'PAGADO';
    }>;
  };

  deudaTotal: {
    total: number; // inscripciones + cuotas
    inscripciones: number;
    cuotas: number;
  };

  ultimosMovimientos: Array<{
    id: string;
    fecha: string; // ISO 8601
    tipo: 'ingreso' | 'egreso';
    concepto: string;
    monto: number;
    medioPago: 'EFECTIVO' | 'TRANSFERENCIA' | 'SALDO_PERSONAL';
  }>;
}
```

### Error Responses

**404 Not Found**
```json
{
  "statusCode": 404,
  "message": "Persona no encontrada",
  "error": "Not Found"
}
```

**400 Bad Request**
```json
{
  "statusCode": 400,
  "message": "Dashboard no disponible para PersonaExterna",
  "error": "Bad Request"
}
```

## Architecture

### Component Structure

```
PersonasModule (existing)
├── PersonasController
│   └── GET /:id/dashboard → dashboard()  ← NEW endpoint
├── PersonasDashboardService  ← NEW service
│   ├── getDashboard(id: string): Promise<PersonaDashboardDto>
│   └── Dependencies:
│       ├── PersonasService (get person)
│       ├── CajasService (get personal account + balance)
│       ├── InscripcionesService (get inscriptions)
│       ├── CuotasService (get fees)
│       └── MovimientosService (recent movements)
└── DTOs
    └── persona-dashboard.dto.ts  ← NEW DTO
```

### Data Flow

1. Controller receives request with `id`
2. DashboardService validates person exists and is Protagonista/Educador
3. Parallel calls to services to fetch data
4. Assembles response into DTO
5. Returns to controller

## Business Logic

### Inscription Filter

```typescript
// Current year (2026) + any past year with saldoPendiente > 0
inscripciones = await inscripcionesService.findByPersona(personaId);
const currentYear = new Date().getFullYear();
const filtered = inscripciones.filter(i =>
  i.ano === currentYear || i.saldoPendiente > 0
);
```

### Cuota Filter

```typescript
// Current year (2026) + any past year with pending balance
cuotas = await cuotasService.findByPersona(personaId);
const currentYear = new Date().getFullYear();
const filtered = cuotas.filter(c =>
  c.ano === currentYear || (c.montoTotal - c.montoPagado) > 0
);
```

### Personal Balance Calculation

```typescript
// Reuses CajasService.calcularSaldo()
// SUM(CASE WHEN tipo = 'ingreso' THEN monto ELSE -monto END)
```

### Movements Filter

```typescript
// Last 5 movements from personal account
WHERE cajaId = :cajaPersonalId
ORDER BY fecha DESC
LIMIT 5
```

### Authorization Completeness

```typescript
completas = declaracionDeSalud && autorizacionDeImagen &&
            salidasCercanas && autorizacionIngreso &&
            certificadoAptitudFisica;
```

### Personal Documentation Completeness

```typescript
completa = partidaNacimiento && dni && dniPadres && carnetObraSocial;
```

## Testing Strategy

### Unit Tests (`personas-dashboard.service.spec.ts`)

1. Returns complete dashboard for Protagonista with all data
2. Returns dashboard for Educador (without personal documentation)
3. Throws error if person not found
4. Throws error if person is PersonaExterna
5. Filters inscriptions correctly (current year + debts)
6. Filters cuotas correctly (current year + debts)
7. Calculates personal balance correctly
8. Limits movements to last 5
9. Calculates total debt correctly
10. Marks documentation as complete/incomplete

### E2E Tests (`personas-dashboard.e2e-spec.ts`)

1. `GET /personas/:id/dashboard` returns 200 with correct structure
2. Returns 404 if person not found
3. Returns 400 if person is PersonaExterna

## Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `src/modules/personas/services/personas-dashboard.service.ts` | Dashboard service |
| `src/modules/personas/dtos/persona-dashboard.dto.ts` | Response DTO |
| `src/modules/personas/services/personas-dashboard.service.spec.ts` | Unit tests |

### Modified Files

| File | Change |
|------|--------|
| `src/modules/personas/personas.module.ts` | Import new service |
| `src/modules/personas/controllers/personas.controller.ts` | Add dashboard endpoint |

## Implementation Approach

**Enfoque A: Servicio Dedicado** (Selected)

Creates a `PersonaDashboardService` that:
- Orchestrates calls to existing services
- Assembles response into a single DTO
- Keeps business logic in original services

**Pros:** Reuses existing logic, easy to maintain, testable
**Cons:** Multiple DB queries (one per service)

## Out of Scope

Explicitly excluded from this implementation:
- Event/camp participation history
- Past inscriptions (except those with debt)
- Alerts/badges
- Activity timestamps (last payment, etc.)
- Authentication/authorization (not yet implemented in the system)
