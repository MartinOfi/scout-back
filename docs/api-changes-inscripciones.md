# API Inscripciones - Guía para Frontend

**Fecha:** 2026-03-09

---

## Cambios Importantes

1. **Dos tipos de inscripción**: `grupo` y `scout_argentina`
2. **4 campos de autorización**: nuevos campos booleanos
3. **Estado viene calculado**: en el GET por ID
4. **Endpoints de pago eliminados**: los pagos se hacen desde Movimientos

---

## Endpoints

### Base URL: `/api/v1/inscripciones`

---

### GET / - Listar inscripciones

**Query Params opcionales:**
- `ano`: number (ej: 2026)
- `tipo`: `'grupo'` | `'scout_argentina'`

**Ejemplos:**
```
GET /inscripciones
GET /inscripciones?ano=2026
GET /inscripciones?ano=2026&tipo=grupo
```

**Response:** `Inscripcion[]`

---

### GET /persona/:personaId - Inscripciones de una persona

**Response:** `Inscripcion[]`

---

### GET /:id - Obtener inscripción con estado

**Response:**
```json
{
  "inscripcion": {
    "id": "uuid",
    "personaId": "uuid",
    "tipo": "grupo",
    "ano": 2026,
    "montoTotal": 15000,
    "montoBonificado": 5000,
    "declaracionDeSalud": true,
    "autorizacionDeImagen": false,
    "salidasCercanas": true,
    "autorizacionIngreso": true,
    "persona": { "id": "...", "nombre": "Juan" }
  },
  "montoPagado": 5000,
  "estado": "parcial"
}
```

**Estados:** `pendiente` | `parcial` | `pagado`

---

### POST / - Crear inscripción

**Body:**
```json
{
  "personaId": "uuid",
  "tipo": "grupo",
  "ano": 2026,
  "montoTotal": 15000,
  "montoBonificado": 5000,
  "declaracionDeSalud": true,
  "autorizacionDeImagen": false,
  "salidasCercanas": false,
  "autorizacionIngreso": false
}
```

| Campo | Requerido | Default |
|-------|-----------|---------|
| personaId | ✓ | - |
| tipo | ✓ | - |
| ano | ✓ | - |
| montoTotal | ✓ | - |
| montoBonificado | - | 0 |
| declaracionDeSalud | - | false |
| autorizacionDeImagen | - | false |
| salidasCercanas | - | false |
| autorizacionIngreso | - | false |

**Errores:**
- `400`: Ya existe inscripción para este año y tipo
- `400`: El monto bonificado no puede exceder el monto total

---

### PATCH /:id - Actualizar inscripción

**Body:** (todos opcionales)
```json
{
  "montoBonificado": 5000,
  "declaracionDeSalud": true,
  "autorizacionDeImagen": true,
  "salidasCercanas": true,
  "autorizacionIngreso": true
}
```

**Uso:** Actualizar autorizaciones o bonificación.

---

### DELETE /:id - Eliminar inscripción

**Response:** 200 OK

---

## Tipos TypeScript

```typescript
type TipoInscripcion = 'grupo' | 'scout_argentina';

type EstadoInscripcion = 'pendiente' | 'parcial' | 'pagado';

interface Inscripcion {
  id: string;
  personaId: string;
  tipo: TipoInscripcion;
  ano: number;
  montoTotal: number;
  montoBonificado: number;
  declaracionDeSalud: boolean;
  autorizacionDeImagen: boolean;
  salidasCercanas: boolean;
  autorizacionIngreso: boolean;
  createdAt: string;
  updatedAt: string;
  persona?: Persona;
}

interface InscripcionConEstado {
  inscripcion: Inscripcion;
  montoPagado: number;
  estado: EstadoInscripcion;
}

interface CreateInscripcionDto {
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

interface UpdateInscripcionDto {
  montoBonificado?: number;
  declaracionDeSalud?: boolean;
  autorizacionDeImagen?: boolean;
  salidasCercanas?: boolean;
  autorizacionIngreso?: boolean;
}
```

---

## Servicio Angular

```typescript
@Injectable({ providedIn: 'root' })
export class InscripcionesService {
  private apiUrl = '/api/v1/inscripciones';

  constructor(private http: HttpClient) {}

  getAll(ano?: number, tipo?: TipoInscripcion): Observable<Inscripcion[]> {
    let params = new HttpParams();
    if (ano) params = params.set('ano', ano.toString());
    if (tipo) params = params.set('tipo', tipo);
    return this.http.get<Inscripcion[]>(this.apiUrl, { params });
  }

  getById(id: string): Observable<InscripcionConEstado> {
    return this.http.get<InscripcionConEstado>(`${this.apiUrl}/${id}`);
  }

  getByPersona(personaId: string): Observable<Inscripcion[]> {
    return this.http.get<Inscripcion[]>(`${this.apiUrl}/persona/${personaId}`);
  }

  create(dto: CreateInscripcionDto): Observable<Inscripcion> {
    return this.http.post<Inscripcion>(this.apiUrl, dto);
  }

  update(id: string, dto: UpdateInscripcionDto): Observable<Inscripcion> {
    return this.http.patch<Inscripcion>(`${this.apiUrl}/${id}`, dto);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
```

---

## Notas

- Una persona puede tener **una inscripción de cada tipo por año**
- Los pagos se registran desde el módulo de **Movimientos** (no desde Inscripciones)
- El `estado` y `montoPagado` solo vienen en `GET /:id`, no en listados
- **Los campos de autorización solo aplican a inscripciones `scout_argentina`**:
  - En `POST`: se ignoran si `tipo` es `grupo` (siempre `false`)
  - En `PATCH`: error `400` si se intenta actualizar en inscripción `grupo`
