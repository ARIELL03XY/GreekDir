# GreekDir installer customisation (electron-builder `nsis.include`).
#
# Adds a first page that lets the user choose between:
#   - Install GreekDir (the standard electron-builder flow), or
#   - Run once, without installing: the app is unpacked into a temporary folder, started with a
#     temporary --user-data-dir, and everything is deleted when the app is closed. No registry
#     entries, shortcuts, uninstaller or saved preferences are created, and an existing installation
#     is left untouched.
#
# The same "run once" mode is available non-interactively as:   GreekDir-Setup.exe /RUNONCE [app args]
#
# Requires the patched build/installer.nsi + build/installSection.nsh (see GREEKDIR: markers there)
# and the assisted (non one-click) installer: customWelcomePage is only expanded by
# assistedInstaller.nsh.
#
# NOTE: keep this file saved as UTF-8 WITH BOM, otherwise NSIS mangles the Spanish accents.

!ifndef BUILD_UNINSTALLER

!include "nsDialogs.nsh"
!include "LogicLib.nsh"

!ifndef WS_GROUP
  !define WS_GROUP 0x00020000
!endif

Var gdDialog
Var gdRadioInstall
Var gdRadioRunOnce
Var gdLblRunOnce
Var gdArgs
Var gdShowBanner
Var gdTxtTitle
Var gdTxtSub
Var gdTxtInstall
Var gdTxtInstallDesc
Var gdTxtRunOnce
Var gdTxtRunOnceDesc
Var gdTxtRunBtn
Var gdTxtPreparing

# Called from .onInit when the installer is started with /RUNONCE.
!macro customInit
  ${StdUtils.TestParameter} $0 "runonce"
  ${If} $0 == "true"
    StrCpy $gdShowBanner "0"
    Call GreekDirCollectArgs
    Call GreekDirRunOnce
  ${EndIf}
!macroend

