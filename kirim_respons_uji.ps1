[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$FileExcel = ".\outputs\gform_qa\template_respons_uji_1_contoh.xlsx",

    [switch]$Kirim,
    [switch]$SayaPemilik,
    [switch]$IzinkanNamaKustom,

    [ValidateRange(2, 60)]
    [int]$JedaDetik = 3,

    [ValidateRange(1, 25)]
    [int]$MaksimalRespons = 25
)

$ErrorActionPreference = "Stop"
$formResponseUrl = "https://docs.google.com/forms/d/e/1FAIpQLSeNs7hLILksxicotU0H1ZXui-qBSuitG_9kkbJY9zKgIbEL6g/formResponse"

$columnToEntry = [ordered]@{
    "Nama Lengkap"           = "entry.775276087"
    "Usia"                   = "entry.1940257710"
    "Status"                 = "entry.152412440"
    "Familiaritas"           = "entry.1674812363"
    "Transisi"               = "entry.1134134200"
    "Visualisasi"            = "entry.1848595981"
    "Teks Grafik Animasi"    = "entry.1185306241"
    "Editing"                = "entry.1109549579"
    "Narasi"                 = "entry.1721358007"
    "Musik Efek"             = "entry.62600075"
    "Cara Kerja"             = "entry.365225457"
    "Mikroplastik"           = "entry.153377135"
    "Solusi dan Masalah"     = "entry.155648267"
    "Relevansi MARICYCLE"    = "entry.1182371353"
    "Alur Penyampaian"       = "entry.1307329951"
    "Klaim Kurang Tepat"     = "entry.1828002954"
    "Saran"                  = "entry.1292858754"
    "Kualitas Keseluruhan"   = "entry.585101905"
}

$dash = [char]0x2013
$allowedUsia = @("<17", "17${dash}20", "21${dash}25", "26${dash}30", "31${dash}40", ">40")
$allowedStatus = @("Pelajar", "Mahasiswa", "Guru/Dosen", "Karyawan/Pegawai", "Wiraswasta", "Profesional", "Freelancer", "Belum bekerja", "Lainnya")
$allowedFamiliar = @("Sangat familiar", "Familiar", "Cukup familiar", "Kurang familiar", "Tidak familiar")

function Get-CellText {
    param($Cell)
    if ($null -eq $Cell.Value2) { return "" }
    return ([string]$Cell.Text).Trim()
}

$resolvedFile = (Resolve-Path -LiteralPath $FileExcel).Path
$excel = $null
$workbook = $null
$worksheet = $null
$rows = @()

try {
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    $workbook = $excel.Workbooks.Open($resolvedFile, 0, $true)
    $worksheet = $workbook.Worksheets.Item("Respons Uji")
    $used = $worksheet.UsedRange

    $headers = @{}
    for ($col = 1; $col -le $used.Columns.Count; $col++) {
        $header = Get-CellText $worksheet.Cells.Item(1, $col)
        if ($header) { $headers[$header] = $col }
    }

    foreach ($requiredHeader in $columnToEntry.Keys) {
        if (-not $headers.ContainsKey($requiredHeader)) {
            throw "Kolom wajib tidak ditemukan: $requiredHeader"
        }
    }

    for ($row = 2; $row -le $used.Rows.Count; $row++) {
        $name = Get-CellText $worksheet.Cells.Item($row, $headers["Nama Lengkap"])
        if ([string]::IsNullOrWhiteSpace($name)) { continue }

        $record = [ordered]@{}
        foreach ($header in $columnToEntry.Keys) {
            $record[$header] = Get-CellText $worksheet.Cells.Item($row, $headers[$header])
        }
        $record["_Row"] = $row
        $rows += [pscustomobject]$record
    }
}
finally {
    if ($null -ne $workbook) { $workbook.Close($false) }
    if ($null -ne $excel) { $excel.Quit() }
    foreach ($comObject in @($worksheet, $workbook, $excel)) {
        if ($null -ne $comObject) { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($comObject) }
    }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}

