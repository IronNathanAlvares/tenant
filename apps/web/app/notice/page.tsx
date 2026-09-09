import type { Metadata } from "next";
import { NoticeCheck } from "./notice-check";

export const metadata: Metadata = {
  title: "Was the rent notice valid?",
  description:
    "Check an Irish rent review notice against section 22 of the Residential Tenancies Act 2004, including the same-day RTB rule that came in on 1 March 2026.",
};

export default function NoticePage() {
  return (
    <main>
      <p className="small muted">
        <a href="/">Is this rent even legal?</a>
      </p>
      <h1>Was the notice valid?</h1>
      <p className="lede">
        An increase can be inside the legal limit and still worth nothing, because the notice asking
        for it was served wrongly. This is where most tenants actually have an argument.
      </p>

      <div className="boundary">
        <p>
          This tells you what the rules say. It is not legal advice and it cannot tell you how a
          dispute would be decided. Everything is worked out in your browser, so nothing you type is
          sent anywhere.
        </p>
      </div>

      <NoticeCheck />

      <footer>
        <p>
          Checked against section 22 of the Residential Tenancies Act 2004 as amended. Every finding
          links to the provision it comes from.
        </p>
        <p>
          Source and design notes on{" "}
          <a href="https://github.com/IronNathanAlvares/tenant">GitHub</a>.
        </p>
      </footer>
    </main>
  );
}
