"use client";

import {
  type Answer,
  assessNotice,
  type DisputeDeadline,
  type NoticeAssessment,
  type NoticeContents,
  type NoticeQuery,
  parseDate,
  type Severity,
  severityRank,
} from "@tenant/rules";
import { useMemo, useState } from "react";
import { Choices, CiteLink, DateField, longDate, NextSteps } from "../shared";

/**
 * The notice check.
 *
 * A rent increase can be perfectly inside the cap and still worth nothing, because section
 * 22(1) makes the new rent ineffective unless the section 22(2) condition is met. The
 * condition is easy to breach and the most breachable part is only months old: since
 * 1 March 2026 a copy has to reach the RTB the same day it reaches the tenant.
 *
 * The form is ordered by how much each answer is worth, not by the order of the Act. The
 * service dates come first because they decide most cases on their own, and the twelve
 * content questions sit behind a disclosure so nobody has to answer them to get something
 * useful.
 */

type ServedOnBoard = "same-day" | "different-day" | "not-served" | "unknown";

type FormState = {
  servedOnTenant: string;
  newRentEffectiveFrom: string;
  boardAnswer: ServedOnBoard;
  boardDate: string;
  previousSetting: string;
  tenancyStart: string;
  contents: NoticeContents;
};

const EMPTY: FormState = {
  servedOnTenant: "",
  newRentEffectiveFrom: "",
  boardAnswer: "unknown",
  boardDate: "",
  previousSetting: "",
  tenancyStart: "",
  contents: {},
};

const CONTENT_QUESTIONS: { key: keyof NoticeContents; label: string; hint?: string }[] = [
  {
    key: "prescribedForm",
    label: "Is it on the RTB's official Notice of Rent Review form?",
    hint: "The RTB template, not a letter or an email written from scratch.",
  },
  {
    key: "showsCalculation",
    label: "Does it show how the new rent was worked out?",
    hint: "Usually a printout from the RTB Rent Calculator attached to the notice.",
  },
  {
    key: "threeComparables",
    label: "Does it list three similar properties for comparison?",
  },
  {
    key: "comparablesHaveRtNumbers",
    label: "Do those three have RTB registration numbers beside them?",
    hint: "Without the numbers they cannot be checked against the register.",
  },
  {
    key: "statesDisputeDeadline",
    label: "Does it tell you the deadline for disputing the increase?",
  },
  {
    key: "marketRentStatement",
    label: "Does it state that the new rent is not above market rent?",
  },
  {
    key: "statesFloorArea",
    label: "Does it state the floor area of your home?",
  },
  {
    key: "statesSignatureDate",
    label: "Does it show the date it was signed?",
  },
  {
    key: "signed",
    label: "Is it signed by the landlord or their agent?",
  },
];

const YES_NO_UNKNOWN: readonly { value: Answer; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "unknown", label: "Not sure" },
];

function tryParseDate(value: string) {
  try {
    return parseDate(value);
  } catch {
    return null;
  }
}

