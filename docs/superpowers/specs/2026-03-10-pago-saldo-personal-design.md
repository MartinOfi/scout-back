# Diseño: Pago con Saldo de Caja Personal

**Fecha:** 2026-03-10
**Estado:** Aprobado
**Autor:** Brainstorming con arquitectos

## Resumen

Permitir que Protagonistas y Educadores usen el saldo de su caja personal para pagar inscripciones, cuotas y campamentos. Los pagos pueden ser totales (100% saldo personal) o mixtos (saldo personal + efectivo/transferencia).

## Contexto

### Estado Actual

- Las cajas personales acumulan saldo de ganancias de eventos de venta
- El saldo se calcula dinámicamente desde movimientos (nunca almacenado)
- Solo Protagonista y Educador tienen caja personal (PersonaExterna no)
- Los pagos actuales solo soportan `efectivo` y `transferencia`

### Problema

No existe forma de usar el saldo acumulado en caja personal para pagar inscripciones, cuotas o campamentos. Los usuarios deben traer efectivo aunque tengan saldo disponible.

## Diseño

### Principios

1. **Un solo request** - El frontend envía todo junto, el backend orquesta
2. **Transaccional** - Si algo falla, no se crea nada
3. **Cada módulo maneja sus pagos** - No hay endpoint genérico `/pagos`
4. **Servicio compartido** - `PagosService` centraliza la lógica de movimientos

### Cambios en Enums

```typescript
// MedioPago - agregar
export enum MedioPago {
  EFECTIVO = 'efectivo',
  TRANSFERENCIA = 'transferencia',
  SALDO_PERSONAL = 'saldo_personal', // NUEVO
}

// ConceptoMovimiento - agregar
export enum ConceptoMovimiento {
  // ... existentes ...
  USO_SALDO_PERSONAL = 'uso_saldo_personal', // NUEVO
}
```

### Estructura de Módulos

```
src/modules/pagos/           # NUEVO módulo
├── pagos.module.ts
├── pagos.service.ts         # Servicio interno (sin controller)
├── interfaces/
│   └── ejecutar-pago.interface.ts
└── dtos/
    └── resultado-pago.dto.ts
```

### Endpoints por Módulo

| Módulo | Endpoint | Descripción |
|--------|----------|-------------|
| Inscripciones | `POST /inscripciones` | Crear + pago inicial (puede usar saldo personal) |
| Inscripciones | `POST /inscripciones/:id/pagar` | Pagos posteriores |
| Cuotas | `POST /cuotas/:id/pagar` | Pagar cuota existente |
| Campamentos | `POST /campamentos/:id/pagar` | Pagar campamento |

### Flujo de Datos

#### Ejemplo: Inscripción $30,000 con pago mixto

**Request:**
```json
POST /inscripciones
{
  "personaId": "juan-uuid",
  "tipo": "scout_argentina",
  "ano": 2025,
  "montoTotal": 30000,
  "montoBonificado": 2000,
  "montoPagado": 28000,
  "montoConSaldoPersonal": 8000,
  "medioPago": "efectivo"
}
```

**Se crea en una transacción:**

| # | Tabla | Tipo | Caja | Monto | Concepto | medioPago |
|---|-------|------|------|-------|----------|-----------|
| 1 | `inscripciones` | - | - | - | - | - |
| 2 | `movimientos` | EGRESO | Personal Juan | $8,000 | `uso_saldo_personal` | `saldo_personal` |
| 3 | `movimientos` | INGRESO | Grupo | $28,000 | `inscripcion_scout_argentina` | `efectivo` |

### DTOs

#### CreateInscripcionDto (extendido)

```typescript
export class CreateInscripcionDto {
  // Datos de inscripción (existentes)
  @IsUUID()
  personaId: string;

  @IsEnum(TipoInscripcion)
  tipo: TipoInscripcion;

  @IsNumber()
  ano: number;

  @IsNumber()
  @IsPositive()
  montoTotal: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  montoBonificado?: number;

  // Campos de autorización (existentes)...

  // Pago opcional
  @IsNumber()
  @Min(0)
  @IsOptional()
  montoPagado?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @ValidarMontoSaldoPersonal()
  montoConSaldoPersonal?: number;

  @IsEnum(MedioPago)
  @IsOptional()
  medioPago?: MedioPago;  // default: efectivo
}
```

#### PagarInscripcionDto / PagarCuotaDto / PagarCampamentoDto

```typescript
export class PagarInscripcionDto {
  @IsNumber()
  @IsPositive()
  montoPagado: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @ValidarMontoSaldoPersonal()
  montoConSaldoPersonal?: number;

  @IsEnum(MedioPago)
  @IsOptional()
  medioPago?: MedioPago;  // default: efectivo

  @IsString()
  @IsOptional()
  descripcion?: string;
}
```

#### EjecutarPagoParams (interface interna)

