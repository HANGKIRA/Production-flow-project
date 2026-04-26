# Production Flow Portal

Dependency-free Node app with strict admin-only financial APIs.

## Run

```powershell
node server.js
```

Open `http://localhost:3000`.

## Demo Users

- Admin: `admin` / `admin123`
- Staff: `staff` / `staff123`
- Designer: `designer` / `designer123`

## Security Boundary

- Staff and Designer use `/api/orders`, which returns production fields only.
- Financial data lives behind `/api/admin/*`.
- `/api/admin/*` requires an authenticated `ADMIN` role on the backend.
- Cost, sales, and profit are calculated server-side and are never included in non-admin order responses.
