import { describe, it, expect } from 'vitest';
import { DEFAULT_COMPLEX_DATA } from './catalogData';

describe('Project views fallback', () => {
  it('DEFAULT_COMPLEX_DATA.views contains relative URLs that would fail @IsUrl()', () => {
    const mockViews = DEFAULT_COMPLEX_DATA.views;
    expect(mockViews.length).toBeGreaterThan(0);
    const relativeUrls = mockViews.filter((v) => v.imageUrl.startsWith('/'));
    expect(relativeUrls.length).toBeGreaterThan(0);
    expect(relativeUrls.map((v) => v.id)).toEqual(['view-masterplan', 'view-aerial']);
  });

  it('project.views ?? [] produces empty array when API returns null', () => {
    const apiResponse = { views: null } as { views: typeof DEFAULT_COMPLEX_DATA.views | null };
    const result = apiResponse.views ?? [];
    expect(result).toEqual([]);
    expect(result).not.toEqual(DEFAULT_COMPLEX_DATA.views);
  });

  it('project.views ?? [] preserves real views when API returns data', () => {
    const realViews = [{ id: 'v1', title: 'Test', imageUrl: 'https://pub.example.com/view.jpg' }];
    const apiResponse = { views: realViews } as { views: typeof DEFAULT_COMPLEX_DATA.views | null };
    const result = apiResponse.views ?? [];
    expect(result).toEqual(realViews);
  });
});
