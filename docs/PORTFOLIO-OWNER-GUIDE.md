# Portfolio Site — Installation & Owner Guide

- **For:** Siva Charan
- **Guide version:** 1.0 · 4 October 2026
- **Purpose:** Install and run the site on your computer, find the right files when your details change, and safely publish updates.

> The editable portfolio is the project folder itself. For deeper API, database, and deployment details, see the project [README.md](../README.md).

## 1. Before you start

You need:

- A computer running Windows, macOS, or Linux.
- Node.js **22.12 or newer** and npm. Download Node.js from [nodejs.org](https://nodejs.org/); npm is installed with Node.
- The portfolio folder extracted from its ZIP. Do not work inside the ZIP preview.
- A code editor such as Visual Studio Code (recommended, but optional).

The correct project folder is the one containing `package.json`, `index.html`, and `README.md`. In VS Code, choose **File → Open Folder**, select that folder, then choose **Terminal → New Terminal**.

Check Node and npm:

```text
node --version
npm --version
```

If `node` or `npm` is not recognized, install/reinstall Node.js, close and reopen the terminal, and run those commands again.

## 2. Install and run the portfolio locally

Open a terminal in the project root. Replace the example path with wherever you extracted the folder.

**Windows PowerShell**

```powershell
Set-Location "$HOME\Downloads\Portfolio-Site"
npm ci
npm run dev
```

**macOS or Linux**

```bash
cd ~/Downloads/Portfolio-Site
npm ci
npm run dev
```

`npm ci` installs the exact development tools listed in `package-lock.json`. You normally run it once after downloading the folder, and again if you intentionally replace/update dependencies.

When the terminal says the preview is listening, open **http://localhost:4173** in your browser. Keep the terminal open while you use the site. To stop the server, return to the terminal and press **Ctrl+C**.

**To run it again later:** open a new terminal in the same project folder and run `npm run dev`. You do not need to run `npm ci` again unless the project dependencies change.

You do not need `.env` credentials to view the homepage, project pages, or local demonstrations. The contact form and private inbox will correctly report that their server services are not configured until you connect Supabase and Resend (see section 7). Do not open `index.html` by double-clicking it: the local server is needed for site routes and API behavior.

### If port 4173 is already in use

Choose a different port for just that terminal session:

```powershell
# Windows PowerShell
$env:PORT = "4174"; npm run dev
```

```bash
# macOS / Linux
PORT=4174 npm run dev
```

Then open `http://localhost:4174`.

## 3. Commands you will use

Run these from the project root (the folder containing `package.json`):

| Command | What it does |
|---|---|
| `npm ci` | Installs the locked tools after extracting/downloading the project. |
| `npm run dev` | Starts the local site and API-capable preview at port 4173. |
| `npm run lint` | Checks JavaScript for common code issues. |
| `npm test` | Runs the automated validation, API, inbox, and demo tests. |
| `npm run build` | Creates a fresh production-ready static site in `dist/`. |

For a normal text, image, or styling change: edit the source file, save, then refresh the browser. You do not usually need to stop/restart the dev server. Run lint, tests, and build before publishing a code change.

**Important:** Edit the source files listed below—not files inside `dist/`. The build recreates `dist/`, so edits made only there will be lost.

## 4. Where to update your information

Use the file paths below in VS Code. Press **Ctrl+Shift+F** (Windows/Linux) or **⌘+Shift+F** (Mac) to search every project file when the same detail appears in more than one place.

| What you want to change | Main file(s) | Where to look |
|---|---|---|
| Homepage headline, introduction, hero facts, navigation, contact details | `index.html` | Search for `hero-title`, `hero-intro`, `home`/`systems`, or the current text. |
| Your name, role, short bio, page title, SEO description, social preview text | `index.html` | The `<head>` metadata, `#hero-title`, `.hero-intro`, `#about`, header, and footer. |
| Education, CGPA, internship, credentials, skills | `index.html` | Sections with `id="experience"`, `id="about"`, and the credentials/skills headings. |
| Recruiter Mode title, project summaries, profile facts, contact actions | `index.html` | Search for `id="recruiter-dialog"` or `RECRUITER MODE`. |
| Homepage project-card summaries and links | `index.html` | Search for `id="systems"`. |
| A project’s technical story | `projects/revertpay.html`, `projects/algoviz.html`, `projects/voyager.html`, `projects/edu2job.html` | Each file is that project's standalone case study. |
| Demo behavior and demo interface | `assets/project.js` and `assets/algorithms.js` | Project-specific demo builders and bounded algorithm frame generators. Keep simulations clearly labelled as simulations. |
| Colors, fonts, layout, breakpoints, dialog appearance | `assets/site.css` | Homepage rules, the `recruiter-*` dialog rules, and the mobile media queries. |
| Command palette destinations and direct-email fallback text | `assets/site.js` | Search for `commands` or `directEmail`. |
| Browser icon / initials artwork | `assets/favicon.svg` | This is the small tab icon; it is a vector file. |
| Contact email and social URLs | `index.html`, `projects/*.html`, and `assets/site.js` | Search for the current email/GitHub/LinkedIn/LeetCode value. Site footer links repeat on the case-study pages; the command palette and direct-email fallback are in `assets/site.js`. |
| Inbox database setup | `sql/schema.sql` | Run this in the Supabase SQL editor, once per project database. |
| Canonical site domain / crawl URLs | `index.html`, `projects/*.html`, `robots.txt`, `sitemap.xml` | Update these if you move to a different website domain. |
| Actual resume PDF | `public/resume.pdf` | Add your real PDF here. The site reveals download links only when the file exists. |

### Replacing the initials in Recruiter Mode with your photo

The current `SC` mark is a typographic monogram; this project does **not** contain a profile photograph. To add your own authorized photo:

1. Create an optimized, square portrait (WebP or JPEG is suitable) and save it as `assets/profile-photo.webp`. Use your real photo, not a generated stand-in.
2. In `index.html`, inside the `recruiter-dialog`, replace:

   ```html
   <span class="recruiter-monogram" aria-hidden="true">SC</span>
   ```

   with:

   ```html
   <img
     class="recruiter-photo"
     src="/assets/profile-photo.webp"
     alt="Portrait of Siva Charan"
     width="62"
     height="62"
   />
   ```

3. In `assets/site.css`, add this beside the other recruiter identity rules:

   ```css
   .recruiter-photo {
     display: block;
     width: 62px;
     height: 62px;
     border: 1px solid var(--line);
     border-radius: 50%;
     object-fit: cover;
   }

   @media (max-width: 700px) {
     .recruiter-photo {
       width: 54px;
       height: 54px;
     }
   }
   ```

4. Save, refresh the local preview, then run `npm run build`. If the image does not appear, confirm the file spelling and capitalization match the `src` path.

To use the photo in the tiny header/footer monogram too, search for `class="wordmark-mark">SC` in `index.html` and `projects/*.html`, replace those marks with an image, and add a small `.wordmark-photo` rule in `assets/site.css`. The header/footer and Recruiter Mode image sizes differ; style them separately. You can leave the favicon as initials because portraits are not legible at favicon size.

### Updating email, social accounts, or domain

Some details intentionally occur in several places. Search for the current value using VS Code's workspace search and update all relevant matches. For example, changing the public email may require updating the mail links in `index.html`, the command-palette resume action and `directEmail` fallback in `assets/site.js`, the footer email in each `projects/*.html` page, and—if using the server inbox—`CONTACT_TO_EMAIL`/`CONTACT_FROM_EMAIL` in your private server environment. Do not put API keys in `assets/site.js`.

If the website's domain changes, update canonical/OG URLs in the homepage and four project HTML files, plus `robots.txt` and `sitemap.xml`. Set `ALLOWED_ORIGIN` to the exact production origin in Vercel.

## 5. Adding a real resume or changing project content

- **Resume:** put the supplied, real PDF at `public/resume.pdf`. Keep the filename exact. `npm run build` copies it to `/resume.pdf`, and the site exposes the download action only when the file is available. Do not generate a replacement resume if the real one is missing.
- **Existing project:** update both its homepage card in `index.html` and its case study in `projects/`. If you change a demo, edit the appropriate file in `assets/`. Keep project descriptions tied to verified source code; keep the portfolio simulations labelled illustrative/local.
- **New project:** add a dedicated page under `projects/`, add a first-class card to `index.html`, add the destination to the command palette in `assets/site.js`, and add its public URL to `sitemap.xml`. Recheck mobile layout and run all quality commands.
- **Profile counts or credentials:** update them only when you can verify the new value. Search for duplicate copies so the homepage and Recruiter Mode stay consistent.

## 6. Contact form and private inbox

The public site can be viewed and edited without backend credentials. The contact form and `/admin/inbox` are real server-side features, not sample screens; they remain unavailable until configured. An unconfigured API returns an error rather than claiming a message was delivered. No sample inbox messages are included.

To enable them, see the full server setup in [`README.md`](../README.md): create a Supabase project, run `sql/schema.sql`, create and explicitly allowlist an admin user, set private Vercel environment variables, and configure Resend. The `.env.example` file lists variable names, but its values are placeholders. Copy it only if you are intentionally setting up the backend:

```powershell
# Windows PowerShell
Copy-Item .env.example .env
```

```bash
# macOS / Linux
cp .env.example .env
```

Replace placeholders with your own credentials. Keep `.env` out of Git and never share the Supabase service-role key or Resend key. Local configuration is optional for frontend edits.

## 7. Publish with Vercel

1. Push/import the project into your own GitHub/Vercel setup.
2. Set the Vercel build command to `npm run build` and output directory to `dist` (already configured in `vercel.json`). Vercel also discovers the root `api/` serverless functions.
3. For contact/admin features, set the server variables from `.env.example` in **Vercel → Project Settings → Environment Variables**, run `sql/schema.sql` in Supabase, and verify the sender domain with Resend.
4. Set `ALLOWED_ORIGIN` to your exact HTTPS site origin, not a wildcard.
5. Run the checks locally, deploy, and verify the homepage, all four project pages, contact error/success behavior, and `/admin/inbox`.

Before publishing a content or code update:

```bash
npm run lint
npm test
npm run build
```

## 8. Quick fixes

- **`npm` is not recognized:** install Node.js 22.12+, reopen the terminal, and retry.
- **`package.json` not found:** the terminal is not in the project root. `cd` into the extracted folder containing `package.json`.
- **Port already in use:** use the alternate-port commands in section 2.
- **Contact says “not configured”:** expected until Supabase/Resend are configured; this is not a frontend success state.
- **Photo or CSS appears stale:** refresh the page; check exact asset path/case; restart `npm run dev` only if needed.
- **A change disappears after building:** make sure you edited the source file, not the generated `dist/` copy.

## File map

```text
index.html             Homepage content, contact form, metadata, Recruiter Mode
assets/site.css        Shared styles and responsive layouts
assets/site.js         Homepage and dialog behavior
assets/project.js      Project demo interface/builders
assets/algorithms.js   Bounded algorithm trace generators
projects/*.html        Four technical case studies
admin/                 Private inbox interface
api/ + lib/             Serverless handlers and server-only helpers
sql/schema.sql         Supabase tables and rate-limit procedure
public/resume.pdf      Optional real resume file (add it yourself)
docs/                  Editable documentation source
```

For deeper API, database, security, and deployment details, use [`README.md`](../README.md). This guide documents the repository as delivered; confirm current personal details and service configuration before publishing changes.
