# app-gestor-obra

App de gestión de obras de construcción. Interfaz en español, formato numérico argentino.

## Regla crítica
**NUNCA hacer commit ni push a GitHub sin aprobación explícita del usuario.**

## Stack
- Next.js 14 App Router + TypeScript strict
- Supabase (PostgreSQL + Auth + Storage)
- Tailwind CSS 3.4 + clases utilitarias custom en globals.css
- React hooks (sin global state manager)

## IDs en base de datos
Todos los IDs son **TEXT**, no UUID. Nunca usar `UUID` en SQL ni en tipos TypeScript.

## Estructura de carpetas
- `src/app/(dashboard)/dashboard/` — páginas del dashboard (todas "use client")
- `src/lib/mock-db.ts` — ÚNICA fuente de queries Supabase (nunca query directo desde páginas)
- `src/lib/projects-db.ts` — funciones de proyectos y miembros
- `src/lib/permissions.ts` — árbol de permisos, helpers canView/canEdit
- `src/types/project.ts` — interfaces principales del dominio
- `src/components/shared/` — sidebar, header, shell
- `src/features/{domain}/components/` — componentes por feature

## Patrón de página
Toda página del dashboard sigue este esquema:
1. `"use client"` al tope
2. `const perms = loadPermissionsCache()` para permisos
3. `const [loading, setLoading] = useState(true)` + useEffect para cargar datos
4. `const load = useCallback(async () => { ... }, [])` para refrescar
5. Init: getUser() → setRole/setUserName → load()
6. Header: `<p className="page-eyebrow">Sección</p><h1 className="page-title">Título</h1>`
7. Envolver contenido en `<div className="page-wrap space-y-6">`

## Patrón de datos (mock-db.ts)
Toda entidad sigue:
- Mapper: `function mapFoo(r: Record<string, unknown>): Foo` — snake_case → camelCase
- `getXxx(): Promise<Xxx[]>` — SELECT con filtro project_id
- `addXxx(data): Promise<Xxx>` — INSERT + return mapeado
- `updateXxx(id, data): Promise<void>` — UPDATE
- `deleteXxx(id): Promise<void>` — DELETE

## Permisos
- Leer: `const perms = loadPermissionsCache()`
- Verificar vista: `canView(perms, "key")`
- Verificar edición: `canEdit(perms, "key")`
- Para secciones con múltiples keys: `sectionVisible(perms, "key1", "key2")`
- Nueva sección: agregar a PERM_TREE + HREF_TO_PERM_KEYS en `src/lib/permissions.ts`
- Sidebar: `sectionVisible()` ya está integrado — solo agregar el nav item

## CSS: clases custom disponibles
- Contenedor: `page-wrap`, `card-obra`
- Títulos: `page-eyebrow`, `page-title`, `page-subtitle`, `section-title`
- Botones: `proj-btn-primary`, `proj-btn-secondary`, `proj-btn-ghost`
- KPIs: `stat-card stat-card-accent-{blue|green|orange|red}`, `stat-card-label`, `stat-card-value`
- Colores: variables CSS `--sand-*`, `--clay-*`, `--stone-*`, `--cream`

## Iconos
- Usar exclusivamente `lucide-react` (ya instalado)
- Tamaños estándar: `size={16}` inline en texto, `size={18}` en botones, `size={20}` en acciones standalone
- Color: se hereda del texto por defecto; para acentuar usar `className="text-clay-500"`
- No usar SVG inline salvo en el sidebar (donde ya existen por razones de tamaño)

## Jerarquía de botones
- `proj-btn-primary`: acción principal única por sección (guardar, confirmar, agregar)
- `proj-btn-secondary`: acción secundaria (cancelar, exportar, volver)
- `proj-btn-ghost`: acción contextual en tablas, listas o cards (editar, eliminar fila)
- Máximo 1 `proj-btn-primary` visible por vista; el resto deben ser secondary o ghost

