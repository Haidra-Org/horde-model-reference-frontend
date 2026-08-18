import type { GroupMemberInfo, NameFormatInfo, ParsedNameInfo } from '../api-client';

type SortableTextModelMember = Pick<GroupMemberInfo, 'name' | 'parameters' | 'parsed'>;

const textCollator = new Intl.Collator(undefined, {
  sensitivity: 'base',
  numeric: false,
});

/**
 * Sort exact model records using the name structure inferred by the API.
 *
 * The model name itself is never parsed here. Size-aware ordering is enabled
 * only when the supplied schema places a size and every member has both the
 * inferred size token and its authoritative numeric parameter count. If that
 * metadata is incomplete, the entire collection uses ordinary alphabetical
 * ordering so the comparator remains stable and predictable.
 */
export function sortTextModelMembers<T extends SortableTextModelMember>(
  members: readonly T[],
  nameFormat: Pick<NameFormatInfo, 'part_order'> | null | undefined,
): T[] {
  const alphabetical = () =>
    [...members].sort((left, right) => textCollator.compare(left.name, right.name));
  const partOrder = nameFormat?.part_order ?? [];
  const hasReliableSizes =
    partOrder.includes('size') &&
    members.every(
      (member) =>
        Boolean(member.parsed.size) &&
        member.parameters != null &&
        Number.isFinite(member.parameters) &&
        member.parameters > 0,
    );

  if (!hasReliableSizes) return alphabetical();

  return [...members].sort((left, right) => {
    for (const part of partOrder) {
      if (part === 'size') {
        const sizeDifference = left.parameters! - right.parameters!;
        if (sizeDifference !== 0) return sizeDifference;
        continue;
      }

      const difference = textCollator.compare(
        parsedPartValue(left.parsed, part),
        parsedPartValue(right.parsed, part),
      );
      if (difference !== 0) return difference;
    }

    return textCollator.compare(left.name, right.name);
  });
}

/**
 * Sort parser-produced size labels using their members' numeric parameter data.
 *
 * A label is considered reliable only when at least one member associates that
 * exact inferred size with a positive parameter count and every such member
 * agrees. Any missing or conflicting association makes the complete label list
 * fall back to ordinary alphabetical order.
 */
export function sortParameterSizeLabels(
  labels: readonly string[],
  members: readonly SortableTextModelMember[],
): string[] {
  const alphabetical = () => [...labels].sort((left, right) => textCollator.compare(left, right));
  const parameterCounts = new Map<string, number>();
  const conflictingLabels = new Set<string>();

  for (const member of members) {
    const size = member.parsed.size;
    const parameters = member.parameters;
    if (!size || parameters == null || !Number.isFinite(parameters) || parameters <= 0) continue;

    const existing = parameterCounts.get(size);
    if (existing != null && existing !== parameters) {
      conflictingLabels.add(size);
    } else {
      parameterCounts.set(size, parameters);
    }
  }

  const hasReliableCounts = labels.every(
    (label) => parameterCounts.has(label) && !conflictingLabels.has(label),
  );
  if (!hasReliableCounts) return alphabetical();

  return [...labels].sort((left, right) => {
    const difference = parameterCounts.get(left)! - parameterCounts.get(right)!;
    return difference || textCollator.compare(left, right);
  });
}

function parsedPartValue(parsed: ParsedNameInfo, part: string): string {
  switch (part) {
    case 'base':
      return parsed.base_name;
    case 'variant':
      return parsed.variant ?? '';
    case 'quant':
      return parsed.quant ?? '';
    case 'version':
      return parsed.version ?? '';
    default:
      return '';
  }
}
