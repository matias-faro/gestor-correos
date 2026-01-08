# Gestor de Correos

Sistema de gestión de campañas de email para Gmail.

## Stack

- **Framework**: Next.js 16 (App Router) + TypeScript
- **Estilos**: Tailwind CSS 4 + shadcn/ui
- **Auth/DB**: Supabase (Auth con Google + Postgres)
- **Iconos**: Tabler Icons

## Configuración inicial

### 1. Variables de entorno

Copiá `env.example` a `.env.local` y completá las variables:

```bash
cp env.example .env.local
```

### 2. Configurar Supabase

1. Creá un proyecto en [Supabase](https://supabase.com)
2. Obtené las credenciales desde Settings > API:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

### 3. Configurar Google OAuth

1. Andá a [Google Cloud Console](https://console.cloud.google.com)
2. Creá un proyecto nuevo o usá uno existente
3. Habilitá la Gmail API
4. Creá credenciales OAuth 2.0:
   - Tipo: Web application
   - Authorized redirect URI: `https://TU_PROYECTO.supabase.co/auth/v1/callback`
5. Agregá los scopes de Gmail:
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.modify`

### 4. Configurar Provider en Supabase

1. En Supabase Dashboard: Authentication > Providers > Google
2. Activá el provider y pegá Client ID y Secret
3. Agregá los scopes adicionales de Gmail

### 5. Ejecutar migraciones

Ejecutá el archivo SQL en `supabase/migrations/001_initial_schema.sql` desde el SQL Editor de Supabase.

### 6. Ejecutar la app

```bash
pnpm install
pnpm dev
```

La app estará disponible en http://localhost:3000

## Estructura del proyecto

```
app/
├── (app)/           # Rutas protegidas (dashboard, contactos, etc.)
├── (auth)/          # Login
├── (public)/        # Páginas públicas (unsubscribe)
└── api/             # Route handlers

components/
├── ui/              # Componentes shadcn
├── app-sidebar.tsx
└── app-header.tsx

lib/
└── supabase/        # Clientes Supabase

server/
└── auth/            # Validación de sesión

supabase/
└── migrations/      # Schema SQL
```

## Próximas fases

- **Fase 2**: CRUD contactos + tags + segmentación
- **Fase 3**: Plantillas HTML + preview
- **Fase 4**: Campañas + snapshot + pruebas
- **Fase 5**: QStash + SendTick + envío
- **Fase 6**: Unsubscribe público
- **Fase 7**: Rebotes + supresión
