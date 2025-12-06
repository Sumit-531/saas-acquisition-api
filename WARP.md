# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Commands

### Install dependencies
- `npm install`

### Run the API locally
- `npm run dev`
  - Starts Node in watch mode from `src/index.js`, which loads `src/server.js` and the Express app in `src/app.js`.

### Linting and formatting
- `npm run lint`
  - Runs ESLint using `eslint.config.js`.
- `npm run lint:fix`
  - Runs ESLint with auto-fix.
- `npm run format`
  - Formats the codebase with Prettier using `.prettierrc`.
- `npm run format:check`
  - Checks formatting without writing changes.

### Database and migrations (Drizzle + Neon Postgres)
- Ensure `DB_URI` is set in your environment (e.g. via `.env`) to a valid Postgres connection string for Neon.
- `npm run db:generate`
  - Uses `drizzle.config.js` and the schemas in `src/models/*.js` to generate SQL migrations into the `drizzle/` directory.
- `npm run db:migrate`
  - Applies the generated migrations to the database referenced by `DB_URI`.
- `npm run db:studio`
  - Opens Drizzle Studio connected to the same database.

### Testing
- No test runner or `npm test` script is currently configured.
- `eslint.config.js` defines globals for `tests/**/*.js`, but there are no test files or tooling wired up yet.

### Environment variables
- `DB_URI`: Postgres connection string used by Neon/Drizzle.
- `JWT_SECRET`: Secret key for signing JWTs (falls back to a hard-coded development default if unset; override in real environments).
- `LOG_LEVEL`: Winston log level (defaults to `info`).
- `NODE_ENV`: Standard Node environment; enables console logging when not `production`.
- `PORT`: Port for the HTTP server (defaults to `3000`).

## Architecture overview

### Runtime stack and entrypoints
- Node.js ESM project (`"type": "module"` in `package.json`) using Express for HTTP routing.
- `src/index.js`
  - Loads environment variables via `dotenv` and imports `src/server.js`.
- `src/server.js`
  - Boots the Express app from `src/app.js` and listens on `PORT` (or `3000`).
- `src/app.js`
  - Creates the Express app, wires core middleware, and mounts routes:
    - Security and parsing: `helmet`, `cors`, `express.json`, `express.urlencoded`, `cookie-parser`.
    - HTTP logging: `morgan` writing into the shared Winston logger.
    - Basic endpoints: `/` (hello), `/health` (status, timestamp, uptime), and `/api` (simple JSON status).
    - API routes: mounts `/api/v1/auth` via `authRoutes`.

### Module resolution and directory structure
- `package.json` defines ESM import aliases via the `imports` field:
  - `#config/*` → `./src/config/*`
  - `#controllers/*` → `./src/controllers/*`
  - `#middleware/*` → `./src/middleware/*`
  - `#models/*` → `./src/models/*`
  - `#routes/*` → `./src/routes/*`
  - `#utils/*` → `./src/utils/*`
  - `#validations/*` → `./src/validations/*`
  - `#services/*` → `./src/services/*`
- New modules should follow this alias pattern so imports stay consistent and relative paths are avoided.

### Configuration layer
- `src/config/database.js`
  - Creates a Neon HTTP client using `DB_URI` and exposes a Drizzle ORM instance `db`.
  - All database access should go through this `db` instance.
- `src/config/logger.js`
  - Configures a Winston logger with JSON output and timestamps.
  - Writes logs to `logs/error.log` (errors only) and `logs/combined.log` (all levels).
  - In non-production environments (`NODE_ENV !== 'production'`), also logs to the console with colorized, human-readable output.

### Persistence and migrations
- `src/models/user.model.js`
  - Defines the `users` table with Drizzle `pgTable`:
    - `id` primary key, `name`, unique `email`, hashed `password`, `role` (default `user`), `created_at`, `updated_at`.