# Expanded at global scope by assistedInstaller.nsh, before every other page.
!macro customWelcomePage

  # Rebuilds the command line to forward to the app: every token except /RUNONCE (any position),
  # each one quoted. (StdUtils.GetAllParameters can't skip tokens: it ignores its argument.)
  Function GreekDirCollectArgs
    Push $R1
    Push $R2
    Push $R3
    StrCpy $gdArgs ""
    ${StdUtils.ParameterCnt} $R1
    StrCpy $R2 0
    ${While} $R2 < $R1
      ${StdUtils.ParameterStr} $R3 $R2
      ${If} $R3 != "/RUNONCE"
      ${AndIf} $R3 != "--runonce"
        StrCpy $gdArgs '$gdArgs "$R3"'
      ${EndIf}
      IntOp $R2 $R2 + 1
    ${EndWhile}
    Pop $R3
    Pop $R2
    Pop $R1
  FunctionEnd

  Function GreekDirLoadStrings
    ${If} $LANGUAGE == 1034
    ${OrIf} $LANGUAGE == 13322
      StrCpy $gdTxtTitle "Elige cómo usar GreekDir"
      StrCpy $gdTxtSub "Instálalo, o ejecútalo una sola vez sin instalar."
      StrCpy $gdTxtInstall "Instalar GreekDir"
      StrCpy $gdTxtInstallDesc "Copia la aplicación a tu equipo, agrega accesos directos al menú Inicio y al escritorio, y permite desinstalarla después. Recomendado."
      StrCpy $gdTxtRunOnce "Ejecutar una vez, sin instalar"
      StrCpy $gdTxtRunOnceDesc "No se instala nada: no se crean accesos directos ni entradas de registro, y tus preferencias no se guardan. GreekDir se ejecuta desde una carpeta temporal que se borra al cerrarlo."
      StrCpy $gdTxtRunBtn "Ejecutar"
      StrCpy $gdTxtPreparing "Preparando GreekDir..."
    ${Else}
      StrCpy $gdTxtTitle "Choose how to use GreekDir"
      StrCpy $gdTxtSub "Install it, or run it once without installing."
      StrCpy $gdTxtInstall "Install GreekDir"
      StrCpy $gdTxtInstallDesc "Copies the app to your computer, adds Start menu and desktop shortcuts, and lets you uninstall it later. Recommended."
      StrCpy $gdTxtRunOnce "Run once, without installing"
      StrCpy $gdTxtRunOnceDesc "Nothing is installed: no shortcuts or registry entries are created, and your settings are not saved. GreekDir runs from a temporary folder that is deleted when you close it."
      StrCpy $gdTxtRunBtn "Run"
      StrCpy $gdTxtPreparing "Preparing GreekDir..."
    ${EndIf}
  FunctionEnd

  # Unpack to a private temp folder, run the app, wait for it to exit, delete everything.
  Function GreekDirRunOnce
    InitPluginsDir
    Call GreekDirLoadStrings
    StrCpy $INSTDIR "$PLUGINSDIR\app"
    CreateDirectory "$INSTDIR"
    SetOutPath "$INSTDIR"

    # Interactive mode: show "Preparing..." on the page itself and lock the buttons while unpacking.
    # (SpiderBanner::Show hangs when called from a page callback, so it is deliberately not used.)
    ${If} $gdShowBanner == "1"
      ${NSD_SetText} $gdLblRunOnce "$gdTxtPreparing"
      GetDlgItem $0 $HWNDPARENT 1
      EnableWindow $0 0
      GetDlgItem $0 $HWNDPARENT 2
      EnableWindow $0 0
      System::Call 'user32::UpdateWindow(i $gdDialog)'
      System::Call 'user32::UpdateWindow(i $HWNDPARENT)'
    ${EndIf}

    Call GreekDirExtractApp

    ${If} $gdShowBanner == "1"
      HideWindow
    ${EndIf}

    ExecWait '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "--user-data-dir=$INSTDIR\userdata" $gdArgs' $0

    SetOutPath "$TEMP"
    RMDir /r "$INSTDIR"
    SetErrorLevel $0
    Quit
  FunctionEnd

  Function GreekDirModeChanged
    Pop $0
    ${NSD_GetState} $gdRadioRunOnce $0
    GetDlgItem $1 $HWNDPARENT 1
    ${If} $0 == ${BST_CHECKED}
      SendMessage $1 ${WM_SETTEXT} 0 "STR:$gdTxtRunBtn"
    ${Else}
      SendMessage $1 ${WM_SETTEXT} 0 "STR:$(^NextBtn)"
    ${EndIf}
  FunctionEnd

  Function GreekDirModePageShow
    # The elevated inner instance (used for "all users" installs) must not show this page again.
    ${If} ${UAC_IsInnerInstance}
      Abort
    ${EndIf}

    Call GreekDirLoadStrings
    !insertmacro MUI_HEADER_TEXT "$gdTxtTitle" "$gdTxtSub"

    nsDialogs::Create 1018
    Pop $gdDialog
    ${If} $gdDialog == error
      Abort
    ${EndIf}

    ${NSD_CreateRadioButton} 0 8u 100% 12u "$gdTxtInstall"
    Pop $gdRadioInstall
    ${NSD_AddStyle} $gdRadioInstall ${WS_GROUP}
    ${NSD_CreateLabel} 12u 22u 94% 26u "$gdTxtInstallDesc"
    Pop $0

    ${NSD_CreateRadioButton} 0 58u 100% 12u "$gdTxtRunOnce"
    Pop $gdRadioRunOnce
    ${NSD_CreateLabel} 12u 72u 94% 38u "$gdTxtRunOnceDesc"
    Pop $gdLblRunOnce

    ${NSD_SetState} $gdRadioInstall ${BST_CHECKED}
    ${NSD_OnClick} $gdRadioInstall GreekDirModeChanged
    ${NSD_OnClick} $gdRadioRunOnce GreekDirModeChanged

    nsDialogs::Show
  FunctionEnd

  Function GreekDirModePageLeave
    ${NSD_GetState} $gdRadioRunOnce $0
    ${If} $0 == ${BST_CHECKED}
      StrCpy $gdArgs ""
      StrCpy $gdShowBanner "1"
      Call GreekDirRunOnce
    ${EndIf}
  FunctionEnd

  Page custom GreekDirModePageShow GreekDirModePageLeave

!macroend

!endif
