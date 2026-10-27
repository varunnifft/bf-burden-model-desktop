# BF Model for Windows and Mac (version 2.9)

One offline app with six parts (**Report**, new in 2.6, **Material based suggestion**, new in 2.7, and **Quiz & suggestions**, new in 2.8): **Burden batch wise output chemistry** (lab report upload, raw material chemistry
and moisture, charge per batch, hot metal and slag chemistry, basicity, fuel rate; files from the device or a link), the **Burden
calculator** and the **3D charging simulator**. Every page has buttons to jump to the other parts, and the burden and
moisture from the chemistry part carry into the calculator and the 3D simulator. Furnace data is never uploaded; it is saved on
the computer only. Internet is needed once to sign up or log in (and to load a file from a link); after that the app works offline. BF Model replaces BF Burden model.

| File | For | Size |
|---|---|---|
| `BF_Model-2.9.0-Windows-Setup.exe` | Windows 10 and 11, 64-bit | 76 MB |
| `BF_Model-2.9.0-Mac-AppleSilicon.zip` | Mac with M1, M2, M3 or M4 chip, macOS 11 Big Sur or newer | 89 MB |
| `BF_Model-2.9.0-Mac-Intel.zip` | Mac with an Intel chip, macOS 11 Big Sur or newer | 96 MB |
| `SHA256SUMS.txt` | Checksums to confirm a download is complete and unchanged | |

Not sure which Mac? Apple menu > **About This Mac**: "Chip Apple M…" is Apple Silicon, "Processor Intel…" is Intel.


## New in 2.9: answer sheet, latest two quizzes
- After a test the Quiz page shows the score with the **answer sheet**: each question, your answer, the correct answer,
  marks and the explanation. The result email has the same answer sheet.
- The page shows the latest two quizzes; older ones are under **Older quizzes**.
- The admin's box is now **Upload a quiz link**, with an "Are you sure?" check.
- If the admin has not updated the Google server yet, the Quiz page says so with the steps.

## New in 2.8: Quiz & suggestions
- **Quiz & suggestions** is a sixth page (navigation strip on every page, home card 06, View > Quiz and suggestions,
  Ctrl/⌘+6). Needs internet.
- The app admin posts quiz links (Google Forms); they are saved in the admin's Google Sheet. Every user sees all quizzes,
  new and old, and can take any of them. The form opens in the browser with the user's name and email filled in; the
  score shows on the Quiz page after submitting and is emailed to the user.
- A new quiz shows a banner in the app and a system notification while the app is open.
- Suggestion box: changes or new features go to the admin by email.
- **Delete account** at the bottom of the home page.
- Logins made before 2.8 confirm their password once on the Quiz page.

## New in 2.7: Material based suggestion, report suggestions
- **Material based suggestion** is a fifth page (navigation strip on every page, home card 05; on the computer View >
  Material based suggestion, Ctrl/⌘+5). Coke, sinter, pellet and lump ore as live 3D lumps: one lump for the combined
  effect and one per single factor, with fines specks and crack mesh. Sliders (CRI, ash, alkali, size, FeO, basicity,
  Al₂O₃, CCS, SiO₂, LOI, temperature, time …) start from your burden where the app has the value (Batch chemistry
  analysis: coke ash from fixed carbon, alkali, sinter CaO/SiO₂ and Al₂O₃, pellet SiO₂, ore Al₂O₃; the calculator's
  particle sizes), marked "yours". Results (CSR, RDI, swelling, fines, permeability, coke rate change) and the
  suggestions update as you move them. Property tables and a compare-all tab with your burden mix. three.js r128 is
  bundled (`www/lib/three.min.js`), so it works offline. Indicative model, not plant-calibrated.
- Report: new section **07 Technical suggestions** (short rules of thumb from the results: slag B2, MgO/Al₂O₃, Al₂O₃,
  slag rate, fuel rate, direct reduction, alkali and sulphur load, production gap, pellet and lump ore share, centre and
  wall O/C, wall rings, coke layer, gas velocity). Checks are now section 08, and lines saying a material uses standard
  values ("Not in BF report - standard values" and the like) are no longer listed.

## New in 2.6: Report page
- **Report** is a fourth page, linked from every page (navigation strip, chemistry bottom tabs, home page card 04;
  on the computer also View > Report, Ctrl/⌘+4). It puts the Batch chemistry results and the Burden calculator results
  on one printable sheet: key figures, **burden ratio sinter : pellet : ore : other** (each other Fe-bearing material by
  its name) with the charge per batch, output slag and hot metal chemistry, fuel rates and loads, production and
  furnace operation, the **charging matrix** (calculator section 4, with the landing radius of every ring and a top-view
  ring diagram), burden distribution (O/C by radius, zones, layers down the furnace) and the checks.
  A value that both parts hold (blast volume, oxygen flow, ore/coke, the charge) is shown once; if the two pages hold
  different values, both are shown in the same row and marked "differ".
