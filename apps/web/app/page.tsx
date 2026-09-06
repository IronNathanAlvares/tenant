import { RULES_VERSION } from "@tenant/rules";

export default function Home() {
  return (
    <main>
      <p className="eyebrow">Coming soon</p>
      <h1>Is this rent even legal?</h1>
      <p className="lede">
        Irish rental law changed on 1 March 2026. Rent Pressure Zones are gone, the inflation
        measure changed, and a rent review notice that does not reach the RTB on the same day it
        reaches you is invalid.
      </p>
      <p>
        This will tell you whether the rent you are being asked to pay is lawful, and whether the
        notice asking for it is valid. It is being built in the open.
      </p>

      <h2>What it will do</h2>
      <ul>
        <li>
          <strong>Rent check.</strong> Work out the maximum lawful rent for your tenancy and show
          the calculation step by step, citing the provision it comes from.
        </li>
        <li>
          <strong>Notice check.</strong> Check the notice you received against section 22 of the
          Residential Tenancies Act 2004, including the same-day RTB rule that almost nobody knows
          about.
        </li>
        <li>
          <strong>What to do next.</strong> A printable pack you could bring to the RTB, and the
          deadline you need to act before.
        </li>
      </ul>

      <p className="boundary">
        It will tell you what the rules say. It is not legal advice. For advice, Threshold run a
        free national service on 1800 454 454.
      </p>

      <footer>
        <p>
          Source and design notes on{" "}
          <a href="https://github.com/IronNathanAlvares/tenant">GitHub</a>. Rules version{" "}
          <code>{RULES_VERSION}</code>.
        </p>
      </footer>
    </main>
  );
}
