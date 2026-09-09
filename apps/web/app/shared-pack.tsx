"use client";

import type { Citation, DisputePack, PlainSummary } from "@tenant/rules";
import { useState } from "react";
import { CiteLink } from "./shared";

/**
 * The printable pack.
 *
 * There is no PDF library here on purpose. The browser's own print-to-PDF works offline,
 * adds nothing to the bundle, exists on every phone and desktop, and keeps the whole thing
 * on the device. A JavaScript PDF generator would add hundreds of kilobytes to a page whose
 * promise is a fast answer, to produce a worse-looking document. ADR-0008 covers the wider
 * principle: nothing about this leaves the browser.
 */

export function Summary({ summary, title }: { summary: PlainSummary; title: string }) {
  return (
    <section className="pack-section">
      <h2>{title}</h2>
      <p>
        <strong>{summary.headline}</strong>
      </p>
      {summary.points.length > 0 && (
        <ul>
          {summary.points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      )}
      {summary.nextSteps.length > 0 && (
        <>
          <h3>What you can do</h3>
          <ul>
            {summary.nextSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export function Citations({ citations }: { citations: readonly Citation[] }) {
  if (citations.length === 0) return null;
  return (
    <section className="pack-section">
      <h2>The law this rests on</h2>
      <p className="small muted">
        Every point above comes from one of these. They are linked so anyone reading this, including
        your landlord, can check it.
      </p>
      <ul className="citation-list">
        {citations.map((citation) => (
          <li key={`${citation.act}-${citation.provision}`}>
            <strong>
              {citation.act}, {citation.provision}
            </strong>
            <br />
            <span className="small muted">{citation.effect}</span>
            <br />
            <CiteLink citation={citation} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The letter, editable before it is printed.
 *
 * Editable rather than fixed because the generated text cannot know the circumstances. A
 * letter someone cannot change is a letter they will not send.
 */
export function Letter({ initial }: { initial: string }) {
  const [text, setText] = useState(initial);
  const [copied, setCopied] = useState(false);

  return (
    <section className="pack-section">
      <h2>A letter you could send</h2>
      <p className="small muted">
        A starting point, not a template to send unchanged. Read it, change anything that is not
        true of your situation, and take out anything you are not sure about. It is deliberately
        calm: this is someone you still have to live under.
      </p>
      <label className="visually-hidden" htmlFor="letter">
        Draft letter to your landlord
      </label>
      <textarea
        id="letter"
        className="letter"
        value={text}
        onChange={(event) => setText(event.target.value)}
        spellCheck
      />
      <div className="pack-actions no-print">
        <button
          type="button"
          className="action secondary"
          onClick={() => {
            // Clipboard only. Nothing is uploaded.
            void navigator.clipboard?.writeText(text).then(
              () => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2500);
              },
              () => setCopied(false),
            );
          }}
        >
          {copied ? "Copied" : "Copy the letter"}
        </button>
      </div>
    </section>
  );
}

export function PackActions() {
  return (
    <div className="pack-actions no-print">
      <button type="button" className="action" onClick={() => window.print()}>
        Print, or save as PDF
      </button>
    </div>
  );
}

export function PackProvenance({ pack }: { pack: DisputePack }) {
  return (
    <footer>
      <p className="provenance">{pack.provenance}</p>
      <p className="small muted">
        This sets out what the rules say. It is not legal advice, and it does not predict what the
        RTB would decide. Threshold give free advice on 1800 454 454.
      </p>
    </footer>
  );
}

/**
 * The whole pack, rendered inline under whichever result produced it.
 *
 * Inline rather than on a separate `/pack` page, because moving it would mean carrying the
 * determination across a navigation. The two ways to do that are a URL, which would put
 * someone's rent in their browser history and in any link they paste, and session storage,
 * which is more machinery for no gain. Keeping it on the page it belongs to means the data
 * never has to travel at all.
 */
export function DisputePackSection({
  pack,
  rentTitle,
  noticeTitle,
}: {
  pack: DisputePack;
  rentTitle: string;
  noticeTitle: string;
}) {
  const [details, setDetails] = useState({ tenantName: "", landlordName: "", propertyAddress: "" });

  // Substituted here rather than regenerating the letter, so typing a name cannot change
  // any figure in it.
  const letter = pack.letter
    .replace("[your name]", details.tenantName.trim() || "[your name]")
    .replace(
      "Dear landlord,",
      details.landlordName.trim() ? `Dear ${details.landlordName.trim()},` : "Dear landlord,",
    )
    .replace(
      "for my home",
      details.propertyAddress.trim() ? `for ${details.propertyAddress.trim()}` : "for my home",
    );

  return (
    <>
      <h2 id="pack">Something you can print and bring with you</h2>
      <p className="muted">
        Everything below is generated on this page and stays on it. Print it, or use your browser's
        print dialogue to save it as a PDF.
      </p>

      <PackActions />

      <details className="more no-print">
        <summary>Add your name and address to the letter (optional)</summary>
        <p className="small muted">
          These only fill in the blanks in the letter below. Like everything else here, they are
          never sent anywhere.
        </p>
        <div className="field">
          <label htmlFor="tenant-name">Your name</label>
          <input
            id="tenant-name"
            type="text"
            autoComplete="off"
            value={details.tenantName}
            onChange={(event) => setDetails({ ...details, tenantName: event.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="landlord-name">Your landlord's name</label>
          <input
            id="landlord-name"
            type="text"
            autoComplete="off"
            value={details.landlordName}
            onChange={(event) => setDetails({ ...details, landlordName: event.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="property-address">The address</label>
          <input
            id="property-address"
            type="text"
            autoComplete="off"
            value={details.propertyAddress}
            onChange={(event) => setDetails({ ...details, propertyAddress: event.target.value })}
          />
        </div>
      </details>

      {pack.rent !== null && <Summary summary={pack.rent} title={rentTitle} />}
      {pack.notice !== null && <Summary summary={pack.notice} title={noticeTitle} />}
      {letter !== "" && <Letter key={letter} initial={letter} />}
      <Citations citations={pack.citations} />
      <PackProvenance pack={pack} />
    </>
  );
}