- `drizzle.config.js`
  - Points `schema` at `./src/models/*.js` and outputs generated migrations into `./drizzle`.
  - Uses `DB_URI` from the environment and `dialect: 'postgresql'`.

### HTTP and logging pipeline
- Requests enter through Express in `src/app.js`.
- Helmet, CORS, JSON/body parsing, and cookie parsing are applied globally.
- `morgan` logs each HTTP request using the `combined` format but writes to the shared Winston logger rather than `stdout` directly.
- Business logs (e.g. user signup events, DB operation errors, JWT failures) are sent through the same Winston logger for consistent log handling.

### Auth module pattern
- The auth functionality illustrates the intended layering pattern (route → controller → service → model/DB → utilities/validation).

#### Routes
- `src/routes/auth.routes.js`
  - Exposes `/api/v1/auth` subroutes:
    - `POST /sign-up` → `signup` controller.
    - `POST /sign-in` and `POST /sign-out` are currently simple placeholders returning static responses.

#### Controller
- `src/controllers/auth.controller.js`
  - `signup(req, res, next)` flow:
    - Validates `req.body` with `signupSchema` from `src/validations/auth.validation.js`.
    - On validation failure, responds with HTTP 400 and a normalized error message from `formatValidationError`.
    - On success, calls `createUser` from `src/services/auth.service.js` with the validated data.
    - Generates a JWT via `jwtToken.sign` and stores it in an HTTP-only cookie using the `cookies.set` helper.
    - Logs the successful registration and returns a 201 response with a safe subset of user fields (no password).
    - On known conflicts (e.g. email already exists), returns an appropriate error status; otherwise delegates to Express error handling via `next(e)`.

#### Service and data access
- `src/services/auth.service.js`
  - `hashedPassword(password)` wraps `bcrypt.hash`, logs any hashing failures, and throws on error.
  - `createUser({ name, email, password, role })`:
    - Queries the `users` table via Drizzle to check for an existing user with the same email.
    - If a user already exists, throws an error to signal conflict to the controller.
    - Hashes the plaintext password.
    - Inserts a new row into `users` and returns a subset of columns (`id`, `name`, `email`, `role`, `created_at`).
    - Logs successful creation and logs/propagates DB errors.
- All direct SQL/table interactions are encapsulated here and in the Drizzle model definitions, keeping controllers free of raw queries.

#### Validation
- `src/validations/auth.validation.js`
  - `signupSchema` and `signinSchema` are Zod object schemas defining required fields, lengths, and allowed roles.
  - These schemas centralize request-body validation rules for auth-related endpoints.

#### Utilities
- `src/utils/cookies.js`
  - Provides a single source of truth for cookie options (HTTP-only, secure in production, `sameSite: 'strict'`, 15-minute max age).
  - Offers `set`, `clear`, and `get` helpers that wrap Express `res.cookie`, `res.clearCookie`, and `req.cookies`.
- `src/utils/jwt.js`
  - Wraps `jsonwebtoken` with a fixed expiration (`1d`) and shared secret (`JWT_SECRET` env var or a development fallback).
  - Exposes `jwtToken.sign` and `jwtToken.verify`, both of which log and throw on failure using the shared Winston logger.
- `src/utils/format.js`
  - Normalizes Zod validation errors into either a comma-separated list of messages or a stringified error object.

### Linting and formatting configuration
- `eslint.config.js`
  - Extends the official `@eslint/js` recommended config and enforces a 2-space indent, Unix line endings, single quotes, and semicolons.
  - Disallows unused variables (with support for intentionally unused args prefixed with `_`) and various stylistic issues.
  - Defines a separate config block for `tests/**/*.js` with test-related globals (e.g. `describe`, `it`, `expect`), but there are currently no tests.
  - Ignores `node_modules`, `coverage`, `logs`, and `drizzle` directories.
- `.prettierrc`
  - Configures Prettier with 2-space indentation, single quotes, `semi: true`, `trailingComma: 'es5'`, `printWidth: 80`, and `endOfLine: 'lf'`.