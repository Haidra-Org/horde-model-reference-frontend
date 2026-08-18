import type { GroupMemberInfo, NameFormatInfo } from '../api-client';
import { sortParameterSizeLabels, sortTextModelMembers } from './text-model-sort';

const inferredFormat: NameFormatInfo = {
  separator: '-',
  part_order: ['base', 'size', 'variant'],
  author_included: false,
  template: '{base}-{size}-{variant}',
};

function member(
  name: string,
  size: string | null,
  parameters: number | null,
  variant: string | null = null,
): GroupMemberInfo {
  return {
    name,
    parameters,
    parsed: {
      base_name: 'Example',
      size,
      variant,
    },
  };
}

describe('sortTextModelMembers', () => {
  it('orders inferred decimal and multi-digit sizes by actual parameter count', () => {
    const members = [
      member('Example-0.5B', '0.5B', 500_000_000),
      member('Example-1.8B', '1.8B', 1_800_000_000),
      member('Example-100B', '100B', 100_000_000_000),
      member('Example-8B', '8B', 8_000_000_000),
    ];

    expect(sortTextModelMembers(members, inferredFormat).map(({ name }) => name)).toEqual([
      'Example-0.5B',
      'Example-1.8B',
      'Example-8B',
      'Example-100B',
    ]);
  });

  it('respects the inferred part order around the numeric size', () => {
    const variantThenSize = { ...inferredFormat, part_order: ['base', 'variant', 'size'] };
    const members = [
      member('Example-Chat-70B', '70B', 70_000_000_000, 'Chat'),
      member('Example-Instruct-7B', '7B', 7_000_000_000, 'Instruct'),
      member('Example-Chat-8B', '8B', 8_000_000_000, 'Chat'),
    ];

    expect(sortTextModelMembers(members, variantThenSize).map(({ name }) => name)).toEqual([
      'Example-Chat-8B',
      'Example-Chat-70B',
      'Example-Instruct-7B',
    ]);
  });

  it('falls back to ordinary alphabetical order when inferred size metadata is incomplete', () => {
    const members = [
      member('Example-8B', '8B', 8_000_000_000),
      member('Example-100B', null, 100_000_000_000),
      member('Example-1.8B', '1.8B', 1_800_000_000),
    ];

    expect(sortTextModelMembers(members, inferredFormat).map(({ name }) => name)).toEqual([
      'Example-1.8B',
      'Example-100B',
      'Example-8B',
    ]);
  });

  it('falls back to ordinary alphabetical order when no inferred schema is available', () => {
    const members = [
      member('Example-8B', '8B', 8_000_000_000),
      member('Example-100B', '100B', 100_000_000_000),
      member('Example-1.8B', '1.8B', 1_800_000_000),
    ];

    expect(sortTextModelMembers(members, null).map(({ name }) => name)).toEqual([
      'Example-1.8B',
      'Example-100B',
      'Example-8B',
    ]);
  });
});

describe('sortParameterSizeLabels', () => {
  it('orders size pills from the same inferred member metadata as the model list', () => {
    const members = [
      member('Example-0.5B', '0.5B', 500_000_000),
      member('Example-1.8B', '1.8B', 1_800_000_000),
      member('Example-100B', '100B', 100_000_000_000),
      member('Example-8B', '8B', 8_000_000_000),
    ];

    expect(sortParameterSizeLabels(['0.5B', '1.8B', '100B', '8B'], members)).toEqual([
      '0.5B',
      '1.8B',
      '8B',
      '100B',
    ]);
  });

  it('uses alphabetical order rather than guessing when a label has no member metadata', () => {
    const members = [
      member('Example-8B', '8B', 8_000_000_000),
      member('Example-100B', '100B', 100_000_000_000),
    ];

    expect(sortParameterSizeLabels(['8B', '100B', 'custom'], members)).toEqual([
      '100B',
      '8B',
      'custom',
    ]);
  });
});
