# Salt and Paddle Booking System — front end

Apps Script HTML files (glassmorphism redesign). Backend (`Code.gs`, `Api.gs`) is unchanged.

| File | Purpose |
|---|---|
| `Styles.html` | Shared design system (tokens, glass components, icons, toast). Loaded via `<?!= include('Styles') ?>` |
| `Booking.html` | Customer booking flow |
| `Admin.html` | PIN-protected admin dashboard |

Add `Styles.html` as a new HTML file in the Apps Script project, then replace `Booking` and `Admin`.
Brand colours live in the `:root` tokens at the top of `Styles.html`.