export function NoticeCheck() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  const query = useMemo<NoticeQuery | null>(() => {
    const servedOnTenant = tryParseDate(form.servedOnTenant);
    const effective = tryParseDate(form.newRentEffectiveFrom);
    if (servedOnTenant === null || effective === null) return null;

    const boardDate = tryParseDate(form.boardDate);
    const servedOnBoard =
      form.boardAnswer === "same-day"
        ? servedOnTenant
        : form.boardAnswer === "different-day"
          ? (boardDate ?? "unknown")
          : form.boardAnswer;

    const previousSetting = tryParseDate(form.previousSetting);
    const tenancyStart = tryParseDate(form.tenancyStart);

    return {
      servedOnTenant,
      newRentEffectiveFrom: effective,
      servedOnBoard,
      contents: form.contents,
      // The engine takes the current date explicitly. It never reads a clock itself, so
      // the page supplies one here and only here. R-DATE-02.
      asOf: parseDate(new Date().toISOString().slice(0, 10)),
      ...(previousSetting !== null ? { previousSetting } : {}),
      ...(tenancyStart !== null ? { tenancyStart } : {}),
    };
  }, [form]);

  const result = useMemo(() => (query === null ? null : assessNotice(query)), [query]);

  return (
    <>
      <form onSubmit={(event) => event.preventDefault()} noValidate>
        <DateField
          id="served-on-tenant"
          label="When were you given the notice?"
          hint="The date it arrived, by post or by email."
          value={form.servedOnTenant}
          onValueChange={(value) => set("servedOnTenant", value)}
        />

        <DateField
          id="effective-from"
          label="When does the new rent start?"
          hint="The date stated on the notice."
          value={form.newRentEffectiveFrom}
          onValueChange={(value) => set("newRentEffectiveFrom", value)}
        />

        <Choices
          name="board"
          legend="Was a copy sent to the RTB on the same day?"
          hint="This is the question that decides most cases. Since 1 March 2026 the landlord must send the RTB a copy on the same day they send it to you, or the increase does not take effect. If they posted it rather than uploading it, it very likely missed the day. You can ask the RTB when they received it."
          value={form.boardAnswer}
          onChange={(value) => set("boardAnswer", value)}
          options={[
            { value: "same-day", label: "Yes, same day" },
            { value: "different-day", label: "A different day" },
            { value: "not-served", label: "Never sent" },
            { value: "unknown", label: "Not sure" },
          ]}
        />

        {form.boardAnswer === "different-day" && (
          <DateField
            id="board-date"
            label="What day did the RTB get it?"
            value={form.boardDate}
            onValueChange={(value) => set("boardDate", value)}
          />
        )}

        <details className="more">
          <summary>When was your rent last set, and when did the tenancy start?</summary>
          <DateField
            id="previous-setting"
            label="When was the rent last set or reviewed?"
            hint="Used to check the landlord is not reviewing too often."
            value={form.previousSetting}
            onValueChange={(value) => set("previousSetting", value)}
          />
          <DateField
            id="tenancy-start"
            label="When did your tenancy start?"
            value={form.tenancyStart}
            onValueChange={(value) => set("tenancyStart", value)}
          />
        </details>

        <details className="more">
          <summary>What does the notice actually say? (nine questions)</summary>
          <p className="small muted">
            You can skip any of these. Anything you leave unanswered is listed at the end rather
            than treated as fine.
          </p>
          {CONTENT_QUESTIONS.map((question) => (
            <Choices
              key={question.key}
              name={question.key}
              legend={question.label}
              {...(question.hint !== undefined ? { hint: question.hint } : {})}
              value={form.contents[question.key] ?? "unknown"}
              onChange={(value) => set("contents", { ...form.contents, [question.key]: value })}
              options={YES_NO_UNKNOWN}
            />
          ))}
        </details>
      </form>

      <div aria-live="polite">
        {result === null ? (
          <p className="muted">
            Answer the first two questions and the result appears here. Nothing is sent anywhere.
          </p>
        ) : (
          <Assessment result={result} />
        )}
      </div>
    </>
  );
}