- The report recalculates the burden calculator from its saved inputs each time it opens (Refresh does it again).
- **Download PDF**: on Windows/Mac a Save dialog writes an A4 PDF (Downloads by default); on the phone Android's print
  screen opens, choose **Save as PDF**.
- **Pay**: placeholder for now. Downloads are free and Pay says online payment is coming. See "Pay for the report".
- Burden calculator Results: the "Blast − top pressure" tile is removed (both pressures are inputs under Furnace operation).

## Pay for the report
All settings are in `www/pay-config.js` (same file in `android-source/assets/www/` and `desktop-source/app/www/`):
`required` (true locks the PDF download until paid), `amount`, `currency`, `per` ("report" = every download,
"device" = once per device), `link` (the payment page from Razorpay, PayU, Instamojo, a Stripe Payment Link, or a
`upi://pay?...` link) and `note`. Set them and rebuild. Pay opens the link in the browser or payment app; the user
then types the payment reference to unlock. That reference is **not checked** yet: for real checking, the
provider's webhook should mark the payment in the BF Model users Sheet and the app should ask the registration
server before unlocking (a follow-up step once the provider is chosen).

## New in 2.5: sign-up and login
- On first launch the app asks the user to register: **name, mobile, email, company** > a **6-digit OTP** is emailed and
  verified > the user creates a **login ID and password**. Then the app opens. The user stays logged in on that device
  (Log out at the bottom of the home page); the app still works offline after that. "Forgot password?" resets by email OTP.
- Every user is one row in the **BF Model users** Google Sheet in the Drive of varunnifft@gmail.com (registered on, name,
  mobile, email, company, login ID, status, last login, logins, last seen, app). The owner gets an email for each new user.
  Type **blocked** in a user's Status cell to stop them; an app that is online checks once a day.
- Passwords are stored only as salted, iterated HMAC-SHA256 hashes, never in plain text. OTPs: 10 minutes, 5 tries,
  5 emails per address per hour. Logins lock for 15 minutes after 8 wrong passwords.
- Server: a Google Apps Script web app inside that Sheet, `registration-server/Code.gs`; setup and day-to-day steps in
  `registration-server/SETUP.md`. The web app link is in `www/auth-config.js`. Internet is needed to register, log in
  and for the daily check; Gmail allows about 100 script emails a day.

## New in 2.4
- Home page picture is the labelled chute image (particle factory, rotating chute, BF axis, coke bed; chute flow surface with
  ribs, stiffeners, plain flow surface). It is shown whole; tap it to open it full size and pan, so every label can be read on a phone.
  The signature is part of the picture, so the separate signature line is gone.
- Production from oxygen: the blast volume input now **includes** the enrichment oxygen, so air = blast volume x 60 - oxygen flow.
- Direct reduction degree is no longer an input. It is calculated from the fuel carbon and Fe in HM with the Rist diagram W point
  (Fe/FeO equilibrium CO2/(CO+CO2) = 0.29 at about 1000 C, shaft efficiency 0.94), shown on the Results tab, and used in the
  oxygen balance. The Results tab also shows the degree that the charging rate implies, as a check.

## New in 2.3
- Batch chemistry, Burden tab: Mn to HM %, P to HM %, Minor slag constituents % and Fuel ash in bosh slag are no longer inputs
  (fixed standard values 65 %, 70 %, 3 % and 0.3 are used). Charges per day is replaced by **Charges per hour**, and a
  **Blast and oxygen** box is added: blast volume, oxygen enrichment, oxygen purity, blast moisture
  (plus C in HM %).
- Results: **Production** two ways: from charges per hour (hot metal per charge x charges per hour x 24) and from the oxygen
  input (carbon/oxygen balance at the tuyeres: total O2 per hour / O2 needed per tHM, where O2 per tHM = carbon burnt at the
  tuyeres x 22.4/24, and carbon at the tuyeres = fuel carbon - C in HM - direct reduction carbon - Si/Mn/P reduction carbon).
  "How production is calculated" on the Results tab shows every step. Reference: Geerdes, Toxopeus and van der Vliet,
  Modern Blast Furnace Ironmaking.

## New in 2.2
- Batch chemistry, Burden tab: the Targets box (B2, MgO, Al2O3, MgO/Al2O3, slag rate) is gone; these are results of the
  raw material analysis and the charge per batch. The header shows the calculated B2.
- Results: "Slag vs targets" is now **Output slag chemistry** (calculated CaO, SiO2, Al2O3, MgO, B2, B3, MgO/Al2O3, slag rate,
  fuel rate, hot metal per charge, with the actual lab value under each when an HM & slag sheet is loaded). Flux correction removed.
