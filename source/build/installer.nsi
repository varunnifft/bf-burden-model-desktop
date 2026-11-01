; BF Model Windows installer (NSIS 3). Built by source/build.sh.
; Installs over an earlier BF Model (2.x, made with electron-builder) in the same folder and under the same
; Apps & features entry, so it shows as an update. Saved inputs and the login live in %APPDATA%\BF Model and are kept.

Unicode true
SetCompressor /SOLID lzma
SetCompressorDictSize 64
ManifestDPIAware true
RequestExecutionLevel highest

!ifndef VERSION
  !define VERSION "3.5.0"
!endif
!ifndef STAGE
  !define STAGE "stage"
!endif
!ifndef OUTFILE
  !define OUTFILE "BF_Model-${VERSION}-Windows-Setup.exe"
!endif
!define APPNAME "BF Model"
!define EXE "BF Model.exe"
!define UNEXE "Uninstall BF Model.exe"
; electron-builder's key for appId com.bfburdenmodel.desktop (UUID v5); used when no earlier install is found
!define GUID "88fd93b3-8ece-5f3d-a29b-65654cd17237"
!define UNKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall"

!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"
!include "x64.nsh"

Name "${APPNAME} ${VERSION}"
OutFile "${OUTFILE}"
InstallDir "$LOCALAPPDATA\Programs\${APPNAME}"
BrandingText "${APPNAME} ${VERSION}"
VIProductVersion "${VERSION}.0"
VIAddVersionKey "ProductName" "${APPNAME}"
VIAddVersionKey "ProductVersion" "${VERSION}"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "FileDescription" "${APPNAME} Setup"
VIAddVersionKey "CompanyName" "Niteen Kumar"
VIAddVersionKey "LegalCopyright" "Niteen Kumar"

Var Found      ; 1 when an earlier BF Model is installed
Var Hive       ; HKCU or HKLM of the earlier install
Var Key        ; its Apps & features key name
Var OldVer
Var IsAdmin

!define MUI_ICON "icon.ico"
!define MUI_UNICON "icon.ico"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "BF Model ${VERSION}"
!define MUI_WELCOMEPAGE_TEXT "This installs BF Model ${VERSION}: data input, batch chemistry, burden calculator, 3D distribution, furnace 3D view with the PCI raceway, and report.$\r$\n$\r$\n$_CLICK"
!define MUI_PAGE_CUSTOMFUNCTION_SHOW WelcomeShow
!insertmacro MUI_PAGE_WELCOME
!define MUI_PAGE_CUSTOMFUNCTION_PRE DirPre
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN "$INSTDIR\${EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "Open BF Model"
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

; Looks through one hive's Apps & features entries for DisplayName "BF Model"
!macro FindIn ROOT NAME
  ${If} $Found != 1
    StrCpy $0 0
    ${Do}
      EnumRegKey $1 ${ROOT} "${UNKEY}" $0
      ${If} $1 == ""
        ${Break}
      ${EndIf}
      ReadRegStr $2 ${ROOT} "${UNKEY}\$1" "DisplayName"
      ${If} $2 == "${APPNAME}"
      ${OrIf} $2 == "BF Model ${VERSION}"
        ReadRegStr $3 ${ROOT} "${UNKEY}\$1" "DisplayIcon"
        ReadRegStr $OldVer ${ROOT} "${UNKEY}\$1" "DisplayVersion"
        StrCpy $Found 1
        StrCpy $Hive ${NAME}
        StrCpy $Key $1
        ; DisplayIcon is "C:\...\BF Model.exe,0" (sometimes quoted)
        StrCpy $4 $3 1
        ${If} $4 == '"'
          StrCpy $3 $3 "" 1
        ${EndIf}
        ${GetParent} $3 $5
        ${If} $5 != ""
        ${AndIf} ${FileExists} "$5\${EXE}"
          StrCpy $INSTDIR $5
        ${EndIf}
        ${Break}
      ${EndIf}
      IntOp $0 $0 + 1
    ${Loop}
  ${EndIf}
!macroend

Function .onInit
  SetRegView 64
  UserInfo::GetAccountType
  Pop $0
  ${If} $0 == "Admin"
    StrCpy $IsAdmin 1
  ${Else}
    StrCpy $IsAdmin 0
  ${EndIf}
  StrCpy $Found 0
  StrCpy $Key "${GUID}"
  StrCpy $Hive "HKCU"
  !insertmacro FindIn HKCU "HKCU"
  !insertmacro FindIn HKLM "HKLM"
  ${If} $Found == 1
  ${AndIf} $Hive == "HKLM"
  ${AndIf} $IsAdmin != 1
    MessageBox MB_ICONINFORMATION|MB_OK "BF Model $OldVer is installed for all users on this computer. Updating it needs an administrator. Setup will install BF Model ${VERSION} for your account only; your saved inputs carry over either way."
    StrCpy $Found 0
    StrCpy $Hive "HKCU"
    StrCpy $Key "${GUID}"
    StrCpy $INSTDIR "$LOCALAPPDATA\Programs\${APPNAME}"
  ${EndIf}
  ${If} $Hive == "HKLM"
    SetShellVarContext all
  ${Else}
    SetShellVarContext current
  ${EndIf}
