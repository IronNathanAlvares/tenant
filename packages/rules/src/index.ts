/**
 * @tenant/rules
 *
 * A pure evaluation of Irish rent control. No I/O, no clock, no network, no
 * environment access. Time enters as an explicit `asOf` parameter and CPI enters as an
 * injected snapshot, so a determination is reproducible from its inputs alone.
 *
 * See docs/adr/ADR-0005-typescript-and-a-pure-engine.md.
 */

export {
  addCents,
  type Cents,
  cents,
  formatEuro,
  formatEuroDisplay,
  parseEuro,
  subtractCents,
} from "./money";

/** Bumped whenever the encoded rules change, and recorded on every determination. */
export const RULES_VERSION = "0.0.0-scaffold";
