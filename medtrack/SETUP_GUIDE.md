# MedTrack — Setup Guide (about 20 minutes, no coding)

You will end up with a private app on your phone that tracks your stock and warns you before anything expires.

## 1. Create the Google Sheet
1. Go to **sheets.google.com** (signed in with *your own* Google account) and click **Blank spreadsheet**.
2. Name it **MedTrack Data**.

## 2. Open Apps Script
In the Sheet: **Extensions → Apps Script**. A code editor opens.

## 3. Paste the files
1. Delete the sample `Code.gs` content.
2. Click **+** next to *Files* and add these, naming them exactly (the editor adds the extension itself):
   - Script files: `Code`, `Config`, `Setup`, `Data`, `Alerts`, `Reports`, `Auth`
   - HTML files: `Index`, `Styles`, `JavaScript`
3. Paste the matching contents from this folder into each file.
4. Click ⚙ **Project Settings**, tick **Show "appsscript.json" manifest file**, go back to the editor, open `appsscript.json` and paste in the provided one.
5. Click the 💾 Save icon.

## 4. Run the setup
1. Pick the function **runSetup** in the toolbar dropdown and click **Run**.
2. Google asks for permission: **Review permissions → your account → Advanced → Go to project (unsafe) → Allow**. (It is "unsafe" only because you wrote it yourself; it only touches your own Sheet, email and the Telegram/SMS addresses you set.)
3. When it finishes, your Sheet has all the tabs and a daily alert trigger set for 7:00 AM Manila time.
4. *Optional demo:* run **seedSampleData** to load sample products so you can explore. Later, in the Sheet menu **MedTrack → Clear ALL data** removes it so you can start real.

## 5. Set up Telegram alerts (free)
1. In Telegram, search **@BotFather** → send `/newbot` → choose a name and username. It replies with a **token** (long text with a colon). Copy it.
2. Open your new bot in Telegram and send it **hi**.
3. In MedTrack: **More → Settings → Telegram**. Paste the token, tap **Find my chat ID**, then **Save settings**.
4. Tap **Send test alert**. You should receive a message on Telegram and an email.

## 6. Deploy the web app
1. In Apps Script: **Deploy → New deployment → ⚙ Web app**.
2. **Execute as: Me**. **Who has access: Only myself**. Click **Deploy**.
3. Copy the **Web app URL**. Only you, signed in to your Google account, can open it.
4. After any later code change: **Deploy → Manage deployments → ✏ edit → Version: New version → Deploy**.

## 7. Add it to your phone's home screen
- **Android (Chrome):** open the URL → ⋮ menu → **Add to Home screen**.
- **iPhone (Safari):** open the URL → Share → **Add to Home Screen**.

## 8. Move your Excel data (optional, one time)
1. Open the **Import** tab in the Sheet. Paste your Excel rows under the headers (BrandName … SellingPrice). Expiry can be a date, `12/2027` or `Dec 2027`.
2. In MedTrack: **More → Import → Check my data**. Fix anything shown in red, check again, then **Import**.

## 9. Make it yours (optional)
- **Colors:** More → Settings → **Personalize**. Pick a style or your own colors; you see the change right away. Tap **Save settings** to keep it (it also colors your email alerts and reports). Expiry warning colors (red, amber, blue, green) never change.
- **Where reports are saved:** More → Settings → **Where to save reports**. In Google Drive open your folder, copy its address from the browser and paste it. From then on every PDF or Excel report is saved in that folder automatically (you still get the download). The folder must be in the same Google account that owns MedTrack.
- After updating the files, redeploy: **Deploy → Manage deployments → ✏ → Version: New version → Deploy**.

## 10. Selling to several medreps (own login for each)
This turns MedTrack into a multi-user system. Everyone signs in with their email and a password; each medrep gets their **own private spreadsheet**, created automatically inside a Drive folder called **MedTrack Clients** in *your* account.

1. Add a new script file named **Auth** and paste `Auth.gs`. Replace the other changed files too, then save.
2. Run the function **runMultiUserSetup** (Setup.gs is not needed; pick it from the Auth.gs file). Allow the permissions. A message shows **your admin email and a temporary password** (also in the Execution log).
3. **Deploy → Manage deployments → ✏ → Version: New version**, and set **Who has access: Anyone**. (Medreps do not need a Google account. Login is handled by MedTrack.) Deploy and copy the web app link.
4. Open the link, sign in as admin with the temporary password. MedTrack asks you to choose your own password.
5. **More → Manage users → Add medrep**: enter their name and email. You get a card with the **link, email and temporary password**. Tap **Copy all details** and send it to them. The password is shown only once.
6. The medrep signs in, and is asked to choose their own password before anything else.
- **Forgot password:** on the sign-in screen they tap *Forgot password?*. An email with a one-time link (valid 60 minutes) is sent from your Gmail.
- **Lost password / new device:** Manage users → tap the medrep → *Reset password* gives a new temporary password.
- **Leaving medrep:** Manage users → *Switch off*. Their data stays in Drive.
- Passwords are stored only as a salted hash, never as readable text.

**Good to know**
- Alerts run from an hourly check, one medrep at a time, at the hour each medrep chose in Settings.
- Emails (alerts and password resets) are sent from your Google account. A free Gmail account can send about 100 emails a day, Google Workspace about 1,500. For many medreps use Workspace.
- Every medrep's data lives in a spreadsheet you own. You can open it from Manage users. Tell your clients this, and keep their data private.
- To go back to single-user mode run **stopMultiUser** and deploy with *Only myself*.

## Daily use
- **Delivery arrives:** More → Receive delivery (or the dashboard button).
- **Gave samples / left stock at a pharmacy / sale / pullout:** the **+** button.
- **Month end:** More → Reports → choose dates → PDF or Excel.

## Good to know
- No signal? Saves are kept on your phone and show **Pending sync**; they upload automatically. Open the app once with signal each day so it has the latest data to show offline.
- Alerts fire at 180, 90, 60 and 30 days and when stock has expired, as **one digest a day**, and only for things not already reported. Change thresholds and time in Settings.
- SMS is optional and paid: enter your provider's address and API key in Settings.
- Nothing is ever deleted. Products and accounts are archived instead.