```typescript
export interface EjecutarPagoParams {
  personaId: string;
  montoTotal: number;
  montoConSaldoPersonal: number;
  medioPago?: MedioPago;
  concepto: ConceptoMovimiento;
  inscripcionId?: string;
  cuotaId?: string;
  campamentoId?: string;
  descripcion?: string;
}
```

#### ResultadoPagoDto

```typescript
export class ResultadoPagoDto {
  movimientoIngreso: {
    id: string;
    monto: number;
    concepto: ConceptoMovimiento;
    medioPago: MedioPago;
  };

  movimientoEgresoPersonal?: {
    id: string;
    monto: number;
  };

  desglose: {
    montoSaldoPersonal: number;
    montoFisico: number;
    total: number;
  };
}
```

### PagosService

```typescript
@Injectable()
export class PagosService {
  constructor(
    private readonly cajasService: CajasService,
    private readonly dataSource: DataSource,
  ) {}

  async ejecutarPagoConManager(
    manager: EntityManager,
    params: EjecutarPagoParams,
  ): Promise<ResultadoPagoDto> {
    const {
      personaId,
      montoTotal,
      montoConSaldoPersonal = 0,
      medioPago = MedioPago.EFECTIVO,
      concepto,
      inscripcionId,
      cuotaId,
      campamentoId,
      descripcion,
    } = params;

    const montoFisico = montoTotal - montoConSaldoPersonal;
    let movimientoEgresoPersonal: Movimiento | undefined;

    // 1. Crear EGRESO de caja personal (si aplica)
    if (montoConSaldoPersonal > 0) {
      const cajaPersonal = await this.cajasService.findCajaPersonal(personaId);
      if (!cajaPersonal) {
        throw new BadRequestException('La persona no tiene caja personal');
      }

      const saldoDisponible = await this.cajasService.calcularSaldo(cajaPersonal.id);
      if (saldoDisponible < montoConSaldoPersonal) {
        throw new BadRequestException(
          `Saldo insuficiente. Disponible: $${saldoDisponible}, Requerido: $${montoConSaldoPersonal}`
        );
      }

      movimientoEgresoPersonal = manager.create(Movimiento, {
        cajaId: cajaPersonal.id,
        tipo: TipoMovimiento.EGRESO,
        monto: montoConSaldoPersonal,
        concepto: ConceptoMovimiento.USO_SALDO_PERSONAL,
        medioPago: MedioPago.SALDO_PERSONAL,
        responsableId: personaId,
        estadoPago: EstadoPago.PAGADO,
        inscripcionId,
        cuotaId,
        campamentoId,
        descripcion: descripcion ?? 'Uso de saldo personal para pago',
      });

      await manager.save(movimientoEgresoPersonal);
    }

    // 2. Crear INGRESO en caja grupo
    const cajaGrupo = await this.cajasService.findCajaGrupo();

    const movimientoIngreso = manager.create(Movimiento, {
      cajaId: cajaGrupo.id,
      tipo: TipoMovimiento.INGRESO,
      monto: montoTotal,
      concepto,
      medioPago: montoFisico > 0 ? medioPago : MedioPago.SALDO_PERSONAL,
      responsableId: personaId,
      estadoPago: EstadoPago.PAGADO,
      inscripcionId,
      cuotaId,
      campamentoId,
      descripcion,
    });

    await manager.save(movimientoIngreso);

    // 3. Retornar resultado
    return {
      movimientoIngreso: {
        id: movimientoIngreso.id,
        monto: movimientoIngreso.monto,
        concepto: movimientoIngreso.concepto,
        medioPago: movimientoIngreso.medioPago,
      },
      movimientoEgresoPersonal: movimientoEgresoPersonal
        ? { id: movimientoEgresoPersonal.id, monto: movimientoEgresoPersonal.monto }
        : undefined,
      desglose: {
        montoSaldoPersonal: montoConSaldoPersonal,
        montoFisico,
        total: montoTotal,
      },
    };
  }
}
```

### Manejo de Errores

| Escenario | Código | Mensaje |
|-----------|--------|---------|
| Persona no tiene caja personal | 400 | "La persona no tiene caja personal" |
| Saldo insuficiente | 400 | "Saldo insuficiente. Disponible: $X, Requerido: $Y" |
| Monto saldo > monto pagado | 400 | "El monto de saldo personal no puede superar el monto pagado" |
| Monto > saldo pendiente | 400 | "El monto excede el saldo pendiente ($X)" |
| Persona no existe | 404 | "Persona no encontrada" |
| Entidad no existe | 404 | "Inscripción/Cuota/Campamento no encontrada" |
| Ya está pagado | 400 | "La inscripción ya está completamente pagada" |

### Validador Custom

```typescript
export function ValidarMontoSaldoPersonal(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'validarMontoSaldoPersonal',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const obj = args.object as any;
          const montoConSaldoPersonal = value ?? 0;
          const montoPagado = obj.montoPagado ?? 0;
          return montoConSaldoPersonal <= montoPagado;
        },
        defaultMessage() {
          return 'El monto de saldo personal no puede superar el monto pagado';
        },
      },
    });
  };
}
```

