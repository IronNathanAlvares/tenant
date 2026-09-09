import { RentCheck } from "./rent-check";

export default function Home() {
  return (
    <main>
      <h1>Is this rent even legal?</h1>
      <p className="lede">
        Irish rental law changed on 1 March 2026. Work out the most your landlord can lawfully
        charge, and whether the notice they served is valid.
      </p>

      {/* R-SAFE-01: the boundary is above the fold, not in the footer. */}
      <div className="boundary">
        <p>
          This tells you what the rules say. It is not legal advice and it cannot tell you how a
          dispute would be decided. Everything is worked out in your browser, so your rent and your
          address are never sent anywhere.
        </p>
      </div>

      <RentCheck />

      <footer>
        <p>
          Built against the Residential Tenancies Act 2004 as amended by the Residential Tenancies
          (Miscellaneous Provisions) Act 2026. Every figure links to the provision it comes from.
        </p>
        <p>
          Source, design notes and the measurements behind it on{" "}
          <a href="https://github.com/IronNathanAlvares/tenant">GitHub</a>.
        </p>
      </footer>
    </main>
  );
}
