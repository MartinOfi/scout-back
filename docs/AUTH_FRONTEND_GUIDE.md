# Guía de Autenticación para Frontend

Esta guía detalla todos los flujos de autenticación que el frontend debe implementar para integrarse con el backend de Scout.

## Configuración Base

```
Base URL: http://localhost:3001/api/v1
Content-Type: application/json
```

## Tokens

El sistema usa **JWT (JSON Web Tokens)** con dos tipos de tokens:

| Token | Duración | Uso |
|-------|----------|-----|
| Access Token | 15 minutos | Enviarlo en cada request autenticado |
| Refresh Token | 7 días | Usarlo para obtener nuevos tokens cuando el access token expire |

### Headers para requests autenticados

```
Authorization: Bearer <access_token>
```

---

## Flujos de Autenticación

### 1. Registro de Credenciales

Asigna email y contraseña a una persona existente que aún no tiene credenciales.

**Endpoint:** `POST /auth/register`

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "personaId": "uuid-de-la-persona",
  "email": "usuario@ejemplo.com",
  "password": "MiPassword123!"
}
```

**Validaciones:**
- `personaId`: UUID válido de una persona existente sin credenciales
- `email`: Email válido, único en el sistema
- `password`: Mínimo 8 caracteres, máximo 128

**Response 201 (Éxito):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid-de-la-persona",
    "nombre": "Juan Pérez",
    "email": "usuario@ejemplo.com",
    "tipo": "PROTAGONISTA"
  }
}
```

**Errores:**
| Status | Descripción |
|--------|-------------|
| 400 | Email inválido o password muy corto |
| 404 | Persona no encontrada |
| 409 | Email ya en uso o persona ya tiene credenciales |

---

### 2. Login

Autentica un usuario con email y contraseña.

**Endpoint:** `POST /auth/login`

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "usuario@ejemplo.com",
  "password": "MiPassword123!"
}
```

**Response 200 (Éxito):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid-de-la-persona",
    "nombre": "Juan Pérez",
    "email": "usuario@ejemplo.com",
    "tipo": "PROTAGONISTA"
  }
}
```

**Errores:**
| Status | Descripción |
|--------|-------------|
| 400 | Campos faltantes o inválidos |
| 401 | Credenciales inválidas (email no existe o password incorrecto) |

---

### 3. Refresh Token (Renovar Tokens)

Obtiene nuevos tokens usando el refresh token actual. El refresh token anterior se invalida (rotación de tokens).

**Endpoint:** `POST /auth/refresh`

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response 200 (Éxito):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid-de-la-persona",
    "nombre": "Juan Pérez",
    "email": "usuario@ejemplo.com",
    "tipo": "PROTAGONISTA"
  }
}
```

**Errores:**
| Status | Descripción |
|--------|-------------|
| 401 | Token inválido, expirado o ya usado |

**Importante:** Después de usar un refresh token, ese token queda invalidado. Siempre guardá el nuevo refresh token que te devuelve el endpoint.

---

### 4. Logout

Cierra la sesión revocando el refresh token.

**Endpoint:** `POST /auth/logout`

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response 204 (Éxito):**
Sin contenido.

**Errores:**
| Status | Descripción |
|--------|-------------|
| 401 | No autenticado (falta access token o es inválido) |

**Nota:** Si no enviás el refresh token en el body, se revocan TODOS los refresh tokens del usuario (logout de todas las sesiones).

---

### 5. Obtener Perfil del Usuario Actual

Retorna la información del usuario autenticado.

**Endpoint:** `GET /auth/me`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response 200 (Éxito):**
```json
{
  "id": "uuid-de-la-persona",
  "nombre": "Juan Pérez",
  "email": "usuario@ejemplo.com",
  "tipo": "PROTAGONISTA"
}
```

**Errores:**
| Status | Descripción |
|--------|-------------|
| 401 | No autenticado |

---

### 6. Cambiar Contraseña

Cambia la contraseña del usuario autenticado. Requiere la contraseña actual.

**Endpoint:** `PATCH /auth/password`

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "currentPassword": "MiPasswordActual123!",
  "newPassword": "MiNuevoPassword456!"
}
```

**Validaciones:**
- `currentPassword`: Mínimo 8 caracteres
- `newPassword`: Mínimo 8 caracteres, máximo 128, debe ser diferente a la actual

**Response 204 (Éxito):**
Sin contenido.

**Errores:**
| Status | Descripción |
|--------|-------------|
| 400 | Nueva contraseña igual a la actual o muy corta |
| 401 | Contraseña actual incorrecta o no autenticado |

**Importante:** Después de cambiar la contraseña, TODOS los refresh tokens del usuario se invalidan. El usuario debe volver a hacer login.

---

## Implementación Recomendada en Frontend

### Almacenamiento de Tokens

```typescript
// Guardar tokens después de login/register/refresh
localStorage.setItem('accessToken', response.accessToken);
localStorage.setItem('refreshToken', response.refreshToken);

// Obtener tokens
const accessToken = localStorage.getItem('accessToken');
const refreshToken = localStorage.getItem('refreshToken');

// Limpiar tokens en logout
localStorage.removeItem('accessToken');
localStorage.removeItem('refreshToken');
```

### Interceptor HTTP (Angular)

