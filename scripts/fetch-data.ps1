<#
  Builds data/data.js for the Warsh dashboard.

  Sources (all public, no API keys):
    - FRED graph CSV endpoint (St. Louis Fed)
    - Cleveland Fed median PCE history CSV
    - BEA NIPA underlying detail workbook (Table 2.4.4U, monthly) for the
      "breadth" metric: share of PCE components with inflation above 3%.

  Runs on Windows PowerShell 5.1 and PowerShell 7 (GitHub Actions ubuntu runners).
#>
[CmdletBinding()]
param(
  [string]$OutFile = (Join-Path (Join-Path (Split-Path $PSScriptRoot -Parent) 'data') 'data.js'),
  [string]$Start = '2014-01-01'   # keep a year before the earliest display date for % changes
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$UA = 'Mozilla/5.0 (compatible; warsh-dashboard/1.0)'
$inv = [Globalization.CultureInfo]::InvariantCulture

# curl is used instead of Invoke-WebRequest: FRED's CDN stalls .NET's HTTP client.
# (In Windows PowerShell 'curl' is an alias for Invoke-WebRequest, so call curl.exe there.)
$CurlExe = if ($env:OS -eq 'Windows_NT') { 'curl.exe' } else { 'curl' }
function Save-Url([string]$Url, [string]$Path) {
  & $CurlExe -sSfL --retry 3 --retry-delay 5 --max-time 300 -A $UA -o $Path $Url
  if ($LASTEXITCODE -ne 0) { throw "Failed to download $Url (curl exit $LASTEXITCODE)" }
}
function Get-Text([string]$Url) {
  $f = [IO.Path]::GetTempFileName()
  try { Save-Url $Url $f; return [IO.File]::ReadAllText($f) } finally { Remove-Item $f -ErrorAction SilentlyContinue }
}

# ---------------------------------------------------------------- FRED
# id -> 'D' (daily, downsample to weekly), 'W', 'M', 'Q'
$fred = [ordered]@{
  PCEPI = 'M'; PCEPILFE = 'M'; CPIAUCSL = 'M'; CPILFESL = 'M'
  PCETRIM12M159SFRBDAL = 'M'; T5YIFR = 'D'; T5YIE = 'D'; MICH = 'M'
  PALLFNFINDEXM = 'M'; ECIWAG = 'Q'; FRBATLWGT3MMAUMHWGO = 'M'
  Y033RX1Q020SBEA = 'Q'; Y001RX1Q020SBEA = 'Q'; PCEC96 = 'M'; LB0000031Q020SBEA = 'Q'; CP = 'Q'
  UNRATE = 'M'; IC4WSA = 'W'; PAYEMS = 'M'
  BAMLC0A0CM = 'D'; BAMLH0A0HYM2 = 'D'; DRTSCILM = 'Q'; VIXCLS = 'D'; DTWEXBGS = 'D'
  DGS2 = 'D'; DGS10 = 'D'; DFEDTARU = 'D'; DFEDTARL = 'D'
  WALCL = 'W'; BOGMBASE = 'M'; M2SL = 'M'
}

function ConvertFrom-FredCsv([string]$csv) {
  $out = New-Object System.Collections.Generic.List[object]
  foreach ($line in ($csv -split "`r?`n" | Select-Object -Skip 1)) {
    if (-not $line) { continue }
    $p = $line.Split(',')
    if ($p.Count -lt 2 -or $p[1] -eq '.' -or $p[1] -eq '') { continue }
    $out.Add(@($p[0], [double]::Parse($p[1], $inv)))
  }
  return , $out
}

# Keep the last observation of each ISO week (Friday-anchored key).
function Compress-Weekly($obs) {
  $byWeek = [ordered]@{}
  foreach ($o in $obs) {
    $d = [datetime]::ParseExact($o[0], 'yyyy-MM-dd', $inv)
    $key = $d.AddDays((5 - [int]$d.DayOfWeek + 7) % 7).ToString('yyyy-MM-dd')
    $byWeek[$key] = $o
  }
  $out = New-Object System.Collections.Generic.List[object]
  foreach ($v in $byWeek.Values) { $out.Add($v) }
  return , $out
}

$series = [ordered]@{}
foreach ($id in $fred.Keys) {
  Write-Host "FRED $id"
  $obs = ConvertFrom-FredCsv (Get-Text "https://fred.stlouisfed.org/graph/fredgraph.csv?id=$id&cosd=$Start")
  if ($fred[$id] -eq 'D') { $obs = Compress-Weekly $obs }
  # Rebuild as plain arrays without the pipeline: PowerShell 5.1 wraps piped
  # arrays in PSObjects, which ConvertTo-Json renders as {value,Count}.
  $clean = New-Object System.Collections.Generic.List[object]
  foreach ($o in $obs) { if ($o[0] -ge $Start) { $clean.Add([object[]]@([string]$o[0], [double]$o[1])) } }
  if ($clean.Count -eq 0) { throw "No observations for $id" }
  $series[$id] = $clean
}

# ---------------------------------------------------------------- Cleveland Fed median PCE
Write-Host 'Cleveland Fed median PCE'
$med = New-Object System.Collections.Generic.List[object]
$medCsv = Get-Text 'https://www.clevelandfed.org/-/media/files/webcharts/medianpce/median-pce-full-history.csv'
foreach ($line in ($medCsv -split "`r?`n" | Select-Object -Skip 1)) {
  $p = $line.Split(',')
  if ($p.Count -lt 3 -or $p[2] -eq 'NaN' -or -not $p[2]) { continue }
  $d = [datetime]::ParseExact($p[0], 'MM/dd/yyyy', $inv).ToString('yyyy-MM-dd')
  if ($d -ge $Start) { $med.Add(@($d, [math]::Round([double]::Parse($p[2], $inv), 3))) }
}
$series['MEDPCE_CLE'] = $med

# ---------------------------------------------------------------- BEA breadth
Write-Host 'BEA Table 2.4.4U (monthly)'
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
$tmp = Join-Path ([IO.Path]::GetTempPath()) ("bea-" + [guid]::NewGuid().ToString('N') + '.xlsx')
Save-Url 'https://apps.bea.gov/national/Release/XLS/Underlying/Section2All_xls.xlsx' $tmp
$zip = [IO.Compression.ZipFile]::OpenRead($tmp)
function Read-Entry([string]$name) {
  $e = $zip.GetEntry($name); if (-not $e) { throw "Missing $name in BEA workbook" }
  $r = New-Object IO.StreamReader($e.Open()); try { [xml]$r.ReadToEnd() } finally { $r.Dispose() }
}
try {
  $wb = Read-Entry 'xl/workbook.xml'
  $rels = Read-Entry 'xl/_rels/workbook.xml.rels'
  $sheet = $wb.workbook.sheets.sheet | Where-Object { $_.name -eq 'U20404-M' }
  if (-not $sheet) { throw 'Sheet U20404-M not found' }
  $rid = $sheet.GetAttribute('id', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')
  $target = ($rels.Relationships.Relationship | Where-Object { $_.Id -eq $rid }).Target -replace '^/?(xl/)?', ''
  $ss = (Read-Entry 'xl/sharedStrings.xml').sst.si
  $ws = Read-Entry "xl/$target"
} finally { $zip.Dispose(); Remove-Item $tmp -ErrorAction SilentlyContinue }

function ColIndex([string]$ref) {
  $letters = $ref -replace '\d', ''; $n = 0
  foreach ($ch in $letters.ToCharArray()) { $n = $n * 26 + ([int]$ch - 64) }
  return $n
}
$months = @{}      # column index -> 'yyyy-MM-01'
$rows = New-Object System.Collections.Generic.List[object]
foreach ($r in $ws.worksheet.sheetData.row) {
  $cells = @{}
  foreach ($c in $r.c) {
    $v = if ($c.t -eq 's') { $ss[[int]$c.v].InnerText } else { $c.v }
    $cells[(ColIndex $c.r)] = $v
  }
  if ($cells[1] -eq 'Line') {
    foreach ($k in $cells.Keys) { if ($cells[$k] -match '^(\d{4})M(\d{2})$') { $months[$k] = "$($Matches[1])-$($Matches[2])-01" } }
  } elseif ($cells[1] -match '^\d+$' -and $months.Count) {
    $label = [string]$cells[2]
    $rows.Add([pscustomobject]@{ line = [int]$cells[1]; indent = $label.Length - $label.TrimStart().Length; label = $label.Trim(); code = $cells[3]; cells = $cells })
  }
}
if ($months.Count -eq 0 -or $rows.Count -lt 300) { throw "Unexpected BEA layout ($($rows.Count) rows)" }

# Household consumption detail spans from "Goods" down to the line before the
# NPISH block. Leaves are lines whose next line is not indented further.
# "Less: Expenditures in the United States by nonresidents" (an export
# offset) and its children are excluded; NPISH final consumption is kept as
# one component.
$npish = ($rows | Where-Object { $_.label -like 'Final consumption expenditures of nonprofit institutions*' } | Select-Object -First 1)
$goods = ($rows | Where-Object { $_.label -eq 'Goods' } | Select-Object -First 1)
if (-not $npish -or -not $goods) { throw 'Could not locate PCE detail boundaries' }
$detail = @($rows | Where-Object { $_.line -ge $goods.line -and $_.line -lt $npish.line })
$leaves = New-Object System.Collections.Generic.List[object]
$skipIndent = -1
for ($i = 0; $i -lt $detail.Count; $i++) {
  $row = $detail[$i]
  if ($skipIndent -ge 0) { if ($row.indent -gt $skipIndent) { continue } else { $skipIndent = -1 } }
  if ($row.label -like 'Less: Expenditures in the United States by nonresidents*') { $skipIndent = $row.indent; continue }
  $isLeaf = ($i -eq $detail.Count - 1) -or ($detail[$i + 1].indent -le $row.indent)
  if ($isLeaf) { $leaves.Add($row) }
}
$leaves.Add($npish)
Write-Host "Breadth components: $($leaves.Count)"

$monthCols = @($months.Keys | Sort-Object)
function Get-Share([int]$ci, [int]$h) {
  if ($ci - $h -lt 0) { return $null }
  $now = $monthCols[$ci]; $then = $monthCols[$ci - $h]
  $n = 0; $up = 0
  foreach ($lf in $leaves) {
    $a = 0.0; $b = 0.0   # cells may be blank or hold markers like "(NA)" / "---"
    if (-not [double]::TryParse([string]$lf.cells[$now], [Globalization.NumberStyles]::Float, $inv, [ref]$a)) { continue }
    if (-not [double]::TryParse([string]$lf.cells[$then], [Globalization.NumberStyles]::Float, $inv, [ref]$b)) { continue }
    if ($b -le 0 -or $a -le 0) { continue }
    $n++; if ([math]::Pow($a / $b, 12.0 / $h) - 1 -gt 0.03) { $up++ }
  }
  if ($n -lt 100) { return $null }
  return [math]::Round(100.0 * $up / $n, 1)
}
$b12 = New-Object System.Collections.Generic.List[object]
$b6 = New-Object System.Collections.Generic.List[object]
$pre = New-Object System.Collections.Generic.List[double]
for ($ci = 0; $ci -lt $monthCols.Count; $ci++) {
  $d = $months[$monthCols[$ci]]
  if ($d -ge '2000-01-01' -and $d -le '2019-12-01') { $s = Get-Share $ci 12; if ($null -ne $s) { $pre.Add($s) } }
  if ($d -ge $Start) {
    $s12 = Get-Share $ci 12; if ($null -ne $s12) { $b12.Add(@($d, $s12)) }
    $s6 = Get-Share $ci 6; if ($null -ne $s6) { $b6.Add(@($d, $s6)) }
  }
}
$series['BREADTH_12M'] = $b12
$series['BREADTH_6M'] = $b6
$preAvg = [math]::Round(($pre | Measure-Object -Average).Average, 1)

# ---------------------------------------------------------------- write
$payload = [ordered]@{
  generated = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
  breadth   = [ordered]@{ components = $leaves.Count; preAvg12m = $preAvg }
  series    = $series
}
$json = $payload | ConvertTo-Json -Depth 6 -Compress
$dir = Split-Path $OutFile -Parent
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
[IO.File]::WriteAllText((Resolve-Path $dir).Path + [IO.Path]::DirectorySeparatorChar + (Split-Path $OutFile -Leaf),
  "/* Generated by scripts/fetch-data.ps1 - do not edit */`nwindow.WARSH_DATA = $json;`n", (New-Object Text.UTF8Encoding $false))
Write-Host "Wrote $OutFile ($([math]::Round($json.Length / 1KB)) KB)"
