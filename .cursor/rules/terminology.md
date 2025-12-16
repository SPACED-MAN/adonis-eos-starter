# Project Terminology Guide

## Purpose

This document clarifies terminology to avoid confusion between CMS industry terms and technical architecture terms.

---

## Core Terminology

### Use These Terms ✅

| Term                         | Meaning                                         | Location          | Technology     |
| ---------------------------- | ----------------------------------------------- | ----------------- | -------------- |
| **Admin** or **Admin Panel** | Content management interface where editors work | `inertia/admin/*` | React + ShadCN |
| **Public Site**              | What visitors see                               | `inertia/site/*`  | React          |
| **Server** or **API**        | Node.js/AdonisJS backend services               | `app/*`           | TypeScript     |
| **Module Renderers**         | SSR system for rendering content                | `app/modules/*`   | TypeScript     |
| **Client-side**              | Code that runs in the browser                   | `inertia/*`       | React/JSX      |
| **Server-side**              | Code that runs on Node.js                       | `app/*`           | TypeScript     |

### Avoid Ambiguous Terms ⚠️

| Ambiguous Term       | Why It's Confusing                         | Use Instead                      |
| -------------------- | ------------------------------------------ | -------------------------------- |
| "Backend"            | Could mean admin panel OR server code      | "Admin" or "Server"              |
| "Frontend"           | Could mean public site OR client code      | "Public Site" or "Client-side"   |
| "Backend UI"         | Unclear if admin panel or server rendering | "Admin Panel" or "Admin UI"      |
| "Frontend rendering" | Could mean client OR server rendering      | "Client-side rendering" or "SSR" |

---

## Rendering Strategies (Important!)

**There are TWO types of SSR in this project:**

### 1. React SSR (Inertia) - `inertia/site/*`

- **First render:** Server-side (React → HTML)
- **After hydration:** Client-side (React)
- **Runs on:** Both server AND browser (isomorphic)
- **SEO:** ✅ Excellent
- **Performance:** ✅ Fast initial load
- **Config:** Enabled via `config/inertia.ts`

```tsx
// inertia/site/pages/home.tsx
// This IS server-side rendered (React SSR)!
export default function Home() {
  return <div>Public Site</div>
}
```

### 2. Pure SSR (Modules) - `app/modules/*`

- **Render:** Server-side only (String generation)
- **Technology:** Pure TypeScript (not React)
- **Runs on:** Server only (never in browser)
- **Purpose:** Generate HTML for content blocks
- **Performance:** ✅ Very fast

```typescript
// app/modules/hero_module.ts
// Pure server-side string generation
protected renderHtml(): string {
  return `<section>...</section>`
}
```

### 3. Client-Only (Admin) - `inertia/admin/*`

- **Render:** Client-side only (no SSR)
- **Technology:** React
- **Runs on:** Browser only
- **SEO:** ❌ Not needed (behind auth)
- **Config:** Disabled via `pages: !page.startsWith('admin')`

```tsx
// inertia/admin/pages/dashboard.tsx
// This is NOT server-side rendered
export default function Dashboard() {
  return <div>Admin Panel</div>
}
```

### Summary Table

| Directory         | Rendering        | First Load       | Runs Where | SEO |
| ----------------- | ---------------- | ---------------- | ---------- | --- |
| `inertia/site/*`  | **React SSR** ✅ | Server → Browser | Both       | ✅  |
| `inertia/admin/*` | **CSR only** ❌  | Browser only     | Browser    | ❌  |
| `app/modules/*`   | **Pure SSR** ✅  | Server only      | Server     | N/A |

---

## Directory Structure with Clear Labels

