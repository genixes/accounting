# MedTrack as your own website (works in any browser, with or without a Google login)

The app screen (what medreps see) now lives on a normal website. Apps Script only answers data requests in the background. Result: no more "Sorry, unable to open the file", and a clean link such as `https://medtrack.yourdomain.com`.

## Part 1 - Update Apps Script (10 minutes)
1. Replace the contents of `Code.gs`, `Auth.gs` and `JavaScript.html` with the new files. Save.
2. **Deploy -> Manage deployments -> pencil -> Version: New version -> Deploy.** The web app link stays the same.
3. Copy your **Web app URL** (ends with `/exec`).

## Part 2 - Prepare the website folder
1. Unzip `MedTrack-website.zip`. You get a folder `web`.
2. Open `web/config.js` in Notepad and paste your Web app URL:
   ```js
   window.MT_CONFIG = {
     api: 'https://script.google.com/macros/s/XXXXXXXX/exec',
     multi: true
   };
   ```
   Save. (`multi: true` is for the login version.)

## Part 3 - Put it online (free, about 5 minutes)
**Easiest: Netlify Drop**
1. Open https://app.netlify.com/drop and sign up (free).
2. Drag the whole `web` folder onto the page. In seconds you get a link like `https://something.netlify.app`.
3. Open it. You should see the sign-in screen.

**Your own address (recommended, e.g. medtrack.layawsystem.com)**
1. Netlify -> your site -> **Domain management -> Add a domain** -> type `medtrack.layawsystem.com`.
2. At your domain provider add a **CNAME** record: name `medtrack`, value = your Netlify address (`something.netlify.app`).
3. Wait a few minutes. HTTPS is automatic.

Other free hosts work the same way: Cloudflare Pages (Direct Upload), Firebase Hosting, GitHub Pages.

## Part 4 - Tell MedTrack the address
1. Sign in as admin on the website.
2. **Users -> Link your medreps open** -> paste your website address -> **Save link**.
   Password-reset emails and the details you send to medreps will now use this address.

## Part 5 - Install on the phone
- **iPhone (Safari):** open the site -> Share -> **Add to Home Screen**.
- **Android (Chrome):** open the site -> menu -> **Install app** / **Add to Home screen**.
It opens like an app, with its own icon, and keeps working offline for entries (they sync when the signal returns).

## Updating later
When a new version is sent to you: upload the new `web` folder again, but keep **your** `config.js` (do not overwrite it with the placeholder one).

## Good to know
- The old Apps Script link still works as a backup (in a private window), but give medreps only the website address.
- Nothing about the data changed: each medrep still has a private spreadsheet in your Drive, and they cannot open it.
- If sign-in says "Could not reach the server": check that `config.js` has the right `/exec` link and that the deployment access is **Anyone**.
