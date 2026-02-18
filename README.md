# Assessment Frontend (Angular)

## Purpose

Two-tab UI for the assessment (`Property Details`, `Underwriting`) with shared draft state and version-aware save workflows.

## Current Architecture

- `src/app/core`: API client, state store, guards, validators, models, error parsing.
- `src/app/features/shell`: tabs, version selector, main save/save-as, top-level success/error banners.
- `src/app/features/property-details`: property fields, broker CRUD, lease abstract view.
- `src/app/features/underwriting`: underwriting inputs, tenant CRUD.
- `src/app/shared`: shared Angular imports.

State management:

- `PropertyStoreService` is the single source of truth for loaded version, draft edits, dirty state, validation, and server field errors.

## Behavior Implemented

- Shared state across tabs without losing unsaved edits.
- Main `Save` sends one combined payload for both tabs.
- Main `Save As` sends current form snapshot and creates next version.
- Historical versions are read-only in UI.
- Broker and tenant row-level create/update/delete actions.
- Unsaved change warnings on route navigation and browser refresh/close.
- Backend success/error messages are surfaced in UI.

## Backend Contract Used

Base path: `/api/properties`

- `GET /:propertyId/versions`
- `GET /:propertyId/versions/:version`
- `PUT /:propertyId/versions/:version`
- `POST /:propertyId/versions/:version/save-as`
- `POST|PUT|DELETE /:propertyId/versions/:version/brokers...`
- `POST|PUT|DELETE /:propertyId/versions/:version/tenants...`

Expected response envelope:

```json
{
  "success": true,
  "message": "Request processed successfully",
  "data": {}
}
```

## Local Run

1. Ensure backend is running on `http://localhost:3000`.
2. `npm install`
3. `npm start`
4. Open `http://localhost:4200`

API proxy:

- `src/environments/environment.ts` has `apiBaseUrl: ''`
- `proxy.conf.json` forwards `/api` to backend

## Testing

- Unit tests + coverage: `npm test`
- Production build: `npm run build`

## Assumptions

- Single-user assessment mode.
- Auth and roles are out of scope.
- Backend is authoritative for final validation and persistence.
