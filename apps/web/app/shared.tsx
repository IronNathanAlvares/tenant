"use client";

import type { AuditStep, Citation, PlainDate } from "@tenant/rules";
import { formatDate } from "@tenant/rules";
import type { ReactNode } from "react";

/**
 * Bits shared by the rent check and the notice check.
 *
 * Everything here is a client component. Nothing in this app renders a determination on
 * the server, because the whole privacy claim is that the rent and the address never leave
 * the browser. R-PRIV-01.
 */

/** "1 September 2026", which is how an Irish reader writes a date. */
export function longDate(date: PlainDate): string {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return `${date.d} ${months[date.m - 1] ?? "?"} ${date.y}`;
}

export function CiteLink({ citation }: { citation: Citation }) {
  return (
    <a className="cite" href={citation.url} target="_blank" rel="noreferrer">
      {citation.act}, {citation.provision}
    </a>
  );
}

export function AuditTrail({ steps }: { steps: readonly AuditStep[] }) {
  return (
    <ol className="audit">
      {steps.map((step) => (
        <li key={`${step.label}-${step.detail.slice(0, 24)}`}>
          {step.value !== undefined && <span className="audit-value">{step.value}</span>}
          <span className="audit-label">{step.label}</span>
          <span className="audit-detail">{step.detail}</span>
          {step.citation !== undefined && <CiteLink citation={step.citation} />}
        </li>
      ))}
    </ol>
  );
}

/**
 * R-SAFE-03. Every result names Threshold and the RTB.
 *
 * Threshold rather than the RTB first, deliberately: the RTB adjudicates, Threshold
 * advises, and someone reading a result page needs advice before they need a tribunal.
 */
export function NextSteps({ children }: { children?: ReactNode }) {
  return (
    <section className="next-steps">
      <h2>Where to get actual advice</h2>
      {children}
      <p>
        <strong>Threshold</strong> is a national housing charity and their advice is free and
        confidential. <a href="tel:1800454454">1800 454 454</a>, or{" "}
        <a href="https://www.threshold.ie/" target="_blank" rel="noreferrer">
          threshold.ie
        </a>
        .
      </p>
      <p>
        The <strong>RTB</strong> runs the dispute process. Mediation is free and adjudication costs
        30 euro.{" "}
        <a href="https://www.rtb.ie/disputes" target="_blank" rel="noreferrer">
          rtb.ie/disputes
        </a>
        , or <a href="mailto:disputes@rtb.ie">disputes@rtb.ie</a>.
      </p>
      <p className="small muted">
        This tool tells you what the rules say. It is not legal advice, and it cannot tell you how a
        dispute would be decided.
      </p>
    </section>
  );
}

export function Provenance({
  rulesVersion,
  cpiLatestMonth,
  cpiSha,
}: {
  rulesVersion: string;
  cpiLatestMonth: string;
  cpiSha: string;
}) {
  return (
    <p className="provenance">
      Calculated in your browser using CPI data published up to {cpiLatestMonth}, rules version{" "}
      {rulesVersion}, data snapshot <code>{cpiSha.slice(0, 12)}</code>. Nothing you typed was sent
      anywhere.
    </p>
  );
}

/**
 * A labelled input that owns its own element, so the hint and error are actually wired to
 * it with `aria-describedby`. A hint nobody's screen reader announces is decoration.
 */
function LabelledInput({
  id,
  label,
  hint,
  error,
  prefix,
  ...input
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  prefix?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "id">) {
  const hintId = hint !== undefined ? `${id}-hint` : undefined;
  const errorId = error !== undefined ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ");

  const control = (
    <input
      id={id}
      aria-describedby={describedBy === "" ? undefined : describedBy}
      aria-invalid={error !== undefined ? "true" : undefined}
      {...input}
    />
  );

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {hint !== undefined && (
        <span className="hint" id={hintId}>
          {hint}
        </span>
      )}
      {prefix !== undefined ? (
        <div className="prefix">
          <span aria-hidden="true">{prefix}</span>
          {control}
        </div>
      ) : (
        control
      )}
      {error !== undefined && (
        <span className="error" id={errorId} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

/** A euro amount. `inputMode="decimal"` gets the right keypad on a phone. */
export function MoneyField(props: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  value: string;
  onValueChange: (value: string) => void;
}) {
  const { value, onValueChange, ...rest } = props;
  return (
    <LabelledInput
      {...rest}
      prefix="€"
      type="text"
      inputMode="decimal"
      autoComplete="off"
      placeholder="1500.00"
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
    />
  );
}

/** A date. Native date inputs give a real picker on mobile, which beats three selects. */
export function DateField(props: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  value: string;
  onValueChange: (value: string) => void;
}) {
  const { value, onValueChange, ...rest } = props;
  return (
    <LabelledInput
      {...rest}
      type="date"
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
    />
  );
}

/** A radio group rendered as tap targets big enough for a thumb. */
export function Choices<T extends string>({
  name,
  legend,
  hint,
  value,
  options,
  onChange,
}: {
  name: string;
  legend: string;
  hint?: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="field">
      <legend>{legend}</legend>
      {hint !== undefined && <span className="hint">{hint}</span>}
      <div className="choices">
        {options.map((option) => (
          <label className="choice" key={option.value}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export { formatDate };
