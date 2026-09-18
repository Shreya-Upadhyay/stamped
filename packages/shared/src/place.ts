/**
 * Picking a human place name out of what a device geocoder returns.
 *
 * The OS placemark (`name`) is the best label when it's a real one —
 * "Neuschwanstein Castle" — but when the geocoder has nothing to say it
 * substitutes a house number or a Plus Code, which are worse than useless as
 * the title of a stop. These helpers filter that out and fall back to
 * progressively broader labels.
 */

/**
 * Open Location Code, e.g. "HP3W+C7" or "8FVC9G8F+6W". The alphabet
 * deliberately excludes vowels and similar-looking characters.
 */
const PLUS_CODE = /^[23456789CFGHJMPQRVWX]{2,8}\+[23456789CFGHJMPQRVWX]{2,3}$/i;

/** A bare street number: "1", "12a", "12-14". */
const HOUSE_NUMBER = /^\d+\s*[a-z]?(\s*[-/]\s*\d+\s*[a-z]?)?$/i;

/** Whether a geocoder field reads as a place a person would recognise. */
export function isUsefulPlaceName(value: string | null | undefined): boolean {
  if (value == null) return false;
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  return !PLUS_CODE.test(trimmed) && !HOUSE_NUMBER.test(trimmed);
}

/** The subset of a reverse-geocoded address this picks between. */
export interface PlaceNameParts {
  name?: string | null;
  street?: string | null;
  district?: string | null;
  city?: string | null;
}

/**
 * The most specific usable label for a point, or null if there is none.
 *
 * Order matters: a landmark beats a street, a street beats a neighbourhood,
 * and a neighbourhood beats the city — but any of them is skipped when it's
 * really a house number or a Plus Code in disguise.
 */
export function pickPlaceName(parts: PlaceNameParts): string | null {
  for (const candidate of [parts.name, parts.street, parts.district, parts.city]) {
    if (isUsefulPlaceName(candidate)) return candidate!.trim();
  }
  return null;
}