FunctionEnd

Function WelcomeShow
  ${If} $Found == 1
    SendMessage $mui.WelcomePage.Text ${WM_SETTEXT} 0 "STR:BF Model $OldVer is installed. Setup updates it to ${VERSION} in the same folder.$\r$\n$\r$\nYour saved furnace inputs and your login are kept.$\r$\n$\r$\nClose BF Model before you continue. $_CLICK"
  ${EndIf}
FunctionEnd

Function DirPre
  ${If} $Found == 1
    Abort ; updating: keep the existing folder
  ${EndIf}
FunctionEnd

!macro WriteKeys ROOT
  WriteRegStr ${ROOT} "${UNKEY}\$Key" "DisplayName" "${APPNAME}"
  WriteRegStr ${ROOT} "${UNKEY}\$Key" "DisplayVersion" "${VERSION}"
  WriteRegStr ${ROOT} "${UNKEY}\$Key" "Publisher" "Niteen Kumar"
  WriteRegStr ${ROOT} "${UNKEY}\$Key" "DisplayIcon" "$INSTDIR\${EXE},0"
  WriteRegStr ${ROOT} "${UNKEY}\$Key" "InstallLocation" "$INSTDIR"
  WriteRegStr ${ROOT} "${UNKEY}\$Key" "UninstallString" '"$INSTDIR\${UNEXE}" /hive=${ROOT} /key=$Key'
  WriteRegStr ${ROOT} "${UNKEY}\$Key" "QuietUninstallString" '"$INSTDIR\${UNEXE}" /S /hive=${ROOT} /key=$Key'
  WriteRegDWORD ${ROOT} "${UNKEY}\$Key" "NoModify" 1
  WriteRegDWORD ${ROOT} "${UNKEY}\$Key" "NoRepair" 1
  WriteRegDWORD ${ROOT} "${UNKEY}\$Key" "EstimatedSize" $6
  WriteRegStr ${ROOT} "Software\${GUID}" "InstallLocation" "$INSTDIR"
!macroend

Section "BF Model" SecMain
  SectionIn RO
  ; close a running copy so its files can be replaced
  nsExec::Exec 'taskkill /F /T /IM "${EXE}"'
  Pop $0
  Sleep 800

  ; remove the previous program files (not the user data in %APPDATA%), only from a real BF Model folder
  ${If} ${FileExists} "$INSTDIR\${EXE}"
    RMDir /r "$INSTDIR\resources"
    RMDir /r "$INSTDIR\locales"
    Delete "$INSTDIR\*.dll"
    Delete "$INSTDIR\*.pak"
    Delete "$INSTDIR\*.bin"
    Delete "$INSTDIR\*.dat"
    Delete "$INSTDIR\*.json"
    Delete "$INSTDIR\LICENSE*"
    Delete "$INSTDIR\version"
    Delete "$INSTDIR\${EXE}"
    Delete "$INSTDIR\${UNEXE}"
  ${EndIf}

  SetOutPath "$INSTDIR"
  File /r "${STAGE}\*.*"
  WriteUninstaller "$INSTDIR\${UNEXE}"

  ${GetSize} "$INSTDIR" "/S=0K" $6 $7 $8
  ${If} $Hive == "HKLM"
    !insertmacro WriteKeys HKLM
  ${Else}
    !insertmacro WriteKeys HKCU
  ${EndIf}

  CreateShortCut "$DESKTOP\${APPNAME}.lnk" "$INSTDIR\${EXE}" "" "$INSTDIR\${EXE}" 0
  CreateShortCut "$SMPROGRAMS\${APPNAME}.lnk" "$INSTDIR\${EXE}" "" "$INSTDIR\${EXE}" 0
SectionEnd

Var UnHive
Var UnKey
Function un.onInit
  SetRegView 64
  ${GetParameters} $0
  ${GetOptions} $0 "/hive=" $UnHive
  ${GetOptions} $0 "/key=" $UnKey
  ${If} $UnKey == ""
    StrCpy $UnKey "${GUID}"
  ${EndIf}
  ${If} $UnHive == "HKLM"
    SetShellVarContext all
  ${Else}
    SetShellVarContext current
  ${EndIf}
FunctionEnd

Section "Uninstall"
  nsExec::Exec 'taskkill /F /T /IM "${EXE}"'
  Pop $0
  Sleep 500
  Delete "$DESKTOP\${APPNAME}.lnk"
  Delete "$SMPROGRAMS\${APPNAME}.lnk"
  RMDir /r "$INSTDIR\resources"
  RMDir /r "$INSTDIR\locales"
  Delete "$INSTDIR\*.*"
  RMDir "$INSTDIR"
  ${If} $UnHive == "HKLM"
    DeleteRegKey HKLM "${UNKEY}\$UnKey"
    DeleteRegKey HKLM "Software\${GUID}"
  ${Else}
    DeleteRegKey HKCU "${UNKEY}\$UnKey"
    DeleteRegKey HKCU "Software\${GUID}"
  ${EndIf}
  ; saved inputs and the login in %APPDATA%\BF Model are left in place
SectionEnd
