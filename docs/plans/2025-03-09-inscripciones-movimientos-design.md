# Design: Inscripciones con Movimientos Relacionados

**Fecha:** 2025-03-09
**Estado:** Aprobado
**Autor:** Claude Code

## Objetivo

Agregar a las inscripciones la capacidad de mostrar los movimientos relacionados en la vista de detalle, junto con el cálculo de saldo pendiente para determinar si se pueden agregar más pagos.

## Contexto

### Estado Actual

- **Inscripcion**: entidad sin relación directa a movimientos
- **Movimiento**: tiene campo `inscripcionId` opcional para vincular pagos
- **Endpoint existente**: `GET /movimientos/inscripcion/:inscripcionId` devuelve movimientos relacionados
- **findOneWithEstado()**: ya calcula `montoPagado` y `estado` dinámicamente

### Problema

El frontend necesita mostrar en una sola llamada:
1. Los datos de la inscripción
2. El estado de pago calculado
3. Los movimientos asociados
4. El saldo pendiente para saber si mostrar botón "Agregar pago"

## Diseño

### 1. Cambios en la Respuesta de `GET /inscripciones/:id`

**Respuesta actual:**
```typescript
{
  id: string;
  persona: { id, nombre, apellido, tipo };
  tipo: TipoInscripcion;
  ano: number;
  montoTotal: number;
  montoBonificado: number;
  declaracionDeSalud: boolean;
  autorizacionDeImagen: boolean;
  salidasCercanas: boolean;
  autorizacionIngreso: boolean;
  montoPagado: number;
  estado: EstadoInscripcion;
}
```

**Respuesta nueva:**
```typescript
{
  // ... todos los campos actuales ...
  montoPagado: number;
  estado: EstadoInscripcion;
  saldoPendiente: number;        // NUEVO
  movimientos: Movimiento[];     // NUEVO
}
```

### 2. Cambios en el Service

**Archivo:** `src/modules/inscripciones/inscripciones.service.ts`

**Método modificado:** `findOneWithEstado(id: string)`

```typescript
async findOneWithEstado(id: string) {
  const inscripcion = await this.findOne(id);
  const montoPagado = await this.getMontoPagado(id);
  const estado = this.getEstado(inscripcion, montoPagado);
  const saldoPendiente = Math.max(0,
    Number(inscripcion.montoTotal) - Number(montoPagado) - Number(inscripcion.montoBonificado)
  );

  const movimientos = await this.movimientosService.findByRelatedEntity('inscripcion', id);

  return {
    ...inscripcion,
    montoPagado,
    estado,
    saldoPendiente,
    movimientos,
  };
}
```

### 3. Flujo para Crear Nuevo Pago

El frontend usa `POST /movimientos` existente:

```typescript
{
  cajaId: "uuid-caja-grupo",
  tipo: "ingreso",
  monto: 5000,
  concepto: "inscripcion_grupo" | "inscripcion_scout_argentina",
  responsableId: "uuid-persona",
  medioPago: "efectivo" | "transferencia",
  estadoPago: "pagado",
  inscripcionId: "uuid-inscripcion",
  fecha: "2025-03-09T00:00:00Z"
}
```

**Responsabilidades del frontend:**
- Verificar `saldoPendiente > 0` antes de mostrar botón "Agregar pago"
- Usar el `tipo` de la inscripción para determinar el `concepto` correcto
- Obtener el `cajaId` del grupo

### 4. Cálculo de saldoPendiente

```
saldoPendiente = max(0, montoTotal - montoPagado - montoBonificado)
```

| Estado | saldoPendiente |
|--------|----------------|
| PAGADO | 0 |
| PARCIAL | > 0 |
| PENDIENTE | = montoTotal - montoBonificado |

### 5. Tests Requeridos

Agregar a `inscripciones.service.spec.ts`:

- `findOneWithEstado` debe incluir `movimientos` array
- `findOneWithEstado` debe incluir `saldoPendiente` calculado
- `saldoPendiente` = 0 cuando `estado === PAGADO`
- `saldoPendiente` > 0 cuando `estado === PARCIAL`
- `saldoPendiente` = `montoTotal - montoBonificado` cuando `estado === PENDIENTE`

## Decisiones de Diseño

### Por qué modificar `findOneWithEstado()` en lugar de crear nuevo endpoint

- Mínimos cambios en el código
- Mantiene la API existente
- Un solo método que ya hace el trabajo pesado
- El frontend siempre necesita los movimientos en la vista de detalle

### Por qué usar POST /movimientos existente para nuevos pagos

- Reutiliza lógica existente
- No duplica código
- El frontend tiene control total sobre los datos enviados
- Consistente con el patrón actual del sistema

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `inscripciones.service.ts` | Agregar `saldoPendiente` y `movimientos` a `findOneWithEstado()` |
| `inscripciones.service.spec.ts` | Agregar tests para nuevos campos |
| `docs/API_REFERENCE.md` | Documentar cambios en respuesta |

## Impacto

- **Breaking change:** No, solo agrega campos nuevos
- **Performance:** Una query adicional por llamada (movimientos)
- **Frontend:** Debe actualizar el tipo de respuesta esperado
