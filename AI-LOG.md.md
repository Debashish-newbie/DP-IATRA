# AI Log (Debugging + UI Fixes)

Entry: Initial backend route check
Prompt: "API returns 500 on first load."
Result: Found missing API key in `.env` and confirmed `index.js` uses `process.env.neows_api` correctly.

Entry: Frontend fetch sanity
Prompt: "Dashboard shows loading forever."
Result: Verified `script.js` was calling the correct `/api/asteroids` URL and updated the status panel on fetch errors.

Entry: Date parsing during early build
Prompt: "Close approach dates look wrong."
Result: Normalized the date field selection in `script.js` to prefer `close_approach_date_full`.

Entry: Search and filter conflict
Prompt: "Search stops working after I click 'Hazardous Only'."
Result: Found filter toggle resetting the search string on chip click. Kept search state intact and re-applied filters after chip selection.

Entry: Supabase client not initialized
Prompt: "Supabase login works only after refresh."
Result: Discovered config script loading after auth logic; ensured client creation happens before auth calls.

Entry: Supabase 403 on tracked insert
Prompt: "Tracking fails with 403 forbidden."
Result: Added RLS policies for insert/select/delete and verified `auth.uid()` matches `user_id`.

Entry: Supabase table 404
Prompt: "Tracked endpoint returns 404 on Supabase."
Result: Table was created in a different schema; recreated in public and enabled API access.

Entry: Supabase invalid API key
Prompt: "Auth returns 'invalid api key'."
Result: Swapped to anon public key from Supabase dashboard and confirmed project URL format.

Entry: Supabase signups blocked
Prompt: "Email signups are disabled."
Result: Enabled Email provider and turned off 'Disable signups' in Auth settings.

Entry: Supabase email confirmation loop
Prompt: "User cannot login after signup."
Result: Confirmed email confirmation requirement; updated UI to prompt verification and tested with confirmations off.

Entry: Supabase row mapping mismatch
Prompt: "Tracked list loads but Remove fails."
Result: Normalized `neo_id`/`id` usage and ensured delete uses the stored `neo_id`.

Entry: Supabase session missing on dashboard
Prompt: "Dashboard redirects to login after refresh."
Result: Added session fetch on load and fallback to local auth when session is absent.

Entry: Tracked list blank after reload
Prompt: "Tracked objects disappear after refresh."
Result: Guarded against empty dataset while load is in progress and re-rendered once data arrived. Added fallback text for empty list.

Entry: Header alignment on smaller screens
Prompt: "Top-right user info overlaps the dashboard title on mobile."
Result: Adjusted topbar alignment and allowed metadata to wrap. Ensured the user chip stays in the top-right with consistent spacing.

Entry: Prevent reload on Track/Remove
Prompt: "Clicking Track reloads the page."
Result: Added type=button to action buttons and prevented default/propagation in the handler.

Entry: Risk label mismatch in tracked view
Prompt: "Tracked list shows 'Hazardous' even when card shows 'Low Risk'."
Result: Stored the computed hazard label on track and used it in the tracked table display.

Entry: Date range API query
Prompt: "Date range selection doesn't change results."
Result: Wired Apply Range to pass start/end params, verified request URL includes both, and refreshed stats/grid after load.

Entry: Supabase config order
Prompt: "Supabase auth fails on first load but works after refresh."
Result: Moved config script before auth logic and verified client initialization before any auth call.

Entry: Input placeholder contrast
Prompt: "Search placeholder is hard to read."
Result: Increased placeholder contrast and matched it to muted color tokens.

Entry: Missing tracked ID mapping
Prompt: "Remove button doesn't work for tracked items."
Result: Normalized ID usage to handle both `neo_id` and `id` fields and ensured delete uses the correct value.

Entry: UI spacing consistency
Prompt: "Card spacing feels uneven between sections."
Result: Standardized grid gaps and card padding across sections for consistent rhythm.

Entry: Stats NaN display
Prompt: "Closest pass shows 'NaN km' sometimes."
Result: Guarded formatters against non-numeric values and returned '--' when invalid.

Entry: Auth message clarity
Prompt: "Wrong username redirects me to signup."
Result: Kept user on login and showed a clear 'Account not found' message instead of auto-redirect.

Entry: Docker compose startup order
Prompt: "Frontend tries to call backend before it is ready."
Result: Added depends_on in docker-compose and documented a short wait before first fetch.

Entry: Docker port mismatch
Prompt: "Frontend loads but API calls fail in container."
Result: Aligned backend port to 5000 and verified compose port mapping.
