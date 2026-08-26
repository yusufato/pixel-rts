Option Explicit

Dim shell, fileSystem, scriptDirectory, shortcutPath, shortcut

Set shell = WScript.CreateObject("WScript.Shell")
Set fileSystem = CreateObject("Scripting.FileSystemObject")

scriptDirectory = fileSystem.GetParentFolderName(WScript.ScriptFullName)
shortcutPath = shell.SpecialFolders("Desktop") & "\Pixel RTS.lnk"

Set shortcut = shell.CreateShortcut(shortcutPath)
shortcut.TargetPath = fileSystem.BuildPath(scriptDirectory, "baslat.bat")
shortcut.WorkingDirectory = scriptDirectory
shortcut.Description = "Pixel RTS - Taktiksel Strateji Savas Oyunu"
shortcut.IconLocation = shell.ExpandEnvironmentStrings("%SystemRoot%\System32\shell32.dll,25")
shortcut.WindowStyle = 1
shortcut.Save

WScript.Echo shortcutPath
