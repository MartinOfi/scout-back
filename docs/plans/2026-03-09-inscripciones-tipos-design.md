# Diseño: Soporte para dos tipos de inscripción

**Fecha:** 2026-03-09
**Estado:** Aprobado

## Contexto

El módulo de inscripciones actual solo maneja un tipo de inscripción (Scout Argentina). Se necesita soportar dos tipos independientes:

- **GRUPO**: Inscripción al grupo scout local
- **SCOUT_ARGENTINA**: Inscripción a Scout Argentina nacional

## Requisitos de negocio

### Independencia

- Un chico puede inscribirse solo al grupo, solo a Scout Argentina, o a ambos
- Son dos registros separados con montos diferentes

### Bonificación

- Aplica a ambos tipos de inscripción
- Siempre es decisión manual (no automática)
- Puede ser parcial (no necesariamente 100%)
- Sin límite de veces (puede bonificarse en múltiples años)
- Significa que no se cobra al chico, sin crear movimientos ficticios

### Flujos financieros

| Tipo | Ingreso (familia→grupo) | Egreso (grupo→SA) |
|------|------------------------|-------------------|
| GRUPO | Sí, vinculado a inscripción | N/A |
| SCOUT_ARGENTINA | Sí, vinculado a inscripción | Sí, pero pago global sin vincular |

El pago a Scout Argentina se hace en un solo pago global (todas las inscripciones juntas), por lo que el egreso NO se vincula a inscripciones individuales.

## Diseño técnico

### Separación de responsabilidades

| Módulo | Responsabilidad |
|--------|-----------------|
| **Inscripciones** | Registrar qué personas están inscriptas para qué año y tipo |
| **Movimientos** | Manejar ingresos (familia paga) y egresos (grupo paga a SA) |

### Nuevo enum

```typescript
export enum TipoInscripcion {
  GRUPO = 'grupo',
  SCOUT_ARGENTINA = 'scout_argentina',
}
```

### Entidad Inscripcion (simplificada)

```typescript
@Entity('inscripciones')
export class Inscripcion extends BaseEntity {
  @Column()
  personaId: string;

  @Column({ type: 'enum', enum: TipoInscripcion })
  tipo: TipoInscripcion;

  @Column()
  ano: number;

  @Column('decimal', { precision: 10, scale: 2 })
  montoTotal: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  montoBonificado: number;

  // Unique constraint: (personaId, ano, tipo)
}
```

**Campos eliminados:**
- `montoPagado` → se calcula sumando movimientos vinculados
- `estado` → se calcula dinámicamente
- `movimientoBonificacionId` → ya no se crea movimiento de bonificación

### Servicio InscripcionesService

**Métodos a mantener:**
- `findAll()`
- `findByPersona(personaId)`
- `findByAno(ano)`
- `findOne(id)`
- `remove(id)`

**Métodos a modificar:**
- `create()` → renombrar a `registrarInscripcion()`, sin lógica de movimientos

**Métodos a agregar:**
- `getMontoPagado(inscripcionId)` → suma de movimientos vinculados
- `getEstado(inscripcionId)` → calculado según monto pagado + bonificado vs total
- `findByAnoAndTipo(ano, tipo)` → filtrar por tipo

**Métodos a eliminar:**
- `registrarPago()` → se hace desde módulo de movimientos
- `registrarPagoScoutArgentina()` → se hace desde módulo de movimientos

### DTO CreateInscripcionDto

```typescript
export class CreateInscripcionDto {
  @IsUUID()
  personaId: string;

  @IsEnum(TipoInscripcion)
  tipo: TipoInscripcion;

  @IsNumber()
  @Min(2020)
  @Max(2100)
  ano: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  montoTotal: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  montoBonificado?: number; // default 0
}
```

### Conceptos de movimiento

**Nuevos/modificados:**
- `INSCRIPCION_GRUPO` → ingreso por pago de inscripción de grupo
- `INSCRIPCION_SCOUT_ARGENTINA` → ingreso por pago de inscripción SA (renombrar INSCRIPCION actual)
- `PAGO_SCOUT_ARGENTINA` → egreso global a SA (ya existe como INSCRIPCION_PAGO_SCOUT_ARGENTINA)

**A eliminar:**
- `AJUSTE_BONIFICACION` → ya no se usa

### Cálculo de estado

```typescript
getEstado(inscripcion: Inscripcion, montoPagado: number): EstadoInscripcion {
  const totalCubierto = montoPagado + inscripcion.montoBonificado;

  if (totalCubierto >= inscripcion.montoTotal) {
    return EstadoInscripcion.PAGADO;
  }
  if (totalCubierto > 0) {
    return EstadoInscripcion.PARCIAL;
  }
  return EstadoInscripcion.PENDIENTE;
}
```

### Limpieza

- Eliminar campo `fueBonificado` de entidad Protagonista
- Eliminar método `marcarBonificado()` de PersonasService

## Migración de datos

Si hay inscripciones existentes:
1. Asignar `tipo = SCOUT_ARGENTINA` a todas las inscripciones actuales
2. Recalcular estados basados en movimientos existentes
3. Eliminar movimientos de tipo `AJUSTE_BONIFICACION` (opcional, o marcar como legacy)
