"use client";

import { CPI_SNAPSHOT, HICP_SNAPSHOT } from "@tenant/cpi";
import {
  buildPack,
  type Calculation,
  type Cents,
  type Determination,
  evaluateRent,
  formatEuroDisplay,
  type NewBuildExemption,
  parseDate,
  parseEuro,
  type RentQuery,
  type TenancyKind,
} from "@tenant/rules";
import { useMemo, useState } from "react";
import {
  AuditTrail,
  Choices,
  CiteLink,
  DateField,
  longDate,
  MoneyField,
  NextSteps,
  Provenance,
} from "./shared";
import { DisputePackSection } from "./shared-pack";

/**
 * The rent check.
 *
 * Everything runs here, in the browser. There is no API route, no server action and no
 * fetch. The rent and the dates never leave the device, which is the promise the page
 * makes and the reason the engine was written as a pure function. R-PRIV-01, ADR-0005.
 *
 * The form answers as you type rather than behind a submit button. For a page someone
 * opens while worried, watching the number appear is worth more than a tidy two-step flow.
 */

/**
 * When to show the statutory figure prominently rather than quietly.
 *
 * Sprint 2 measured the gap between the RTB's calculation and a strict reading of section
 * 19(4) across 2,720 cases: median 4.05 euro a month, maximum 173.36, and only 62 of 1,484
 * differing cases within five cent. So "it is only rounding" is false and the second figure
 * cannot be a footnote. One euro a month is the line: below it the difference is genuinely
 * not worth a worried person's attention, above it they should see it.
 *
 * See docs/measurements/02-engine-agreement.md and ADR-0006.
 */
const MATERIAL_GAP_CENTS = 100;

type FormState = {
  previousRent: string;
  previousSetting: string;
  newSetting: string;
  proposedRent: string;
  tenancyKind: TenancyKind;
  newBuildExemption: NewBuildExemption;
};

const EMPTY: FormState = {
  previousRent: "",
  previousSetting: "",
  newSetting: "",
  proposedRent: "",
  tenancyKind: "private",
  newBuildExemption: "no",
};

function tryParseEuro(value: string): Cents | null {
  try {
    return parseEuro(value);
  } catch {
    return null;
  }
}

function tryParseDate(value: string) {
  try {
    return parseDate(value);
  } catch {
    return null;
  }
}

export function RentCheck() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  const query = useMemo<RentQuery | null>(() => {
    const previousRent = tryParseEuro(form.previousRent);
    const previousSetting = tryParseDate(form.previousSetting);
    const newSetting = tryParseDate(form.newSetting);
    if (previousRent === null || previousSetting === null || newSetting === null) {
      return null;
    }
    const proposedRent = tryParseEuro(form.proposedRent);
    return {
      tenancyKind: form.tenancyKind,
      previousRent,
      previousSetting,
      newSetting,
      newBuildExemption: form.newBuildExemption,
      asOf: newSetting,
      ...(proposedRent !== null ? { proposedRent } : {}),
    };
  }, [form]);

  const result = useMemo(
    () => (query === null ? null : evaluateRent(query, CPI_SNAPSHOT, HICP_SNAPSHOT)),
    [query],
  );

  const rentError =
    form.previousRent !== "" && tryParseEuro(form.previousRent) === null
      ? "Enter an amount like 1500 or 1500.50."
      : undefined;

  return (
    <>
      <form onSubmit={(event) => event.preventDefault()} noValidate>
        <MoneyField
          id="previous-rent"
          label="What rent are you paying now?"
          hint="Per month, before the increase."
          value={form.previousRent}
          onValueChange={(value) => set("previousRent", value)}
          {...(rentError !== undefined ? { error: rentError } : {})}
        />

        <DateField
          id="previous-setting"
          label="When was that rent last set?"
          hint="The date your tenancy started, or the date of the last rent review. Not the date you moved in, if the rent changed since."
          value={form.previousSetting}
          onValueChange={(value) => set("previousSetting", value)}
        />

        <DateField
          id="new-setting"
          label="When does the new rent start?"
          hint="The date on the notice you were given."
          value={form.newSetting}
          onValueChange={(value) => set("newSetting", value)}
        />

        {/*
          This lives in the main form rather than behind the disclosure, because it changes
          which regime applies and therefore changes the answer. It was briefly hidden with
          a default of "unknown", which meant every first-time visitor got the two-branch
          "it depends" result instead of an answer. Defaulting it to "no" while hiding it
          would have been worse: it would quietly assume people out of a regime they might
          be in. So it is visible, and it defaults to the common case.
        */}
        <Choices
          name="new-build"
          legend="Is it a recently built apartment or student accommodation?"
          hint="Only counts if building work was notified to the council on or after 10 June 2025. Those are exempt from the 2 per cent cap. Most homes are not, so leave this as No if you are unsure it applies."
          value={form.newBuildExemption}
          onChange={(value) => set("newBuildExemption", value)}
          options={[
            { value: "no", label: "No" },
            { value: "yes", label: "Yes" },
            { value: "unknown", label: "I don't know" },
          ]}
        />

        <details className="more">
          <summary>Add more detail for a more precise answer</summary>

          <MoneyField
            id="proposed-rent"
            label="What is the landlord asking for?"
            hint="Optional. If you give this, we will say whether it is within the limit."
            value={form.proposedRent}
            onValueChange={(value) => set("proposedRent", value)}
          />

          <Choices
            name="tenancy-kind"
            legend="What kind of tenancy is it?"
            hint="If you rent from a private landlord or an agent, leave this as private."
            value={form.tenancyKind}
            onChange={(value) => set("tenancyKind", value)}
            options={[
              { value: "private", label: "Private" },
              { value: "student-specific-accommodation", label: "Student accommodation" },
              { value: "approved-housing-body", label: "Housing body" },
              { value: "cost-rental", label: "Cost rental" },
            ]}
          />
        </details>
      </form>

      <div aria-live="polite">
        {result === null ? (
          <p className="muted">
            Fill in those three answers and the result appears here. Nothing is sent anywhere.
          </p>
        ) : (
          <Result determination={result} proposed={query?.proposedRent} />
        )}
      </div>
    </>
  );
}

