# BF Model for Windows and Mac (version 2.4)

One offline app with three parts: **Burden batch wise output chemistry** (lab report upload, raw material chemistry
and moisture, charge per batch, hot metal and slag chemistry, basicity, fuel rate; files from the device or a link), the **Burden
calculator** and the **3D charging simulator**. Every page has buttons to jump to the other parts, and the burden and
moisture from the chemistry part carry into the calculator and the 3D simulator. Nothing is uploaded; data is saved on
the computer only. No internet connection is needed after install, except to load a file from a link. BF Model replaces BF Burden model.

| File | For | Size |
|---|---|---|
| `BF_Model-2.4.0-Windows-Setup.exe` | Windows 10 and 11, 64-bit | 76 MB |
| `BF_Model-2.4.0-Mac-AppleSilicon.zip` | Mac with M1, M2, M3 or M4 chip, macOS 11 Big Sur or newer | 89 MB |
| `BF_Model-2.4.0-Mac-Intel.zip` | Mac with an Intel chip, macOS 11 Big Sur or newer | 96 MB |
| `SHA256SUMS.txt` | Checksums to confirm a download is complete and unchanged | |

Not sure which Mac? Apple menu > **About This Mac**: "Chip Apple M…" is Apple Silicon, "Processor Intel…" is Intel.


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
1. Run `BF_Model-2.4.0-Windows-Setup.exe`.
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
- The home screen opens the three parts. Every page has **‹ Home**, **Batch chemistry**, **Burden calculator** and
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