- **Load from a link**: the chemistry Import tab and the calculator/simulator import cards take a web link (Google Sheets,
  Google Drive, OneDrive/SharePoint, Dropbox or a direct file link) as well as a file. Share the file as "Anyone with the link".
  The file is downloaded once and read on the device; nothing is uploaded. This needs internet (the phone app now asks for the
  internet permission for it); everything else still works offline. The last link is remembered.
- Small signature under the home photo.

## Look ("Foundry" design, since 2.1)
Graphite steel shell with molten hot-metal accents, made for a blast furnace tool. The home page is dark, with the photo
whole in a steel frame (nothing on top of it) and the three parts as numbered panels: 01 chemistry (amber), 02 calculator
(molten orange), 03 3D simulator (blast blue). Every page opens with the same graphite navigation strip and a molten line;
the calculator and simulator follow the phone or computer light/dark setting, and the chemistry part stays light for
reading in daylight. Text contrast is 4.5:1 or better everywhere (body text 7:1). New furnace app icon.
The theme is one file, `forge.css`; `tools/apply_forge.py <www>` applies it to a folder made by `assemble.py`.

## Install on Windows
1. Run `BF_Model-2.9.0-Windows-Setup.exe`.
2. Windows may show **"Windows protected your PC"** (SmartScreen), because the app is not code-signed yet.
   Click **More info**, then **Run anyway**.
3. Choose "Only for me" (no administrator rights needed) or "Anyone who uses this computer", pick the folder, and finish.
4. Open **BF Model** from the desktop shortcut or the Start menu.

Uninstall: Settings > Apps > Installed apps > BF Model > Uninstall.
Some company laptops block unsigned installers completely; then IT has to allow it (or see "Code signing" below).

## Install on Mac
1. Double-click the downloaded `.zip`. It turns into **BF Model.app**.
2. Drag **BF Model.app** into the **Applications** folder.
3. Double-click it. macOS says it **"cannot verify the developer"** / "Apple could not verify…", because the app is
   not notarized by Apple yet. Click **Done** (or **OK**), not "Move to Trash".
4. Open **System Settings > Privacy & Security**, scroll down to the message about "BF Model", click
   **Open Anyway**, and confirm with your password. (On macOS 14 and older you can instead right-click the app,
   choose **Open**, then **Open**.)
5. From then on it opens normally.

If macOS says the app **"is damaged and can't be opened"**, the download picked up a quarantine flag the steps
above do not clear. Open Terminal and run:
`xattr -dr com.apple.quarantine "/Applications/BF Model.app"`, then open the app again.

Uninstall: drag the app from Applications to the Bin.

## Using it
- The home screen opens the five parts. Every page has **‹ Home**, **Batch chemistry**, **Burden calculator** and
  **3D simulator** buttons; the View menu has the same (Ctrl/⌘+1 chemistry, +2 calculator, +3 simulator, Alt+Home or ⌘⇧H home).
- Order of work: chemistry (upload lab Excel, check Review, enter the charge on Burden, read Results) → burden calculator
  (furnace, chute matrix, gas; burden and moisture come from the chemistry part) → 3D simulator (same inputs; Calculate
  sends them, Apply and restart sends them back).
- Zoom with Ctrl/⌘ plus and minus; full screen from the View menu. Data is kept between sessions on this computer.

## Code signing (removes the warnings)
The builds are unsigned (Windows) and ad-hoc signed (Mac), so they work but show the warnings above.
- **Windows**: an OV or EV code-signing certificate (about US$200–400 a year from Sectigo, DigiCert, SSL.com and others,
  or Microsoft Artifact Signing / Trusted Signing at about US$10 a month where it is offered for your country and business type). Signed apps build
  SmartScreen reputation over time; EV certificates are trusted at once.
- **Mac**: Apple Developer Program (US$99 a year) gives a "Developer ID Application" certificate; the app is then
  signed and notarized and opens with no warning. This needs a Mac (or a CI Mac runner) at build time.
Once a certificate exists, rebuild with it (see the comments at the top of `source/build.sh`).

## What was tested
On the build machine: the app opened the home page, calculator and 3D simulator; the input template (.xlsx, 128 values
matched) and a PDF imported; inputs stayed after closing and reopening; web links cannot open inside the app.
The Windows build was started under a Windows compatibility layer (Wine) and showed the home screen.
Not yet tested on a real Windows PC or Mac: please try both before sharing widely.

## Rebuild
`source/` has the Electron shell (`app/main.js`), the same web files as the Android app (`app/www/`, only the home page
text changed from "phone" to "computer"), and `build.sh`. Electron 33, electron-builder 25.