function Result({
  determination,
  proposed,
}: {
  determination: Determination;
  proposed: Cents | undefined;
}) {
  return (
    <>
      <div className="result">
        <Verdict determination={determination} proposed={proposed} />
      </div>

      {determination.outcome === "capped" && (
        <a className="crosslink" href="/notice">
          Now check whether the notice itself was valid
          <span>
            An increase inside the limit can still be worth nothing if the notice was served
            wrongly. This is where most tenants actually have an argument.
          </span>
        </a>
      )}

      <NextSteps />

      <DisputePackSection
        pack={buildPack(determination, null, {
          today: parseDate(new Date().toISOString().slice(0, 10)),
        })}
        rentTitle="What we worked out about the amount"
        noticeTitle="What we worked out about the notice"
      />

      <Provenance
        rulesVersion={determination.provenance.rulesVersion}
        cpiLatestMonth={determination.provenance.cpiLatestMonth}
        cpiSha={determination.provenance.cpiSnapshotSha256}
      />
    </>
  );
}

function Verdict({
  determination,
  proposed,
}: {
  determination: Determination;
  proposed: Cents | undefined;
}) {
  switch (determination.outcome) {
    case "capped": {
      const { headline, statutory } = determination;
      const lawful = determination.proposedIsLawful;
      const tone = lawful === null ? "warn" : lawful ? "ok" : "bad";
      const label = lawful === null ? "The limit" : lawful ? "Within the limit" : "Over the limit";
      return (
        <>
          <div className={`verdict ${tone}`}>
            <span className="verdict-label">{label}</span>
            <h2>
              The most they can lawfully charge is{" "}
              <span className="visually-hidden">{formatEuroDisplay(headline.maxRent)}</span>
            </h2>
            <span className="figure" aria-hidden="true">
              {formatEuroDisplay(headline.maxRent)}
            </span>
            <p className="figure-note">
              An increase of {formatEuroDisplay(headline.maxIncrease)} a month. That second figure
              is what the RTB's own calculator shows you.
            </p>
            {lawful === false && proposed !== undefined && (
              <p>
                <strong>
                  You are being asked for {formatEuroDisplay(proposed)}, which is{" "}
                  {formatEuroDisplay((proposed - headline.maxRent) as Cents)} a month above that
                  limit.
                </strong>
              </p>
            )}
            {lawful === true && (
              <p>The amount you were asked for is within the limit, on these dates.</p>
            )}
          </div>

          <StatutoryDivergence headline={headline} statutory={statutory} />

          <section className="panel">
            <h3>How that was worked out</h3>
            <AuditTrail steps={determination.audit} />
          </section>
        </>
      );
    }

    case "no-cap":
      return (
        <div className="verdict warn">
          <span className="verdict-label">No percentage limit applies</span>
          <h2>There is no 2 per cent or CPI cap on this tenancy</h2>
          <p>{determination.explanation}</p>
          <p>
            The one limit that still applies is that the rent may not be above the market rent for a
            similar home nearby.
          </p>
          {determination.citations.map((citation) => (
            <div key={`${citation.act}-${citation.provision}`}>
              <CiteLink citation={citation} />
            </div>
          ))}
        </div>
      );

    case "unknown":
      return (
        <>
          <div className="verdict warn">
            <span className="verdict-label">It depends on one thing</span>
            <h2>The answer turns on a question only your landlord can answer</h2>
            <p>{determination.question}</p>
            <p className="small">{determination.howToFindOut}</p>
          </div>
          {determination.branches.map((branch) => (
            <section className="panel" key={branch.answer}>
              <h3>{branch.answer}</h3>
              {branch.determination.outcome === "capped" && (
                <>
                  <span className="figure">
                    {formatEuroDisplay(branch.determination.headline.maxRent)}
                  </span>
                  <p className="figure-note">
                    An increase of {formatEuroDisplay(branch.determination.headline.maxIncrease)} a
                    month.
                  </p>
                </>
              )}
            </section>
          ))}
        </>
      );

    case "not-answerable":
      return (
        <div className="verdict warn">
          <span className="verdict-label">This tool cannot answer</span>
          <h2>{determination.problem}</h2>
          <p>{determination.detail}</p>
        </div>
      );

    default:
      return null;
  }
}

