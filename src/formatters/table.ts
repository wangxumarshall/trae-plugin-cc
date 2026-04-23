export interface TableColumn {
  header: string;
  width: number;
  value: (row: Record<string, unknown>) => string;
}

export function formatTable(
  columns: TableColumn[],
  rows: Record<string, unknown>[],
  separator = ' | ',
): string {
  if (rows.length === 0) return '';

  const headers = columns.map(col => col.header);
  const lines: string[] = [];

  lines.push(headers.join(separator));
  lines.push(columns.map(col => '-'.repeat(col.width)).join('-+-'));

  for (const row of rows) {
    const cells = columns.map(col => {
      const value = col.value(row);
      return padOrTruncate(value, col.width);
    });
    lines.push(cells.join(separator));
  }

  return lines.join('\n');
}

function padOrTruncate(value: string, width: number): string {
  if (value.length <= width) {
    return value.padEnd(width);
  }
  return value.substring(0, width - 3) + '...';
}

export function createSection(title: string, lines: string[]): string {
  return [`\n## ${title}\n`, ...lines].join('\n');
}

export function createListItem(label: string, value: string): string {
  return `  ${label}: ${value}`;
}