if ($rows.Count -eq 0) { throw "Tidak ada baris respons pada sheet 'Respons Uji'." }
if ($rows.Count -gt $MaksimalRespons) { throw "Ada $($rows.Count) baris, melebihi batas $MaksimalRespons respons uji per eksekusi." }

$errors = New-Object System.Collections.Generic.List[string]
foreach ($record in $rows) {
    $rowNumber = $record._Row
    $customNameAllowed = $IzinkanNamaKustom -and $rows.Count -eq 1
    if (-not $customNameAllowed -and -not $record."Nama Lengkap".StartsWith("TEST-", [StringComparison]::OrdinalIgnoreCase)) {
        $errors.Add("Baris ${rowNumber}: Nama Lengkap harus diawali TEST-.")
    }
    if ($record.Usia -notin $allowedUsia) { $errors.Add("Baris ${rowNumber}: nilai Usia tidak valid.") }
    if ($record.Status -notin $allowedStatus) { $errors.Add("Baris ${rowNumber}: nilai Status tidak valid.") }
    if ($record.Familiaritas -notin $allowedFamiliar) { $errors.Add("Baris ${rowNumber}: nilai Familiaritas tidak valid.") }
    foreach ($scoreColumn in @("Transisi", "Visualisasi", "Teks Grafik Animasi", "Editing", "Narasi", "Musik Efek", "Cara Kerja", "Mikroplastik", "Solusi dan Masalah", "Relevansi MARICYCLE", "Alur Penyampaian")) {
        $score = 0
        if (-not [int]::TryParse($record.$scoreColumn, [ref]$score) -or $score -lt 1 -or $score -gt 5) {
            $errors.Add("Baris ${rowNumber}: $scoreColumn harus angka 1-5.")
        }
    }
    $overall = 0
    if (-not [int]::TryParse($record."Kualitas Keseluruhan", [ref]$overall) -or $overall -lt 1 -or $overall -gt 10) {
        $errors.Add("Baris ${rowNumber}: Kualitas Keseluruhan harus angka 1-10.")
    }
    if ([string]::IsNullOrWhiteSpace($record."Klaim Kurang Tepat")) { $errors.Add("Baris ${rowNumber}: Klaim Kurang Tepat wajib diisi.") }
    if ([string]::IsNullOrWhiteSpace($record.Saran)) { $errors.Add("Baris ${rowNumber}: Saran wajib diisi.") }
}

if ($errors.Count -gt 0) {
    $errors | ForEach-Object { Write-Error $_ }
    throw "Validasi gagal. Tidak ada respons yang dikirim."
}

Write-Host "Validasi berhasil untuk $($rows.Count) respons uji."
if (-not $Kirim) {
    Write-Host "DRY-RUN: tidak ada data yang dikirim. Tambahkan -Kirim -SayaPemilik untuk mengirim."
    exit 0
}
if (-not $SayaPemilik) {
    throw "Pengiriman dibatalkan. Tambahkan -SayaPemilik untuk menyatakan bahwa form ini milikmu atau kamu berwenang mengujinya."
}
if ($IzinkanNamaKustom -and $rows.Count -ne 1) {
    throw "-IzinkanNamaKustom hanya boleh dipakai untuk tepat satu respons per eksekusi."
}

$success = 0
foreach ($record in $rows) {
    $body = @{
        "fvv" = "1"
        "pageHistory" = "0,1"
    }
    foreach ($header in $columnToEntry.Keys) {
        $body[$columnToEntry[$header]] = [string]$record.$header
    }

    try {
        $response = Invoke-WebRequest -Uri $formResponseUrl -Method Post -Body $body -UseBasicParsing
        if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 400) {
            throw "HTTP $($response.StatusCode)"
        }
        $success++
        Write-Host "Terkirim: $($record.'Nama Lengkap') ($success/$($rows.Count))"
    }
    catch {
        throw "Gagal mengirim baris $($record._Row) setelah $success respons berhasil: $($_.Exception.Message)"
    }

    if ($success -lt $rows.Count) { Start-Sleep -Seconds $JedaDetik }
}

Write-Host "Selesai. $success respons uji berhasil dikirim."
