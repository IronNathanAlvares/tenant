/**
 * Money as integer minor units (cent). Nothing in this package may hold an amount
 * of money in a float.
 *
 * Rent figures end up in a document a tenant may bring to an RTB adjudication, so
 * an amount that is off by a cent because of binary floating point is not an
 * acceptable failure. Parsing happens once, at the edge, and everything after that
 * is integer arithmetic.
 *
 * One caveat that matters later. The RTB's own calculator computes
 * `Math.round(rent * factor * 100) / 100` in floats. Where we need to reproduce its
 * output exactly rather than compute the statutory figure, we have to reproduce that
 * arithmetic too, not just the rule. See ADR-0006. That replication belongs in the
 * reference oracle, not here.
 */

/** An amount of euro, held as a whole number of cent. */
export type Cents = number & { readonly __brand: "Cents" };

const MAX_CENTS = Number.MAX_SAFE_INTEGER;

export function cents(value: number): Cents {
  if (!Number.isInteger(value)) {
    throw new RangeError(`Cents must be a whole number, got ${value}`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`Cents out of safe integer range: ${value}`);
  }
  return value as Cents;
}

/**
 * Parse a euro amount written the way a person writes it: "1550", "1550.5",
 * "1550.50", "1,550.50", "€1550.50". Rejects anything with more than two decimal
 * places rather than silently rounding, because a rent of "1550.505" is a typo and
 * guessing which way the user meant it to go is not our call.
 */
export function parseEuro(input: string): Cents {
  const cleaned = input.trim().replace(/^€/, "").replace(/,/g, "").trim();
  if (cleaned === "") {
    throw new SyntaxError("Empty amount");
  }
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) {
    throw new SyntaxError(`Not a valid euro amount: ${JSON.stringify(input)}`);
  }
  const [, sign, whole, fraction = ""] = match;
  // The regex guarantees these groups, but noUncheckedIndexedAccess does not know that.
  if (whole === undefined) {
    throw new SyntaxError(`Not a valid euro amount: ${JSON.stringify(input)}`);
  }
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (minor > MAX_CENTS) {
    throw new RangeError(`Amount too large: ${input}`);
  }
  return cents(sign === "-" ? -minor : minor);
}

/** Render for display: always two decimal places, no currency symbol. */
export function formatEuro(amount: Cents): string {
  const negative = amount < 0;
  const abs = Math.abs(amount);
  const whole = Math.floor(abs / 100);
  const minor = abs % 100;
  return `${negative ? "-" : ""}${whole}.${String(minor).padStart(2, "0")}`;
}

/** Render with thousands separators, for the interface rather than the audit trail. */
export function formatEuroDisplay(amount: Cents): string {
  const plain = formatEuro(amount);
  const [whole = "0", minor = "00"] = plain.replace("-", "").split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${amount < 0 ? "-" : ""}€${grouped}.${minor}`;
}

export function addCents(a: Cents, b: Cents): Cents {
  return cents(a + b);
}

export function subtractCents(a: Cents, b: Cents): Cents {
  return cents(a - b);
}
