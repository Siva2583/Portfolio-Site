# Siva Charan — Engineering Portfolio

A responsive engineering portfolio and private contact inbox for **Siva Charan — Software Engineer & Systems Builder**. The site keeps the original repository simple (static HTML/CSS/JavaScript) while adding dedicated case studies, bounded interactive demos, a Vercel serverless contact API, and an authenticated admin inbox.

## What’s in the build

- Homepage that introduces the role, engineering focus, four projects, experience, education, skills, credentials, and social profiles.
- Four dedicated case-study pages: RevertPay, AlgoViz 2.0, Voyager, and EDU2JOB.
- Accessible command palette (`Ctrl+K` / `⌘K`), keyboard navigation, recruiter quick view, and low-friction project navigation.
- Local portfolio-only demonstrations for escrow ledger movements, recorded algorithm frames, a Voyager mock itinerary, and EDU2JOB feature preprocessing.
- A real contact API designed for Supabase/Postgres persistence and Resend notification. If it is not configured, the form shows an honest failure and a direct email link; it never displays a false “sent” state.
- A private `/admin/inbox` with Supabase Auth, server-checked admin membership, HttpOnly session cookies, status management, deletion, and server-side email replies.
- SEO metadata, a sitemap, a robots file, security headers, reduced-motion styles, and no client-side analytics.

## Owner’s guide

For setup, local run commands, personal-info edits, replacing the Recruiter Mode initials with your own photo, and deployment checks, see the editable [Portfolio Owner Guide](docs/PORTFOLIO-OWNER-GUIDE.md).

## Architecture

```text
Browser
  ├─ Static portfolio: HTML + CSS + JavaScript
  ├─ Local case-study simulations (no project backend/API calls)
  └─ Same-origin /api/* calls
       ├─ /api/contact             same-origin → HMAC rate limit → validate → Supabase → Resend
       └─ /api/admin/*             Supabase Auth cookie → admin_users authorization
                                    → private Supabase reads/writes → Resend replies
```

The original repo had no framework or backend. This implementation keeps the public site dependency-light and uses Vercel Node functions only where a server boundary is necessary. React/Next.js was not introduced just to modernize a static portfolio. Runtime dependencies are zero; ESLint is a development-only tool.

## Folder structure

```text
.
├── index.html                   Homepage
├── assets/                      Shared CSS, browser JS, algorithm frame generators, favicon
├── projects/                    Four standalone case-study pages
├── admin/                       Private inbox UI (not public message data)
├── api/                         Vercel Node functions
│   ├── contact.js
│   └── admin/                   login, logout, messages, reply
├── lib/                         Server-only validation, auth, rate limit, email, Supabase helpers
├── sql/schema.sql               Supabase schema and atomic rate-limit RPC
├── tests/                       Node test-runner tests
├── scripts/                     Local API/static server and static build copier
├── docs/                        Editable installation and owner guide
├── public/                       Optional real resume PDF (not present in this checkout)
├── .env.example                 Environment-variable names only
├── vercel.json                  Static output, rewrite, and security headers
├── robots.txt
└── sitemap.xml
```

## Local development

Requirements: Node.js **22.12+** and npm.

```bash
npm install
cp .env.example .env
# Fill in the server variables below. For localhost, set ALLOWED_ORIGIN=http://localhost:4173
npm run dev
```

Open `http://localhost:4173`. The built-in Node development server serves the static pages and invokes the same API handlers used by Vercel. It binds to `0.0.0.0` for preview environments. Without Supabase/Resend configuration, contact submission and the inbox remain unavailable by design; the website and demos still work.

Quality checks:

```bash
npm run lint
npm test
npm run build
```

`npm run build` copies the static site into `dist/`; Vercel deploys the API functions from `api/`. The repository uses JavaScript rather than TypeScript, so a separate TypeScript typecheck is not applicable. The tests use Node’s built-in `node:test` runner and require no test framework dependency.

## Environment variables

Set these in Vercel **Project Settings → Environment Variables** and in `.env` for local development. All values are server-only; do not prefix them with `VITE_`, `NEXT_PUBLIC_`, or expose them to browser code.