/**
 * Where the RTB's calculation and a strict reading of section 19(4) disagree.
 *
 * Shown prominently when the gap is a euro a month or more, and only as a quiet line
 * below that. The wording changes with the direction, because the two directions mean
 * completely different things to the reader: if the statutory figure is lower, the
 * landlord following the official tool may still be over the statutory cap.
 */
function StatutoryDivergence({
  headline,
  statutory,
}: {
  headline: Calculation;
  statutory: Calculation;
}) {
  const gap = statutory.maxRent - headline.maxRent;
  if (gap === 0) return null;

  if (Math.abs(gap) < MATERIAL_GAP_CENTS) {
    return (
      <section className="panel">
        <p className="small muted">
          Reading the Act strictly gives {formatEuroDisplay(statutory.maxRent)}, a difference of{" "}
          {formatEuroDisplay(Math.abs(gap) as Cents)} a month. Too small to be worth acting on, but
          recorded so the figures add up.
        </p>
      </section>
    );
  }

  const statutoryIsLower = gap < 0;
  return (
    <section className="panel">
      <span className={`sev ${statutoryIsLower ? "warn" : "info"}`}>Worth knowing</span>
      <h3>The official calculator and the Act itself do not agree here</h3>
      <p>
        The figure above follows the RTB's own rent calculator, because that is what your landlord
        will have used. Reading section 19(4) strictly gives{" "}
        <strong>{formatEuroDisplay(statutory.maxRent)}</strong>, a difference of{" "}
        <strong>{formatEuroDisplay(Math.abs(gap) as Cents)} a month</strong>.
      </p>
      {statutoryIsLower ? (
        <p>
          The strict reading is the <em>lower</em> of the two. So there is an argument that the
          increase goes above what the Act allows, even if your landlord used the official
          calculator correctly. That is a real argument, but it means disagreeing with the RTB's own
          tool, which is a harder thing to do than pointing out an arithmetic mistake. Worth putting
          to Threshold before you rely on it.
        </p>
      ) : (
        <p>
          The strict reading is the higher of the two here, so following the RTB's figure is the
          safer number for you. It is shown only so the difference is not hidden.
        </p>
      )}
      <p className="small muted">
        The two differ because the Act and the calculator pick different months of CPI, and measure
        part of a year differently. Across a few thousand test cases the gap is usually a few euro a
        month and occasionally much more.
      </p>
    </section>
  );
}

export { longDate };
