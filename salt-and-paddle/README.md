# Salt and Paddle Booking System — front end

Apps Script HTML files (glassmorphism redesign, original blush / mauve / rose theme kept).
Backend (`Code.gs`, `Api.gs`) is unchanged.

| File | Purpose |
|---|---|
| `Styles.html` | Shared design system (tokens, glass components, icons, toast). Loaded via `<?!= include('Styles') ?>` |
| `Booking.html` | Customer booking flow |
| `Status.html` | Booking status + countdown |
| `Confirm.html` | Owner one-click confirm result page |
| `Admin.html` | PIN-protected admin dashboard |
| `Owner.html` | Owner dashboard (schedule, members, financials, pricing) |
| `Financials.gs` | NEW backend file (read-only) powering the Financials tab |

Add `Styles.html` as a new HTML file in the Apps Script project, then replace the other five, and add `Financials.gs` as a new Script file (Code.gs / Api.gs stay as they are).
Theme colours live in the `:root` tokens at the top of `Styles.html`.