| Variable | Required | Purpose |
|---|---:|---|
| `SUPABASE_URL` | Yes | Supabase project URL, HTTPS in production |
| `SUPABASE_ANON_KEY` | Yes | Supabase Auth requests from server functions |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only PostgREST operations; never send to the browser |
| `CONTACT_RATE_LIMIT_SECRET` | Yes | Random 32+ character HMAC key; hashes IP fingerprints before storage |
| `RESEND_API_KEY` | For notification/reply | Server-side email provider key |
| `CONTACT_TO_EMAIL` | For contact notification | Private inbox recipient |
| `CONTACT_FROM_EMAIL` | For notification/reply | Sender address verified with Resend |
| `ALLOWED_ORIGIN` | Production | Exact origin, e.g. `https://your-domain.example`; protects writes against cross-origin requests |

Generate a rate-limit secret with:

```bash
openssl rand -hex 32
```

For Vercel Preview deployments, use an exact preview origin in that environment or leave `ALLOWED_ORIGIN` unset so the server enforces a same-host check. Do not use a wildcard origin. Set the Production value to the exact public origin. If the domain changes, update `ALLOWED_ORIGIN`, canonical metadata in the HTML, `robots.txt`, and `sitemap.xml`.

## Database setup

1. Create a Supabase project and keep its service-role key private.
2. Open the Supabase SQL editor and run [`sql/schema.sql`](sql/schema.sql).
3. In Supabase Auth, create a dedicated admin user with a unique password. Do not enable public admin registration.
4. Add only that user to the admin allowlist table after creation:

   ```sql
   insert into public.admin_users (user_id, email)
   select id, email
   from auth.users
   where email = 'your-admin-email@example.com';
   ```

5. Configure the Supabase URL, anon key, and service-role key in the server environment.

Tables:

- `messages`: validated contact fields, status, and timestamps.
- `admin_users`: explicit Supabase Auth user IDs allowed to use the inbox.
- `message_events`: status, received, reply, and deletion audit events.
- `contact_rate_limits`: HMAC fingerprints and atomic request-window counters; raw IP addresses are not stored.

RLS is enabled with no public/authenticated policies. The service-role key is used only by server functions after validation/authentication. The SQL function `consume_contact_rate_limit` uses an atomic upsert so concurrent requests cannot bypass the configured counter.

## API endpoints

All endpoints return generic errors rather than stack traces. The APIs do not enable cross-origin access.

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `POST` | `/api/contact` | Public, same-origin | Validate and rate-limit, store a message, then attempt Resend notification |
| `POST` | `/api/admin/login` | Public, same-origin | Sign in through Supabase Auth; allowlisted users receive HttpOnly cookies |
| `POST` | `/api/admin/logout` | Same-origin | Revoke the current Supabase access token when possible and clear cookies |
| `GET` | `/api/admin/messages` | Authenticated admin | Read the latest 100 messages, or one message by `?id=<uuid>` |
| `PATCH` | `/api/admin/messages` | Authenticated admin, same-origin | Set message status to `unread`, `read`, `replied`, or `archived` |
| `DELETE` | `/api/admin/messages?id=<uuid>` | Authenticated admin, same-origin | Permanently delete a message after a UI confirmation |
| `POST` | `/api/admin/reply` | Authenticated admin, same-origin | Send a reply to the stored sender address through Resend; then mark it replied |

Contact field limits are checked on the server: required name/email/subject/message, email format, optional company/role/LinkedIn validation, and a 20–5,000 character message. There is a honeypot, request-size limit, same-origin validation, and a default limit of five submissions per hour per HMAC’d client fingerprint. Admin login is limited to five attempts per fifteen minutes per fingerprint. Rate-limit storage failure fails closed rather than bypassing abuse checks.

## Authentication and inbox flow

1. Admin signs in with a Supabase Auth email/password account.
2. The server checks the authenticated Supabase user ID against `public.admin_users`; a valid Auth account without a matching row is denied.
3. Access and refresh tokens are set as `HttpOnly`, `SameSite=Strict` cookies with `/api/admin` scope and `Secure` on HTTPS.
4. Every admin API request validates the Supabase session and admin membership again. Expired access tokens are refreshed server-side when possible.
5. Mutating requests require a matching origin. Message fields are rendered with DOM `textContent`, never inserted as HTML.
6. Replies use the stored message recipient and Resend from the server. If delivery fails, the message remains in the inbox and its status is not changed.

The inbox is at `/admin/inbox`. `robots.txt` discourages indexing, but privacy is enforced by server authentication and authorization—not by the hidden URL.

## Email flow

