# Dr. Pool inbox board (Chalkboard)

Live to-do board of the info@drpool.us inbox, sorted into buckets (needs action, payments, approved estimates, cancellations, complaints, ...).

- **Data:** Supabase (`chalkboard_items`, `board_meta`). An hourly scheduled task fills it from Outlook.
- **No login:** anyone with the link can open it. The page reads the board through the Supabase function `get_inbox_board()` and checks items off through `inbox_board_toggle()` (asks for your name once). The tables themselves stay locked.
- **Hosting:** static files (`index.html`, `style.css`, `app.js`). Turn on GitHub Pages (Settings > Pages > Deploy from branch `main`, folder `/`).

The Supabase key in `app.js` is the public publishable key; it is safe in a public repo because the data is protected by RLS.

Newest emails are on top in each section; anything added in the last hour glows with a NEW badge.