```
project/
│
├── app/                              ← SERVER (Node.js)
│   ├── controllers/                  ← API endpoints
│   ├── models/                       ← Database models
│   ├── services/                     ← Business logic
│   ├── modules/                      ← SSR content renderers
│   └── actions/                      ← Complex operations
│
├── inertia/                          ← CLIENT (Browser)
│   ├── admin/                        ← ADMIN PANEL
│   │   ├── app.tsx                   ← Admin entrypoint
│   │   ├── components/
│   │   │   ├── ui/                   ← ShadCN components
│   │   │   └── modules/              ← Module editor components
│   │   └── pages/                    ← Admin pages
│   │       ├── dashboard.tsx
│   │       ├── login.tsx
│   │       └── posts/
│   │           └── edit.tsx
│   │
│   └── site/                         ← PUBLIC SITE
│       ├── app.tsx                   ← Public entrypoint
│       └── pages/                    ← Public pages
│           └── home.tsx
│
└── resources/
    └── views/                        ← Edge templates
```

---

## Usage Examples

### ✅ Correct Usage

**In code comments:**

```typescript
// Admin panel component for editing hero modules
// inertia/admin/components/modules/forms/HeroModuleForm.tsx

// Server-side API endpoint for creating posts
// app/controllers/posts_controller.ts

// Client-side public site navigation
// inertia/site/components/Navigation.tsx

// SSR renderer for hero content on public site
// app/modules/hero_module.ts
```

**In documentation:**

- "The admin panel is built with React and ShadCN"
- "The public site uses SSR for performance"
- "Server-side validation happens in actions"
- "Client-side forms use React Hook Form"

**In discussions:**

- "Let's add a new form to the admin panel"
- "The public site needs better SEO"
- "We need to optimize the server API"
- "Client-side navigation is smooth"

### ❌ Incorrect Usage (Ambiguous)

**Avoid these:**

- "The backend needs styling" (Admin panel? Server code?)
- "Frontend performance is slow" (Public site? Client code?)
- "Backend rendering is broken" (Admin UI? Server rendering?)
- "Let's add this to the frontend" (Public site? Any client code?)

---

## The Two Systems

### System 1: Content Management (Admin Panel)

**Purpose:** Where content editors work

**Location:** `inertia/admin/*`

**Technology:** React + ShadCN (client-side)

**User:** Content editors, administrators

**Features:**

- Post editor
- Module configuration
- User management
- Dashboard/analytics
- Media library

**Example:**

```tsx
// inertia/admin/pages/posts/edit.tsx
export default function EditPost({ post }) {
  return (
    <div>
      <h1>Edit Post - Admin Panel</h1>
      <ModulePicker />
      <Button>Publish</Button>
    </div>
  )
}
```

### System 2: Public Site

**Purpose:** What visitors see

**Location:** `inertia/site/*` + rendered content

**Technology:** React + SSR (client-side + server-rendered)

**User:** Public visitors

**Features:**

- Home page
- Blog posts
- Pages
- Navigation
- Forms (contact, newsletter, etc.)

**Example:**

```tsx
// inertia/site/pages/home.tsx
export default function Home() {
  return (
    <div>
      <Navigation />
      <Hero />
      <BlogPosts />
    </div>
  )
}
```

### System 3: Server (API & Rendering)

**Purpose:** Business logic, data persistence, SSR

**Location:** `app/*`

**Technology:** TypeScript/Node.js (server-side)

**User:** N/A (internal system)

**Features:**

- REST API endpoints
- Database models
- Module renderers (SSR)
- Authentication
- Validation

**Example:**

```typescript
// app/modules/hero_module.ts
// Server-side renderer for public site content
class HeroModule extends BaseModule {
  protected renderHtml(props, context): string {
    return `<section>...</section>`
  }
}
```

---

## Common Scenarios

### Scenario 1: Adding a New Admin Feature

**Say:** "Add a new page to the admin panel"

**Location:** `inertia/admin/pages/`

**Technology:** React + ShadCN

**Example:**

```tsx
// inertia/admin/pages/settings.tsx
// Admin panel settings page
export default function Settings() {
  return <div>Admin Settings</div>
}
```

### Scenario 2: Improving Public Site

**Say:** "Optimize the public site performance"

**Location:** `inertia/site/*` or `app/modules/*`

