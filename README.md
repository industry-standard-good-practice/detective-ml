# Detective ML

A detective mystery game powered by AI. Monorepo containing the frontend web app and backend API service.

## Structure

```
detective-ml/
├── frontend/     ← React + Vite web application
├── backend/      ← Express API server (Firebase proxy)
└── docs/         ← Reference documentation
```

## Quick Start

```bash
# Install all dependencies
npm install

# Run frontend only
npm run dev

# Run backend only
npm run dev:backend

# Run both (concurrent)
npm run dev:all
```

## Documentation

- [Backend API Reference](./backend/README.md)
- [API Spec (OpenAPI)](./backend/openapi.yaml)
- [Firebase Migration Notes](./docs/FIREBASE_MIGRATION.md)
