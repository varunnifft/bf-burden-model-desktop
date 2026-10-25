# BF Burden model for Windows and Mac (version 1.2)

The same offline app as the Android version, for laptops and desktops: the burden calculator, the 3D charging
simulator and the "Import inputs from a file" card (PDF, Excel, CSV, Word, text). Nothing is uploaded; inputs are
saved on the computer only. No internet connection is needed after install.

| File | For | Size |
|---|---|---|
| `BF_Burden_model-1.2.0-Windows-Setup.exe` | Windows 10 and 11, 64-bit | 83 MB |
| `BF_Burden_model-1.2.0-Mac-AppleSilicon.zip` | Mac with M1, M2, M3 or M4 chip, macOS 11 Big Sur or newer | 100 MB |
| `BF_Burden_model-1.2.0-Mac-Intel.zip` | Mac with an Intel chip, macOS 11 Big Sur or newer | 106 MB |
| `SHA256SUMS.txt` | Checksums to confirm a download is complete and unchanged | |

Not sure which Mac? Apple menu > **About This Mac**: "Chip Apple M…" is Apple Silicon, "Processor Intel…" is Intel.

## Install on Windows
1. Run `BF_Burden_model-1.2.0-Windows-Setup.exe`.
2. Windows may show **"Windows protected your PC"** (SmartScreen), because the app is not code-signed yet.
   Click **More info**, then **Run anyway**.
3. Choose "Only for me" (no administrator rights needed) or "Anyone who uses this computer", pick the folder, and finish.
4. Open **BF Burden model** from the desktop shortcut or the Start menu.

Uninstall: Settings > Apps > Installed apps > BF Burden model > Uninstall.
Some company laptops block unsigned installers completely; then IT has to allow it (or see "Code signing" below).

## Install on Mac
1. Double-click the downloaded `.zip`. It turns into **BF Burden model.app**.
2. Drag **BF Burden model.app** into the **Applications** folder.
3. Double-click it. macOS says it **"cannot verify the developer"** / "Apple could not verify…", because the app is
   not notarized by Apple yet. Click **Done** (or **OK**), not "Move to Trash".
4. Open **System Settings > Privacy & Security**, scroll down to the message about "BF Burden model", click
   **Open Anyway**, and confirm with your password. (On macOS 14 and older you can instead right-click the app,
   choose **Open**, then **Open**.)
5. From then on it opens normally.

If macOS says the app **"is damaged and can't be opened"**, the download picked up a quarantine flag the steps
above do not clear. Open Terminal and run:
`xattr -dr com.apple.quarantine "/Applications/BF Burden model.app"`, then open the app again.

Uninstall: drag the app from Applications to the Bin.

## Using it
- The home screen opens both tools. Go back with **View > Home** (Alt+Home on Windows, ⌘⇧H on Mac) or
  **View > Back** (Alt+Left, ⌘[). **Ctrl/⌘+1** opens the calculator and **Ctrl/⌘+2** the simulator.
- Zoom with Ctrl/⌘ plus and minus; full screen from the View menu.
- Inputs are kept between sessions on this computer. `BF_Burden_model_input_template.xlsx` (in the Android app
  folder) works for the file import here too.

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