```text
Contact form → same-origin check → rate limit → server validation → Supabase insert
                                                                └→ Resend notification to CONTACT_TO_EMAIL

Inbox reply → authenticated API → stored sender email → Resend → status = replied
```

A message is stored before notification email is attempted. If Resend is unavailable, the API returns a stored-but-notified-later success state; the inbox remains the source of truth. Configure a sender address verified by Resend before enabling notifications or replies.

## Vercel deployment

1. Push this branch to GitHub and import the repository into Vercel.
2. Use the **Other** framework preset (or allow static detection), build command `npm run build`, and output directory `dist`.
3. Set the environment variables above for the intended Vercel environments. Use the exact production origin for `ALLOWED_ORIGIN`.
4. Run `sql/schema.sql` in Supabase and provision the admin Auth user as described above.
5. Deploy. Vercel serves the generated static output and discovers the root `api/` Node functions. The `/admin/inbox` rewrite is configured in `vercel.json`.
6. Verify `/`, all four `/projects/*.html` pages, `/admin/inbox`, and a real test contact after configuring Supabase and Resend.

Using the Vercel CLI:

```bash
npm install
npm run lint
npm test
npm run build
npx vercel
npx vercel --prod
```

Configure secrets in Vercel’s dashboard before the production deploy; never commit `.env` or service keys.

## Verified content and honest boundaries

Project facts were checked against the public repositories named in the portfolio brief, then phrased to avoid overstating what the code does:

- **RevertPay:** the repository documents a double-entry ledger, derived balances, state validation, ownership checks, idempotency, optimistic locking, and audit records. Its README lists state-machine and concurrent-release tests as planned work; this portfolio does not claim a complete financial test suite or a live deployment.
- **AlgoViz 2.0:** the repository documents 14 test groups and 768 brute-force sliding-window comparisons (64 arrays × 12 targets); the supplied brief also cites 150 algorithm-input cases. The local demo only implements supported small modules. Dijkstra and Floyd’s cycle detection are not current AlgoViz modules and are not simulated here.
- **Voyager:** the current repository uses React/Vite and Node/Express. It cascades through model attempts, checks response shape, verifies places with LocationIQ, and uses Pexels category images. The current code uses `Promise.all` for unique image lookups and a throttled/batched geocoding path; it does **not** currently use `Promise.allSettled` to run both pipelines together. The portfolio itinerary is mock-only.
- **EDU2JOB:** the repository documents React → Spring Boot → Flask/scikit-learn → PostgreSQL, Random Forest preprocessing, isotonic calibration, and ranked recommendations. Its README lists RBAC and a model-evaluation harness as roadmap items; this portfolio does not claim shipped RBAC or model accuracy, and its demo never loads the production model.

The supplied resume PDFs were not present in this checkout. No replacement resume is fabricated. Add the real PDF as `public/resume.pdf`; the build copies it to `/resume.pdf` and the site will expose download links only when that file exists. Until then the site provides a working email-based resume request link.

## Known limitations

- Contact persistence, email notifications, and the private inbox are operational only after the owner supplies Supabase/Resend configuration and runs the SQL setup. This checkout contains no service credentials.
- The `/admin/inbox` UI is not a public demo inbox and intentionally shows no fabricated messages.
- Email deliverability depends on a Resend sender domain being verified and configured.
- The browser demos are educational portfolio visualizations; they do not connect to the four project backends or claim production model/payment behavior.
- The main resume PDFs were not supplied to this repository. A real file must be added before direct download appears.
- A stable custom/canonical domain is not configured by the repository itself; the metadata currently uses the Vercel URL documented by the existing README.
- Lighthouse, exhaustive WCAG conformance, and cross-device browser automation were not available in this environment; semantic labels, keyboard paths, focus states, responsive breakpoints, reduced motion, and safe DOM text rendering are included, but this is not a certification.

## Verification completed in this checkout

- `npm run lint` — passes.
- `npm test` — 30 tests pass, covering contact validation/API, same-origin protection, rate limiting, admin login and membership authorization, message status changes, reply delivery behavior, and bounded algorithm frame generation.
- `npm run build` — passes and copies the static production output to `dist/`.
- Local preview server smoke check — homepage, four case studies, `/admin/inbox`, stylesheet, script, and API route resolve. Contact/inbox integration against live services remains unverified until credentials and the SQL schema are configured.