## Tipografía — cuándo usar cada clase
- `page-eyebrow`: etiqueta de contexto sobre el título (ej: "Sección" o nombre de proyecto) — siempre en par con `page-title`
- `page-title`: título principal de la página — 1 por página
- `page-subtitle`: descripción breve debajo del título, opcional
- `section-title`: encabezado de subsección dentro de la página (ej: "Movimientos recientes")
- No usar `<h2>` / `<h3>` con clases Tailwind ad-hoc — siempre usar las clases custom

## Colores semánticos
- `clay-*`: acciones primarias, botones activos, sidebar activo, links de navegación
- `sand-*`: fondos neutros, bordes, separadores, fondos de inputs
- `stone-*`: texto principal (`stone-800/900`), fondos oscuros (sidebar usa `stone-900`)
- `cream / cream-dark`: fondo general de la app y secciones destacadas (daily-box)
- Estados con semántica fija:
  - `badge-pending` → naranja — pendiente
  - `badge-progress` → azul — en proceso
  - `badge-done` → verde — completado
  - `badge-blocked` → rojo — bloqueado
- Nunca hardcodear colores hex en `className` — usar siempre variables CSS o clases Tailwind mapeadas

## Estados de carga
- Estado inicial: `const [loading, setLoading] = useState(true)`
- Mientras carga, mostrar:
  ```tsx
  {loading && (
    <div className="flex justify-center py-10 text-stone-400 text-sm">Cargando...</div>
  )}
  ```
- Para skeletons usar `animate-pulse bg-sand-100 rounded` con alto fijo
- No bloquear toda la página con un spinner global — mostrar loading por sección

## Manejo de errores
- Operaciones CRUD siempre en `try/catch`: capturar el error, loguearlo con `console.error`, y mostrar mensaje al usuario
- No usar `window.alert()` — mostrar error con estado local:
  ```tsx
  const [error, setError] = useState<string | null>(null)
  // en catch: setError("No se pudo guardar. Intentá de nuevo.")
  // en render: {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
  ```
- Limpiar el error al iniciar una nueva operación: `setError(null)` antes del `try`

## Estados vacíos
- Usar `<EmptyState>` de `src/components/shared/empty-state.tsx` cuando una lista no tiene items
- No inventar estados vacíos inline con JSX propio
- Props: `message` (texto) y opcionalmente `action` (botón de CTA)

## Modales
- Overlay: `className="cal-modal-overlay"` (cubre toda la pantalla con fondo semitransparente)
- Contenedor: `className="cal-modal"` para modales medianos, o `card-obra p-6` para panels pequeños
- Siempre manejar cierre con:
  1. Botón "×" o "Cancelar" explícito
  2. Click en overlay: `onClick={() => onClose()}`
  3. Escape: `useEffect(() => { const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }; window.addEventListener("keydown", fn); return () => window.removeEventListener("keydown", fn) }, [])`

## Supabase Storage
- Buckets disponibles: `photos`, `invoices`, `documents`
- Todos los buckets deben ser **Public: ON**
- Upload path: `{projectId}/{uuid}.{ext}`
- URL: `supabase.storage.from("bucket").getPublicUrl(path).data.publicUrl`

## ESLint — errores que rompen el build en Vercel
- No usar ternarios como statement: `x ? a() : b()` → usar `if (x) { a() } else { b() }`
- No usar `let` si la variable no se reasigna → usar `const`
- Verificar con `npm run lint` antes de cada push

## RLS Policy (Supabase)
Usar la forma simple que funciona con este modelo de auth:
```sql
CREATE POLICY "authenticated access" ON tabla
FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

## Formato numérico (Argentina)
- Usar `parseNum()` de `src/lib/parseNum.ts` para parsear strings numéricos del usuario
- Formatear con `new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" })`

## Nuevo sidebar item
Agregar en `FULL_ACCESS_NAV` Y en el array del rol supervisor en `app-sidebar.tsx`.
