# Assessment Frontend (Angular)

## 1) Purpose
This app implements the assessment UI for a versioned property underwriting workflow.

It focuses on:
- clean Angular feature-oriented architecture
- shared state across tabs
- strict integration with backend REST APIs
- save/save-as version workflows
- validation UX + backend error surfacing

---

## 2) Deliverables Coverage (from `requirements.txt`)
Implemented in frontend:
- two-tab experience (`Property Details`, `Underwriting`) on shared property state
- editable fields (except address)
- broker CRUD UI
- tenant CRUD UI + read-only lease abstract in property details
- Save and Save As actions
- unsaved changes warning on navigation and browser refresh/close
- backend validation/success message handling in UI
- historical versions rendered read-only

---

## 3) Tech Stack
- Angular 18
- RxJS
- Jasmine + Karma

---

## 4) Frontend Architecture

### Modules
- `src/app/core`: app-wide state, API services, guards, validators, models
- `src/app/features/shell`: top nav, version selector, save actions, banners
- `src/app/features/property-details`: property detail + broker UI + lease abstract
- `src/app/features/underwriting`: underwriting assumptions + tenant UI
- `src/app/shared`: shared Angular imports

### State Management
`PropertyStoreService` is the single source of truth for:
- selected property version snapshot
- unsaved draft changes across tabs
- versions list
- dirty flag
- client validation errors
- backend field-level errors

---

## 5) Behavior Summary
- Switching tabs does not lose unsaved edits.
- Save sends full payload from both tabs.
- Save As sends full current form snapshot and creates a new version.
- Historical versions are non-editable in UI.
- Broker/Tenant row actions call dedicated APIs.
- Success banner auto-hides.
- Backend errors show in banner and mapped field-level hints (where possible).

---

## 6) Backend API Contract Used
Base path: `/api/properties`

Used endpoints:
- `GET /:propertyId/versions`
- `GET /:propertyId/versions/:version`
- `PUT /:propertyId/versions/:version`
- `POST /:propertyId/versions/:version/save-as`
- `POST/PUT/DELETE brokers`
- `POST/PUT/DELETE tenants`

Response envelope expected:
```json
{
  "success": true,
  "message": "Request processed successfully",
  "data": {}
}
```

---

## 7) Local Setup

### Prerequisites
- Node.js 20+
- Backend running on `http://localhost:3000`

### Steps
1. `npm install`
2. `npm start`
3. Open `http://localhost:4200`

### API Base URL / Proxy
- `src/environments/environment.ts` uses `apiBaseUrl: ''`
- Angular dev server proxy forwards `/api` to `http://localhost:3000`
- Proxy config: `proxy.conf.json`

---

## 8) Validation Handling

### Client-side
- Draft-level rules in `core/validators/property-validation.util.ts`
- Immediate input-level restrictions for number/date fields where applicable

### Server-side (authoritative)
- All business rules and DTO constraints are enforced by backend.
- UI displays backend messages and field hints from server responses.

---

## 9) Key User Flows
1. Load latest version.
2. Edit fields in both tabs.
3. Save current version.
4. Save As new semantic version.
5. Manage brokers/tenants.
6. Review read-only historical versions.

---

## 10) Testing
- Unit tests + coverage: `npm test`
- Production build: `npm run build`

---

## 11) Assumptions
- Single-user assessment mode.
- Auth/roles are out of scope.
- Backend is source of truth for final validation and persistence.
- Error-to-field mapping is best-effort based on backend error message format.