**Technology:** React (client) + TypeScript (SSR)

**Example:**

```typescript
// app/modules/hero_module.ts
// Optimize SSR for public site
protected renderHtml(props, context): string {
  // Faster rendering logic
}
```

### Scenario 3: Adding API Endpoint

**Say:** "Add a server endpoint for posts"

**Location:** `app/controllers/`

**Technology:** TypeScript/AdonisJS

**Example:**

```typescript
// app/controllers/posts_controller.ts
// Server API endpoint
export default class PostsController {
  async store({ request }: HttpContext) {
    // Server-side logic
  }
}
```

### Scenario 4: Adding UI Component

**Context matters!**

**For admin panel:**

- "Add a UI component to the admin panel"
- Location: `inertia/admin/components/`

**For public site:**

- "Add a UI component to the public site"
- Location: `inertia/site/components/`

---

## When Discussing Architecture

### Client vs Server

Use these terms when discussing technical architecture:

- **Client-side:** Code that runs in the browser
  - All of `inertia/*` (both admin and site)
  - React, JSX, ShadCN
  - Browser APIs, localStorage, etc.

- **Server-side:** Code that runs on Node.js
  - All of `app/*`
  - TypeScript, Lucid ORM, etc.
  - File system, database, etc.

### Admin vs Public

Use these terms when discussing user-facing features:

- **Admin Panel:** Content management interface
  - `inertia/admin/*`
  - For content editors
  - Behind authentication

- **Public Site:** Visitor-facing website
  - `inertia/site/*` + rendered content
  - For end users
  - Publicly accessible

---

## Glossary

| Term                | Definition                       | Example                             |
| ------------------- | -------------------------------- | ----------------------------------- |
| **Admin Panel**     | Content management interface     | Post editor, dashboard              |
| **Public Site**     | What visitors see                | Home page, blog posts               |
| **Client-side**     | Runs in browser                  | React components, ShadCN            |
| **Server-side**     | Runs on Node.js                  | Controllers, models, SSR            |
| **SSR**             | Server-Side Rendering            | Module HTML generation              |
| **CSR**             | Client-Side Rendering            | React hydration                     |
| **Module Renderer** | Generates HTML for content       | `app/modules/hero_module.ts`        |
| **Module Editor**   | Admin UI for configuring modules | `inertia/admin/components/modules/` |
| **API**             | Server endpoints                 | Controllers, routes                 |
| **Model**           | Database representation          | `app/models/post.ts`                |
| **Action**          | Business logic class             | `app/actions/posts/create_post.ts`  |
| **Service**         | Reusable server logic            | `app/services/module_renderer.ts`   |

---

## Quick Decision Tree

**"Where should this code go?"**

```
Is it for content editors?
├─ YES → inertia/admin/*          (Admin Panel - React)
└─ NO
   └─ Is it for public visitors?
      ├─ YES → inertia/site/*     (Public Site - React)
      └─ NO
         └─ Does it handle HTTP requests?
            ├─ YES → app/controllers/*  (Server API)
            └─ NO
               └─ Does it render content HTML?
                  ├─ YES → app/modules/*  (SSR Renderers)
                  └─ NO
                     └─ Business logic? → app/actions/* or app/services/*
```

---

## Related Guidelines

- [Conventions](.cursor/rules/conventions.md) - Code style
- [Modules](.cursor/rules/modules.md) - Module system
- [Actions](.cursor/rules/actions.md) - Business logic patterns
- [Testing](.cursor/rules/testing.md) - Testing strategies

---

## Summary

**Always be specific:**

- ✅ "Admin panel", "Public site", "Server", "Client-side"
- ❌ "Backend", "Frontend" (too ambiguous)

**When in doubt:**

- Specify the directory: `inertia/admin/*` vs `app/*`
- Specify the technology: React vs TypeScript
- Specify the user: Content editor vs Public visitor

This keeps communication clear and avoids confusion between CMS industry terms and technical architecture terms.