## Testing

### Unit Tests - PagosService

```typescript
describe('PagosService', () => {
  describe('ejecutarPagoConManager', () => {
    it('debería crear solo INGRESO cuando montoConSaldoPersonal es 0');
    it('debería crear EGRESO + INGRESO cuando usa saldo personal');
    it('debería crear EGRESO + INGRESO en pago mixto');
    it('debería usar medioPago efectivo por defecto');
    it('debería usar medioPago saldo_personal cuando es 100% saldo');
    it('debería fallar si persona no tiene caja personal');
    it('debería fallar si saldo insuficiente');
  });
});
```

### Unit Tests - InscripcionesService

```typescript
describe('InscripcionesService', () => {
  describe('create con pago', () => {
    it('debería crear inscripción sin pago cuando montoPagado es 0');
    it('debería crear inscripción + movimientos cuando hay pago');
    it('debería crear inscripción + movimientos con saldo personal');
    it('debería hacer rollback de todo si falla el pago');
  });

  describe('pagar', () => {
    it('debería registrar pago en inscripción existente');
    it('debería registrar pago con saldo personal');
    it('debería fallar si inscripción ya está pagada');
    it('debería fallar si monto excede saldo pendiente');
  });
});
```

### E2E Tests

```typescript
describe('POST /inscripciones (e2e)', () => {
  it('debería crear inscripción con pago mixto y devolver 201');
  it('debería devolver 400 si saldo personal insuficiente');
});

describe('POST /inscripciones/:id/pagar (e2e)', () => {
  it('debería registrar pago y actualizar estado a PAGADO');
  it('debería registrar pago parcial y mantener estado PARCIAL');
});
```

## Decisiones de Arquitectura

### ¿Por qué no un endpoint genérico `/pagos`?

Se evaluó crear un endpoint único `POST /pagos` pero se descartó porque:
- El frontend tendría que decidir entre dos endpoints según el caso
- Cada entidad (inscripción, cuota, campamento) tiene validaciones específicas
- Es más natural que cada módulo maneje sus propios pagos

### ¿Por qué un servicio interno `PagosService`?

Para no duplicar la lógica de crear movimientos de egreso/ingreso en cada servicio. `PagosService` centraliza:
- Validación de saldo disponible
- Creación del egreso en caja personal
- Creación del ingreso en caja grupo
- Manejo de la transacción

### ¿Por qué `SALDO_PERSONAL` en `MedioPago`?

Aunque `SALDO_PERSONAL` no es un "medio de pago físico" como efectivo o transferencia, se decidió incluirlo para:
- Consistencia: todos los movimientos tienen `medioPago`
- Reportes: permite filtrar movimientos por origen del dinero
- Claridad: el egreso de caja personal tiene `medioPago: saldo_personal`

## Archivos a Crear/Modificar

### Nuevos

| Archivo | Descripción |
|---------|-------------|
| `src/modules/pagos/pagos.module.ts` | Módulo de pagos |
| `src/modules/pagos/pagos.service.ts` | Servicio de pagos |
| `src/modules/pagos/interfaces/ejecutar-pago.interface.ts` | Interface interna |
| `src/modules/pagos/dtos/resultado-pago.dto.ts` | DTO de respuesta |
| `src/modules/pagos/validators/pago.validator.ts` | Validador custom |

### Modificar

| Archivo | Cambio |
|---------|--------|
| `src/common/enums/medio-pago.enum.ts` | Agregar `SALDO_PERSONAL` |
| `src/common/enums/concepto-movimiento.enum.ts` | Agregar `USO_SALDO_PERSONAL` |
| `src/modules/inscripciones/dtos/create-inscripcion.dto.ts` | Agregar campos de pago |
| `src/modules/inscripciones/dtos/pagar-inscripcion.dto.ts` | Crear DTO |
| `src/modules/inscripciones/inscripciones.service.ts` | Integrar PagosService |
| `src/modules/inscripciones/inscripciones.controller.ts` | Agregar endpoint pagar |
| `src/modules/cuotas/dtos/pagar-cuota.dto.ts` | Crear DTO |
| `src/modules/cuotas/cuotas.service.ts` | Integrar PagosService |
| `src/modules/cuotas/cuotas.controller.ts` | Agregar endpoint pagar |
| `src/modules/campamentos/dtos/pagar-campamento.dto.ts` | Crear DTO |
| `src/modules/campamentos/campamentos.service.ts` | Integrar PagosService |
| `src/modules/campamentos/campamentos.controller.ts` | Agregar endpoint pagar |
| `src/app.module.ts` | Importar PagosModule |

## Próximos Pasos

1. Crear módulo `pagos/` con servicio interno
2. Agregar valores a enums
3. Extender DTOs de inscripciones
4. Implementar en InscripcionesService
5. Crear tests unitarios
6. Extender a cuotas y campamentos
7. Crear tests E2E
