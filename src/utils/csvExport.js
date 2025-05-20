// Utility to convert array of objects to CSV and trigger download
export function exportToCSV({ data, filename = 'export.csv', columns = null }) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    alert('No data to export.');
    return;
  }
  // If columns not provided, use all keys from first row
  const keys = columns || Object.keys(data[0]);
  // CSV header
  const header = keys.map(k => `"${k}"`).join(',');
  // CSV rows
  const rows = data.map(row =>
    keys.map(k => {
      let val = row[k];
      if (val === null || val === undefined) val = '';
      // Escape quotes
      val = String(val).replace(/"/g, '""');
      return `"${val}"`;
    }).join(',')
  );
  const csvContent = [header, ...rows].join('\r\n');
  // Create blob and trigger download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
} 