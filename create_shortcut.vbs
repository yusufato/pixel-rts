Set oWS = WScript.CreateObject("WScript.Shell")
sLinkFile = oWS.ExpandEnvironmentStrings("%USERPROFILE%\Desktop\Pixel RTS.lnk")
Set oLink = oWS.CreateShortcut(sLinkFile)
oLink.TargetPath = "C:\Users\MSI\.antigravity-ide\pixel fragman\index.html"
oLink.Save
