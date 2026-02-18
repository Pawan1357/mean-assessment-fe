# Assessment Frontend (Angular)

## Overview
This frontend implements the assessment UI using Angular feature modules and shared state across tabs.

Key capabilities:
- Two-tab workflow (`Property Details`, `Underwriting`)
- Shared in-memory draft across tabs (no state loss on tab switch)
- Save and Save As actions wired to backend
- Unsaved-change warning on route leave and browser refresh/close
- Client-side validations aligned with backend business rules
- Generic backend response envelope handling (`{ success, data }`)

## Tech Stack
- Angular 18
- Reactive forms
- RxJS state via service-based store
- Karma + Jasmine

## Project Structure
- `src/app/app.module.ts`: root module
- `src/app/app-routing.module.ts`: app routes + guard
- `src/app/core/`: singleton models/services/state/guards/validators
- `src/app/shared/`: shared Angular module imports
- `src/app/features/shell/`: tab shell + save actions + error banner
- `src/app/features/property-details/`: details tab
- `src/app/features/underwriting/`: underwriting tab

## How It Works
1. App loads default version (`1.1`) for `property-1`.
2. Both tabs read/write the same draft in `PropertyStoreService`.
3. `Save` validates the draft client-side, then sends full payload.
4. `Save As` clones current backend version to next semantic version.
5. Any backend error is shown in shell error banner.

## Backend Contract Expected
The frontend expects backend success envelope:
```json
{
  "success": true,
  "data": {}
}
```

`PropertyApiService` unwraps `response.data` for all requests.

## Setup
### Prerequisites
- Node.js 20+
- npm
- Backend running at `http://localhost:3000`

### Run
1. `npm install`
2. `npm run start`
3. Open `http://localhost:4200`

## Build & Test
- Build: `npm run build`
- Test + coverage: `npm test`

## Functional Behavior
- Property address is displayed read-only.
- Tenant grid prevents direct edit of vacant/deleted rows.
- Save includes data from both tabs.
- Unsaved warning is shown when navigating away.

## Client-Side Validations
Implemented in `src/app/core/validators/property-validation.util.ts`:
- Building size must be `> 0`
- Underwriting start date valid
- Hold period years `> 0`
- Broker email/name/phone/company validity
- Unique broker IDs
- Unique non-vacant tenant IDs
- Total active tenant SF `<= property space`
- Lease start >= property start
- Lease end <= lease start + hold period
- `vacant-row` tampering blocked client-side

## Assumptions
- Single-user assessment mode
- No auth flow in scope
- Backend is primary source of truth for persisted invariants
- API base path is `/api/properties`

## Notes for Separate Repo Usage
If frontend is hosted in a different repo/deployment than backend:
- Configure proxy or API base URL strategy for `/api` routing.
- Ensure CORS is enabled on backend if calling cross-origin.
