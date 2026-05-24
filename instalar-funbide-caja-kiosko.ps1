param(
  [string]$TaskName = 'FUNBIDE Caja Kiosko'
)

$basePath = Split-Path -Parent $MyInvocation.MyCommand.Path
$batPath = Join-Path $basePath 'abrir-funbide-caja-kiosko.bat'

if (-not (Test-Path $batPath)) {
  throw "No se encontro el archivo de arranque: $batPath"
}

try {
  $action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c `"$batPath`""
  $trigger = New-ScheduledTaskTrigger -AtLogOn
  $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive
  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
  $task = New-ScheduledTask -Action $action -Trigger $trigger -Principal $principal -Settings $settings

  Register-ScheduledTask -TaskName $TaskName -InputObject $task -Force -ErrorAction Stop | Out-Null
  Write-Host "Tarea instalada: $TaskName"
  Write-Host "Para ejecutarla desde Ejecutar (Win+R), use:"
  Write-Host "schtasks /run /tn `"$TaskName`""
} catch {
  Write-Error "No se pudo crear la tarea. Ejecute este script como administrador o cree la tarea manualmente en el Programador de tareas."
  throw
}
