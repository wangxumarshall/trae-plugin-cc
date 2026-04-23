export function parseFlag(args: string[], flag: string, startFrom = 0): number {
  for (let i = startFrom; i < args.length; i++) {
    if (args[i] === flag) return i;
  }
  return -1;
}

export function parseBool(args: string[], flags: string[], startFrom = 0): boolean {
  for (const flag of flags) {
    if (parseFlag(args, flag, startFrom) >= 0) return true;
  }
  return false;
}

export function parseValue(
  args: string[],
  flags: string[],
  startFrom = 0,
): { value: string | null; index: number } {
  for (const flag of flags) {
    const idx = parseFlag(args, flag, startFrom);
    if (idx >= 0) {
      if (flag.includes('=')) {
        return { value: args[idx].substring(flag.length), index: idx };
      }
      if (idx + 1 < args.length && !args[idx + 1].startsWith('-')) {
        return { value: args[idx + 1], index: idx };
      }
      return { value: null, index: idx };
    }
  }
  return { value: null, index: -1 };
}

export function parseMultiValue(
  args: string[],
  flag: string,
  startFrom = 0,
): string[] {
  const values: string[] = [];
  let i = startFrom;
  while (i < args.length) {
    if (args[i] === flag && i + 1 < args.length) {
      values.push(args[i + 1]);
      i += 2;
    } else {
      i++;
    }
  }
  return values;
}

export function getNonFlagArgs(args: string[]): string[] {
  return args.filter(arg => !arg.startsWith('-'));
}