```typescript
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private authService: AuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const accessToken = this.authService.getAccessToken();

    if (accessToken) {
      req = req.clone({
        setHeaders: {
          Authorization: `Bearer ${accessToken}`
        }
      });
    }

    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          return this.handle401Error(req, next);
        }
        return throwError(() => error);
      })
    );
  }

  private handle401Error(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return this.authService.refreshToken().pipe(
      switchMap((tokens) => {
        req = req.clone({
          setHeaders: {
            Authorization: `Bearer ${tokens.accessToken}`
          }
        });
        return next.handle(req);
      }),
      catchError((error) => {
        this.authService.logout();
        return throwError(() => error);
      })
    );
  }
}
```

### Servicio de Autenticación (Angular)

```typescript
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly API_URL = 'http://localhost:3001/api/v1/auth';

  constructor(private http: HttpClient, private router: Router) {}

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API_URL}/login`, { email, password }).pipe(
      tap(response => this.setTokens(response))
    );
  }

  register(personaId: string, email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API_URL}/register`, { personaId, email, password }).pipe(
      tap(response => this.setTokens(response))
    );
  }

  refreshToken(): Observable<AuthResponse> {
    const refreshToken = this.getRefreshToken();
    return this.http.post<AuthResponse>(`${this.API_URL}/refresh`, { refreshToken }).pipe(
      tap(response => this.setTokens(response))
    );
  }

  logout(): void {
    const refreshToken = this.getRefreshToken();
    this.http.post(`${this.API_URL}/logout`, { refreshToken }).subscribe();
    this.clearTokens();
    this.router.navigate(['/login']);
  }

  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.http.patch<void>(`${this.API_URL}/password`, { currentPassword, newPassword });
  }

  getMe(): Observable<AuthUser> {
    return this.http.get<AuthUser>(`${this.API_URL}/me`);
  }

  getAccessToken(): string | null {
    return localStorage.getItem('accessToken');
  }

  getRefreshToken(): string | null {
    return localStorage.getItem('refreshToken');
  }

  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }

  private setTokens(response: AuthResponse): void {
    localStorage.setItem('accessToken', response.accessToken);
    localStorage.setItem('refreshToken', response.refreshToken);
  }

  private clearTokens(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }
}
```

### Guard de Rutas (Angular)

```typescript
@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(): boolean {
    if (this.authService.isAuthenticated()) {
      return true;
    }
    this.router.navigate(['/login']);
    return false;
  }
}
```

---

## Flujo Completo de Sesión

```
┌─────────────────────────────────────────────────────────────┐
│                         INICIO                              │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  ¿Usuario tiene credenciales?                               │
│  (verificar si persona tiene email/password)                │
└─────────────────────────┬───────────────────────────────────┘
                          │
            ┌─────────────┴─────────────┐
            │                           │
            ▼ NO                        ▼ SÍ
┌───────────────────────┐    ┌───────────────────────┐
│  POST /auth/register  │    │  POST /auth/login     │
│  (crear credenciales) │    │  (autenticar)         │
└───────────┬───────────┘    └───────────┬───────────┘
            │                            │
            └─────────────┬──────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Guardar accessToken y refreshToken                         │
│  Redirigir a dashboard                                      │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  SESIÓN ACTIVA                                              │
│  - Usar accessToken en header Authorization                 │
│  - GET /auth/me para obtener datos del usuario              │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  ¿Request devuelve 401?                                     │
└─────────────────────────┬───────────────────────────────────┘
                          │
            ┌─────────────┴─────────────┐
            │                           │
            ▼ SÍ                        ▼ NO
┌───────────────────────┐    ┌───────────────────────┐
│  POST /auth/refresh   │    │  Continuar normal     │
│  (renovar tokens)     │    │                       │
└───────────┬───────────┘    └───────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│  ¿Refresh exitoso?                                          │
└─────────────────────────┬───────────────────────────────────┘
            │
            ┌─────────────┴─────────────┐
            │                           │
            ▼ SÍ                        ▼ NO
┌───────────────────────┐    ┌───────────────────────┐
│  Guardar nuevos       │    │  Limpiar tokens       │
│  tokens y reintentar  │    │  Redirigir a login    │
└───────────────────────┘    └───────────────────────┘
```

---

## Tipos TypeScript

```typescript
interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

interface AuthUser {
  id: string;
  nombre: string;
  email: string;
  tipo: 'PROTAGONISTA' | 'EDUCADOR' | 'EXTERNA';
}

interface LoginDto {
  email: string;
  password: string;
}

interface RegisterDto {
  personaId: string;
  email: string;
  password: string;
}

interface RefreshTokenDto {
  refreshToken: string;
}

interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}
```

---

## Testing con cURL

```bash
# 1. Login
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Password123!"}'

# 2. Request autenticado
curl http://localhost:3001/api/v1/personas \
  -H "Authorization: Bearer <access_token>"

# 3. Refresh token
curl -X POST http://localhost:3001/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refresh_token>"}'

# 4. Obtener perfil
curl http://localhost:3001/api/v1/auth/me \
  -H "Authorization: Bearer <access_token>"

# 5. Cambiar contraseña
curl -X PATCH http://localhost:3001/api/v1/auth/password \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"currentPassword":"Password123!","newPassword":"NewPassword456!"}'

# 6. Logout
curl -X POST http://localhost:3001/api/v1/auth/logout \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refresh_token>"}'
```

---

## Swagger / OpenAPI

La documentación interactiva está disponible en:
```
http://localhost:3001/api/docs
```

Ahí podés probar todos los endpoints directamente desde el navegador.
