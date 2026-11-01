# BF Model for Windows and Mac (version 3.5)

One offline app for blast furnace burden work: **Data input** (one Excel/CSV fills every page), **Burden batch wise
output chemistry**, the **Burden calculator**, **3D distribution** (chute filling the throat), the new **Furnace 3D view**
(zone temperatures from wall to centre, gas flow from tuyere to top, PCI raceway) and the **Report**. Furnace data is
never uploaded; it is saved on the computer only. Internet is needed once to sign up or log in (and to load a file from
a link); after that the app works offline. Version 3.5 is an **update of BF Model 2.6**: it installs over it and keeps
your saved inputs and your login.

| File | For | Size |
|---|---|---|
| `BF_Model-3.5.0-Windows-Setup.exe` | Windows 10 and 11, 64-bit | 76 MB |
| `BF_Model-3.5.0-Mac-AppleSilicon.zip` | Mac with M1, M2, M3 or M4 chip, macOS 11 Big Sur or newer | 90 MB |
| `BF_Model-3.5.0-Mac-Intel.zip` | Mac with an Intel chip, macOS 11 Big Sur or newer | 96 MB |
| `SHA256SUMS.txt` | Checksums to confirm a download is complete and unchanged | |

Not sure which Mac? Apple menu > **About This Mac**: "Chip Apple M…" is Apple Silicon, "Processor Intel…" is Intel.
The 2.6 and 1.2 files stay in `downloads/` for anyone who needs an older version.

## Updating from 2.6
- **Windows**: run `BF_Model-3.5.0-Windows-Setup.exe`. It finds BF Model 2.6, closes it if it is open, and replaces it in
  the same folder; Apps & features then shows BF Model 3.5 (one entry). The desktop and Start menu shortcuts are kept.
  If 2.6 was installed "for anyone who uses this computer", run the Setup as an administrator to update that copy.
- **Mac**: unzip, drag the new **BF Model.app** into Applications and choose **Replace**, then do the first-open step
  under "Install on Mac" once more (each new download needs it).
- Saved inputs, materials, charging matrices and the login are kept: they live in the user profile
  (`%APPDATA%\BF Model` on Windows, `~/Library/Application Support/BF Model` on Mac), which neither update touches.

## New in 3.5
- **Data input** page (home quick action "Import data input"): one Excel or CSV upload fills the inputs on every page,
  each value once; anything not in the file can still be typed on its page. The input data sheet can be downloaded as
  Excel or CSV (also linked from Feedback and suggestion).
- **Furnace 3D view** (new module 08): a cut-away 3D furnace you can rotate and zoom (whole furnace, top, shaft, cohesive
  zone, tuyeres, hearth), with gas temperature, burden temperature, gas velocity, CO utilisation, reduction degree,
  burden layers and pressure views, plus a 2D section. It uses the burden distribution of the selected charging mode
  (C-O, COO, CCO or the last one charged), so the layers in the shaft match what was charged. Tuyeres, tapholes,
  uptakes and coal lances are drawn to your numbers.
- New inputs: **top gas temperatures 1-4** at 0, 90, 180 and 270 degrees (top temp 1 is the 0 degree reference),
  **burden probe** (choose the number of points, then TL1..n and TR1..n from centre to wall) and **periphery
  temperatures** T1..n with their angles. "Calculated against actual" compares them with the model, explains the
  deviation and suggests actions. Assumed: tapping is good and all coal lances have similar, good flow.
- **PCI raceway**: coal combustion and raceway simulator with live coal burning (devolatilisation, char burnout, flame
  temperature, maximum PCI rate) on the same inputs.
- Names: 3D simulator is now **3D distribution**, Furnace inside is **Furnace 3D view**. The charging matrix in the
  calculator and 3D distribution goes up to **18 rings** (+ Ring / − Last ring).
- On the computer: **Save PDF** works on the Furnace 3D view as well as the Report; Excel/CSV downloads ask where to
  save (Downloads by default); View menu has Data input (Ctrl/⌘+0) and Furnace 3D view (Ctrl/⌘+5).

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
1. Run `BF_Model-3.5.0-Windows-Setup.exe` (updates 2.6 in place if it is installed).
2. Windows may show **"Windows protected your PC"** (SmartScreen), because the app is not code-signed yet.
   Click **More info**, then **Run anyway**.
3. New install: it goes into your user account (no administrator rights needed); pick the folder and finish.
   Update: the folder of the earlier version is used, so there is nothing to choose.
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
- The home screen opens every part. Each page has a navigation strip (Home, Data input, Batch chemistry, Burden calculator,
  3D distribution, Furnace 3D view, Report, …); the View menu has the same (Ctrl/⌘+0 data input, +1 chemistry,
  +2 calculator, +3 3D distribution, +4 report, +5 furnace 3D view, Alt+Home or ⌘⇧H home).
- Order of work: data input (one file for every page) → chemistry (check Review, the charge, Results) → burden calculator
  (furnace, chute matrix up to 18 rings, gas) → 3D distribution → furnace 3D view (temperatures, gas flow, PCI raceway,
  calculated against your measurements) → report.
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
3.5, on the build machine (Linux): BF Model 2.6 was run first and saved inputs and a login; 3.5 then opened with the
same profile already logged in and the inputs still there. Every page (home, data input, chemistry, calculator,
3D distribution, furnace 3D view, report, feedback, fact must know) opened with no script errors, and Save PDF wrote
a PDF from the Furnace 3D view. The Windows installer and both Mac apps were checked for contents, names, app ID and
signature, but **not yet run on a real Windows PC or Mac**: please install the update over 2.6 on one of each
before sharing widely.

## Rebuild
`source/` has everything: `package.json` (version), `app/main.js` and `app/preload.js` (the Electron shell, same
app:// origin and app ID as 2.x so data carries over), `app/www/` (the same web files as the Android app 3.5),
`build/installer.nsi` (Windows Setup), `build/icon.ico|icns`, `tools/` (asar packer, exe icon patch) and `build.sh`.
On Linux or a Mac, `source/build.sh` downloads Electron 33.4.11, NSIS, 7-Zip and rcodesign from GitHub into
`source/.cache`, and writes the three files into `downloads/` and `SHA256SUMS.txt`. No npm is needed.
