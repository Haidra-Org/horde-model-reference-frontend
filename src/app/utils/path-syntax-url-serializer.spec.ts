import { describe, expect, it } from 'vitest';
import { PathSyntaxUrlSerializer } from './path-syntax-url-serializer';

describe('PathSyntaxUrlSerializer', () => {
  const serializer = new PathSyntaxUrlSerializer();

  function segments(url: string): string[] {
    return serializer.parse(url).root.children['primary'].segments.map((s) => s.path);
  }

  it('keeps a slash-bearing model name as one segment on a literal URL', () => {
    expect(segments('/categories/text_generation/model/koboldcpp/Marx-3B-V3')).toEqual([
      'categories',
      'text_generation',
      'model',
      'koboldcpp/Marx-3B-V3',
    ]);
  });

  it('keeps a parenthesised model name whole on a literal URL', () => {
    expect(segments('/categories/image_generation/model/AlbedoBase%20XL%20(SDXL)')).toEqual([
      'categories',
      'image_generation',
      'model',
      'AlbedoBase XL (SDXL)',
    ]);
  });

  it('reads the percent-encoded form the same way', () => {
    expect(segments('/categories/image_generation/model/AlbedoBase%20XL%20%28SDXL%29')).toEqual([
      'categories',
      'image_generation',
      'model',
      'AlbedoBase XL (SDXL)',
    ]);
    expect(segments('/categories/clip/model/ViT-L%2F14')).toEqual([
      'categories',
      'clip',
      'model',
      'ViT-L/14',
    ]);
  });

  it('treats the edit route the same way', () => {
    expect(segments('/categories/text_generation/edit/aphrodite/acrastt/Marx-3B-V3')).toEqual([
      'categories',
      'text_generation',
      'edit',
      'aphrodite/acrastt/Marx-3B-V3',
    ]);
  });

  it('keeps a semicolon in a name as text rather than matrix parameters', () => {
    const tree = serializer.parse('/categories/text_generation/model/a;b');
    const last = tree.root.children['primary'].segments.at(-1);
    expect(last?.path).toBe('a;b');
    expect(last?.parameters).toEqual({});
  });

  it('leaves other routes to the default parser', () => {
    expect(segments('/text-groups/group')).toEqual(['text-groups', 'group']);
    expect(segments('/categories/image_generation')).toEqual(['categories', 'image_generation']);
  });

  it('serializes back to the encoded form the router itself produces', () => {
    const tree = serializer.parse('/categories/text_generation/model/koboldcpp/Marx-3B-V3');
    expect(serializer.serialize(tree)).toBe(
      '/categories/text_generation/model/koboldcpp%2FMarx-3B-V3',
    );
  });

  it('leaves query strings and fragments in place', () => {
    const tree = serializer.parse('/categories/text_generation/model/a/b?tab=usage#top');
    expect(tree.root.children['primary'].segments.at(-1)?.path).toBe('a/b');
    expect(tree.queryParams['tab']).toBe('usage');
    expect(tree.fragment).toBe('top');
  });
});
