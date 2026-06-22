# PGE AOS Performance Portal — MVP

## What this package contains

| File / Folder | Purpose |
|---|---|
| `index.html` | Existing AOS Hub with a new Performance Portal entry point |
| `sop.html` | Existing SOP module — unchanged |
| `kpi.html` | Existing KPI information + WI popup module — unchanged |
| `login.html` | Secure entry for Team Leader, HR, Owner |
| `team-dashboard.html` | Team Leader KPI card input and submit workflow |
| `review.html` | HR / cross-department review console |
| `owner-dashboard.html` | Owner monthly dashboard, lock month, Excel export |
| `app-config.js` | The only browser configuration file; contains **publishable** Supabase credentials only |
| `supabase/schema.sql` | Database, RLS, score calculation trigger, review / lock workflow |
| `supabase/seed_kpi_master.sql` | 16 role scorecards and 58 active KPI metric templates |
| `supabase/functions/` | Optional server-side lock / Google Sheets sync functions |
| `google-apps-script/Code.gs` | Optional Google Sheet reporting webhook |

## Current build state

### Built in this package

- Team Leader / HR / Owner page separation
- UI login page and role-based routing
- KPI form per employee / role
- Automatic **weighted score** calculation: `achievement % × active weight`
- Save Draft → Submit → HR Return / Approve → Owner Lock workflow
- Excel export button for the selected period
- Demo mode based on local browser storage
- Supabase schema with RLS, so database access is protected by role and team assignment
- Optional monthly Google Sheets sync scaffold

### Not live until Supabase setup is completed

- Real authentication
- Actual user / department mapping
- Secure data persistence
- HR / Owner-only report data
- Google Sheets syncing

## Deployment order

### 1. Put the website on GitHub Pages

Upload all web files to the same GitHub Pages folder:

```text
index.html
sop.html
kpi.html
login.html
team-dashboard.html
review.html
owner-dashboard.html
app-config.js
auth.js
performance.js
performance.css
data/kpi_roles.json
```

### 2. Create a Supabase project

Create a new Supabase project. Use email + password authentication for the initial rollout.

### 3. Create database objects

In Supabase **SQL Editor**, run these files in order:

```text
supabase/schema.sql
supabase/seed_kpi_master.sql
```

### 4. Create user accounts

Create users in Supabase Auth, then assign system roles through SQL. Example:

```sql
-- Replace actual user UUIDs copied from Authentication > Users
insert into public.user_roles(user_id, role) values
('TEAM_LEADER_UUID', 'team_leader'),
('HR_UUID', 'hr'),
('OWNER_UUID', 'owner');
```

Then map employees to their KPI role and Team Leader. The user IDs must already exist in `profiles` after first login / Auth creation.

```sql
-- Example: assign an operator to KPI-OPS-OPR
insert into public.employee_role_assignments(employee_id, role_definition_id)
select 'OPERATOR_UUID', rd.id
from public.role_definitions rd
where rd.code='KPI-OPS-OPR';

-- Example: map that operator to the Operations Team Leader
insert into public.team_assignments(team_leader_id, employee_id, department_id)
select 'TEAM_LEADER_UUID', 'OPERATOR_UUID', d.id
from public.departments d where d.slug='operations';
```

### 5. Configure `app-config.js`

```js
window.PGE_CONFIG = {
  DEMO_MODE: false,
  SUPABASE_URL: 'https://YOUR-PROJECT.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_...',
  APP_NAME: 'PGE Performance Portal'
};
```

**Never add a Supabase secret / service key to GitHub Pages or `app-config.js`.**

### 6. Test with three accounts

1. Team Leader: should see only assigned team members.
2. HR: should review all submitted cards and return/approve them.
3. Owner: should see every department summary, lock period, and export Excel.

## Scoring rule in this MVP

For every metric, Team Leader enters **Achievement (%)** from 0 to 120.

```text
Weighted metric score = Achievement (%) × Active KPI Weight / 100
Monthly role score    = sum of every weighted metric score
```

This is intentionally the first working version. Existing KPI targets often contain multiple sub-measures in one metric; therefore direct numeric automation needs a second master-data step for each KPI: unit, formula, data source, and scoring direction. The database already contains `scoring_mode` for that future upgrade.

## Optional Google Sheet automation

1. Deploy `google-apps-script/Code.gs` as a Web App.
2. Add the same random `PGE_SYNC_KEY` in Google Apps Script Properties and Supabase Function secret `PGE_SHEETS_SYNC_KEY`.
3. Set `GOOGLE_SHEETS_WEBHOOK_URL` in Supabase Function secrets.
4. Deploy `sync-google-sheets` and invoke it after Owner locks a month.

## Security checklist before go-live

- Keep `DEMO_MODE: false` only after RLS policies are applied.
- Use the **publishable** key in browser only.
- Never put any secret key in HTML, JavaScript, GitHub, or Chat.
- Verify every Team Leader cannot read another department's cards.
- Verify HR and Owner can read all records but only Owner/Admin can lock the reporting period.
- Test the locked-period workflow before using real performance data.