function Assessment({ result }: { result: NoticeAssessment }) {
  const voiding = result.defects.filter((d) => d.severity === "rent-has-no-effect");
  const sorted = [...result.defects].sort(
    (a, b) => severityRank(a.severity) - severityRank(b.severity),
  );

  const tone =
    result.rentTakesEffect === false ? "bad" : result.rentTakesEffect === true ? "ok" : "warn";
  const heading =
    result.rentTakesEffect === false
      ? "On what you have told us, this increase did not take effect"
      : result.rentTakesEffect === true
        ? "Nothing here makes the notice invalid"
        : "Some of this could not be checked";

  return (
    <>
      <div className="result">
        <div className={`verdict ${tone}`}>
          <span className="verdict-label">
            {result.rentTakesEffect === false
              ? `${voiding.length} serious problem${voiding.length === 1 ? "" : "s"}`
              : result.rentTakesEffect === true
                ? "No problems found"
                : "Incomplete"}
          </span>
          <h2>{heading}</h2>
          {result.rentTakesEffect === false && (
            <p>
              A rent set on review has no effect at all unless the notice requirements are met. That
              does not mean the money stops on its own. It means you have grounds to dispute it, and
              you have to do that before the deadline below.
            </p>
          )}
          {result.rentTakesEffect === true && (
            <p>
              That only covers what you answered. It does not mean the amount is right, which is a
              separate question.
            </p>
          )}
        </div>

        {result.disputeDeadline !== null && <Deadline deadline={result.disputeDeadline} />}

        {sorted.length > 0 && (
          <section className="panel">
            <h3>What is wrong with it</h3>
            <ul className="defects">
              {sorted.map((defect) => (
                <li key={defect.id}>
                  <SeverityTag severity={defect.severity} />
                  <p>
                    <strong>{defect.finding}</strong>
                  </p>
                  <p className="small muted">{defect.requirement}</p>
                  <CiteLink citation={defect.citation} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {result.openArguments.length > 0 && (
          <section className="panel">
            <h3>Worth raising, but not settled law</h3>
            {result.openArguments.map((argument) => (
              <div key={argument.id}>
                <SeverityTag severity={argument.severity} />
                <p>{argument.finding}</p>
                <p className="small muted">{argument.requirement}</p>
                <CiteLink citation={argument.citation} />
              </div>
            ))}
          </section>
        )}

        {result.notAssessed.length > 0 && (
          <section className="panel">
            <h3>Not checked, because you did not say</h3>
            <p className="small muted">
              These are not problems. They are things this check could not look at, listed so you
              know what it did not cover.
            </p>
            <ul className="defects">
              {result.notAssessed.map((item) => (
                <li key={item.id}>
                  <p>
                    <strong>{item.question}</strong>
                  </p>
                  <p className="small muted">{item.whyItMatters}</p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <NextSteps>
        {voiding.length > 0 && (
          <p>
            Serving a notice that does not meet these requirements is a criminal offence under
            section 22(4), not only an ineffective notice. That is a fact about the landlord's
            position, and it is a reason to take advice rather than to threaten anyone with it.
          </p>
        )}
      </NextSteps>

      <a className="crosslink" href="/">
        Check the amount as well
        <span>
          Whether the notice was valid and whether the amount was lawful are two separate questions.
          It is worth having both answers.
        </span>
      </a>
    </>
  );
}

/** R-SAFE-02. When an increase looks disputable, the deadline is the loudest thing here. */
function Deadline({ deadline }: { deadline: DisputeDeadline }) {
  const urgent = deadline.passed || deadline.daysRemaining <= 21;
  return (
    <section className={`deadline ${urgent ? "urgent" : ""}`}>
      <h3>{deadline.passed ? "This deadline has passed" : "Your deadline to dispute"}</h3>
      <span className="date">{longDate(deadline.date)}</span>
      <p>
        {deadline.passed
          ? `That was ${Math.abs(deadline.daysRemaining)} days ago. A dispute referred late may not be accepted, so talk to Threshold before assuming it is too late.`
          : `${deadline.daysRemaining} day${deadline.daysRemaining === 1 ? "" : "s"} from today. A dispute about the rent has to reach the RTB before this date.`}
      </p>
      <p className="small muted">
        {deadline.basis === "effective-date"
          ? "This is the date the new rent takes effect, which is the later of the two dates the Act gives."
          : "This is 28 days after you received the notice, which here is later than the date the rent takes effect."}
      </p>
      <CiteLink citation={deadline.citation} />
    </section>
  );
}

function SeverityTag({ severity }: { severity: Severity }) {
  switch (severity) {
    case "rent-has-no-effect":
      return <span className="sev bad">Increase does not take effect</span>;
    case "review-not-permitted":
      return <span className="sev bad">Review not allowed yet</span>;
    case "breach":
      return <span className="sev warn">Breach</span>;
    case "unclear":
      return <span className="sev info">Arguable</span>;
    default:
      return null;
  }
}
