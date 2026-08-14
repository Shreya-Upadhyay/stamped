import { describe, expect, it } from 'vitest';

import { isUsefulPlaceName, pickPlaceName } from './place';

describe('isUsefulPlaceName', () => {
  it('rejects empty values', () => {
    expect(isUsefulPlaceName(null)).toBe(false);
    expect(isUsefulPlaceName(undefined)).toBe(false);
    expect(isUsefulPlaceName('')).toBe(false);
    expect(isUsefulPlaceName('   ')).toBe(false);
  });

  it('rejects Plus Codes', () => {
    // What Android hands back as `name` when it has no real placemark.
    expect(isUsefulPlaceName('HP3W+C7')).toBe(false);
    expect(isUsefulPlaceName('9F4M+2X')).toBe(false);
    expect(isUsefulPlaceName('8FVC9G8F+6W')).toBe(false);
  });

  it('rejects bare house numbers', () => {
    expect(isUsefulPlaceName('1')).toBe(false);
    expect(isUsefulPlaceName('12')).toBe(false);
    expect(isUsefulPlaceName('12a')).toBe(false);
    expect(isUsefulPlaceName('12-14')).toBe(false);
  });

  it('keeps real place names', () => {
    expect(isUsefulPlaceName('Neuschwanstein Castle')).toBe(true);
    expect(isUsefulPlaceName('Marienplatz')).toBe(true);
    expect(isUsefulPlaceName('Füssen')).toBe(true);
  });

  it('keeps names that merely contain digits', () => {
    // A number attached to a real name is still a name.
    expect(isUsefulPlaceName('10 Downing Street')).toBe(true);
    expect(isUsefulPlaceName('1st Avenue')).toBe(true);
  });
});

describe('pickPlaceName', () => {
  it('prefers the placemark when it is a real name', () => {
    expect(
      pickPlaceName({ name: 'Neuschwanstein Castle', street: 'Neuschwansteinstraße', city: 'Schwangau' }),
    ).toBe('Neuschwanstein Castle');
  });

  it('falls past a house-number placemark to the street', () => {
    expect(pickPlaceName({ name: '1', street: 'Ritterstraße', city: 'Füssen' })).toBe('Ritterstraße');
  });

  it('falls past a Plus Code all the way to the city', () => {
    expect(pickPlaceName({ name: 'HP3W+C7', street: null, district: null, city: 'Schwangau' })).toBe(
      'Schwangau',
    );
  });

  it('returns null when nothing usable is present', () => {
    expect(pickPlaceName({ name: '1', street: null, district: null, city: null })).toBeNull();
    expect(pickPlaceName({})).toBeNull();
  });
});
