/**
 * Simple CSV generation helper
 */

export function generateCsv(headers: string[], rows: any[][]): string {
  const escape = (val: any) => {
    if (val === null || val === undefined) return ''
    let s = String(val)
    if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
      s = '"' + s.replace(/"/g, '""') + '"'
    }
    return s
  }

  const csvRows = [headers.map(escape).join(',')]

  for (const row of rows) {
    csvRows.push(row.map(escape).join(','))
  }

  return csvRows.join('\n')
}
