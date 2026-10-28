# Amplitude PM Flow

A step-by-step checklist that lets a product manager with no Amplitude experience own a feature's tracking from the gate on the epic to a live dashboard. The PM taps choices; the app writes every name (events, data-testids, cohorts, chart titles, dashboard, folder), the Jira story for the developer, the demo-day sheet and the build plan.

It is a static site (no build step). Progress is saved per feature so a PM can come back and continue.

- **Local mode** (default): works the moment the page is opened. Progress is saved in the PM's own browser.
- **Cloud mode**: PMs sign in with their work email and a password of their choice (no confirmation email), features are saved in Supabase, and the **Feature map** tab shows every feature anyone has run through the flow and where it stands.

## Files

| File | What it is |
|---|---|
| `index.html` | the page |
| `styles.css` | styling (light and dark) |
| `app.js` | the flow, name generation, generated texts, saving |
| `config.js` | Supabase keys, allowed email domain, contact names |
| `supabase/schema.sql` | table, row-level security, email-domain rule, `feature_map` view |

## 1. Publish on GitHub Pages

1. Create a repository (for example `amplitude-pm-flow`) and push these files to the `main` branch.
2. Repository → **Settings → Pages** → Source: *Deploy from a branch* → Branch: `main`, folder `/ (root)` → Save.
3. After a minute the site is live at `https://<org-or-user>.github.io/amplitude-pm-flow/`.

That is enough for local mode.

## 2. Turn on sign-in and saved features (Supabase, free tier)

1. Go to <https://supabase.com>, create a project (any region; EU is fine).
2. **SQL editor → New query** → paste the contents of `supabase/schema.sql` → **Run**.
3. **Authentication → Sign In / Providers**: keep *Allow new users to sign up* on and switch **Confirm email off** (no emails are sent; the built-in sender is limited to 2 per hour anyway). Then run `supabase/002_email_ownership.sql` in the SQL editor.
4. **Authentication → URL configuration**:
   - *Site URL*: your GitHub Pages URL, e.g. `https://<org>.github.io/amplitude-pm-flow/`
   - *Redirect URLs*: add the same URL.
5. **Project settings → API**: copy the *Project URL* and the *publishable* key (Settings → API Keys).
6. Edit `config.js`:
   ```js
   SUPABASE_URL: "https://xxxx.supabase.co",
   SUPABASE_ANON_KEY: "eyJ...",
   ALLOWED_EMAIL_DOMAIN: "alefeducation.com",
   ```
   Commit and push. The publishable key is designed to be public; row-level security in `schema.sql` is what protects the data.
7. Open the site. Enter the part of the work email before the @ and a password. The first time, the app shows the full address and asks to confirm before creating the account.

Forgot password: Authentication → Users → delete that user; they sign in again with a new password and keep their features (ownership is by email).

Optional later: **Authentication → Providers → Azure** to add Microsoft 365 sign-in (needs an Azure app registration from IT). Nothing in the app changes.

## 3. Who can see what

- PMs see only their own features.
- **Admins** see the **Feature map** with every feature, can open and edit any of them, and manage roles on the **Users** tab (everyone who has signed in, with a PM / Admin switch). Run `supabase/003_admins.sql` then `supabase/004_profiles.sql` once; the first admin is seeded in 003. An admin cannot change their own role, so there is always at least one.
- Sign-in is refused for emails outside the allowed domain (checked in the page and enforced in the database).
- `feature_map` is a plain SQL view, so it can be connected to Power BI or exported if the map should live elsewhere too.

## 4. Changing the content

Everything the PM sees comes from the top of `app.js`:

- `PRODUCT_LINES`, `ROLES`, `TENANTS` — the tap choices.
- `MOMENTS` and `VERB` — the moments a user can go through and how they read in a question.
- `PROPS` / `CATEGORICAL` — property chips.
- `QTYPES` — the kinds of question a PM can add themselves, with the chart recipe each one maps to.
- `GOES_WRONG`, `DEMO_CHECKS` — the demo-day material.
- `LINKS` — KB and Confluence links.

Naming conventions are in the `N` object (`ev`, `tid`, `dash`, `folder`, `cohorts`). Contacts are in `config.js`.

## Sources

The flow follows *The PM Flow for Amplitude* (Alef, July 2026) and the KB: PM guide to tag features, the data-testid protocol, the End-to-End Use Case Guide, and the governance articles on events, spaces and cohorts.
