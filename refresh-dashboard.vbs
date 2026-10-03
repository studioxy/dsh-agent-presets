' Regenerate the cost dashboard without flashing a console window every hour.
'
' Task Scheduler runs a .cmd in a visible console. Running it through wscript with a hidden window
' avoids an hourly flash on the desktop, which is the only reason this file exists.
Option Explicit
Dim shell, fso, here, cmd
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
here = fso.GetParentFolderName(WScript.ScriptFullName)
cmd = """" & here & "\refresh-dashboard.cmd"""
shell.Run cmd, 0, False
