import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, describe, expect, it } from "vitest";
import { NoticeCheck } from "../app/notice/notice-check";
import { RentCheck } from "../app/rent-check";

/**
 * Accessibility, as a build gate rather than an afternoon with a browser extension.
 *
 * Task 4.7 was ticked as "partly" in Sprint 4 because labels had been checked by hand and
 * nothing else had been measured. Running axe once and writing "passes" in a document is
 * the same problem one step further on: it is true on the day and unenforced afterwards.
 * These run on every push.
 *
 * jsdom computes no layout, so the checks that need geometry (target size, reflow) cannot
 * run here. Colour contrast is measured separately in `contrast.test.ts`, from the design
 * tokens, which is more reliable than asking jsdom to resolve a CSS variable.
 */

afterEach(cleanup);

/** Rules jsdom genuinely cannot evaluate, disabled with the reason rather than silently. */
const CANNOT_RUN_IN_JSDOM = [
  // Needs layout and a real stylesheet. Covered by contrast.test.ts instead.
  "color-contrast",
  // Needs a full document; these tests render fragments.
  "page-has-heading-one",
  "region",
  "landmark-one-main",
  "html-has-lang",
  "document-title",
  "bypass",
];

async function violations(container: HTMLElement) {
  const results = await axe.run(container, {
    rules: Object.fromEntries(CANNOT_RUN_IN_JSDOM.map((id) => [id, { enabled: false }])),
    resultTypes: ["violations"],
  });
  return results.violations;
}

function describeViolations(found: axe.Result[]): string {
  return found
    .map(
      (violation) =>
        `${violation.id} (${violation.impact}): ${violation.help}\n` +
        violation.nodes.map((node) => `    ${node.html.slice(0, 120)}`).join("\n"),
    )
    .join("\n");
}

describe("the rent check", () => {
  it("has no axe violations before anything is entered", async () => {
    const { container } = render(<RentCheck />);
    const found = await violations(container);
    expect(found.length, describeViolations(found)).toBe(0);
  });

  it("has no axe violations once a result is showing", async () => {
    const { container } = render(<RentCheck />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/what rent are you paying now/i), "2000");
    await user.type(screen.getByLabelText(/when was that rent last set/i), "2025-06-01");
    await user.type(screen.getByLabelText(/when does the new rent start/i), "2026-09-01");

    const found = await violations(container);
    expect(found.length, describeViolations(found)).toBe(0);
  });
});

describe("the notice check", () => {
  it("has no axe violations before anything is entered", async () => {
    const { container } = render(<NoticeCheck />);
    const found = await violations(container);
    expect(found.length, describeViolations(found)).toBe(0);
  });

  it("has no axe violations once a result is showing", async () => {
    const { container } = render(<NoticeCheck />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/when were you given the notice/i), "2026-06-01");
    await user.type(screen.getByLabelText(/when does the new rent start/i), "2026-09-01");

    const found = await violations(container);
    expect(found.length, describeViolations(found)).toBe(0);
  });
});

describe("the keyboard path", () => {
  it("reaches every control on the rent check without a mouse", async () => {
    render(<RentCheck />);
    const user = userEvent.setup();

    // Everything a person has to operate to get an answer.
    const wanted = [
      screen.getByLabelText(/what rent are you paying now/i),
      screen.getByLabelText(/when was that rent last set/i),
      screen.getByLabelText(/when does the new rent start/i),
    ];

    const reached = new Set<Element>();
    for (let i = 0; i < 40; i += 1) {
      await user.tab();
      if (document.activeElement !== null) reached.add(document.activeElement);
    }

    for (const element of wanted) {
      expect(reached.has(element), `could not tab to ${element.id}`).toBe(true);
    }
  });

  it("puts nothing in a positive tabindex, which would scramble the order", () => {
    render(<RentCheck />);
    const positive = [...document.querySelectorAll("[tabindex]")].filter(
      (node) => Number(node.getAttribute("tabindex")) > 0,
    );
    expect(positive).toEqual([]);
  });

  it("announces results to a screen reader without moving focus", async () => {
    // The result appears as you type. Moving focus would interrupt someone mid-entry, so
    // the region is polite and focus stays put.
    render(<RentCheck />);
    const live = document.querySelector("[aria-live]");
    expect(live?.getAttribute("aria-live")).toBe("polite");
  });
});

describe("form semantics", () => {
  it("groups every set of choices in a fieldset with a legend", () => {
    render(<RentCheck />);
    for (const group of document.querySelectorAll("fieldset")) {
      expect(group.querySelector("legend")?.textContent?.length ?? 0).toBeGreaterThan(5);
    }
  });

  it("wires every hint to its input, so it is announced rather than decorative", () => {
    render(<RentCheck />);
    for (const hint of document.querySelectorAll(".hint[id]")) {
      const described = document.querySelector(`[aria-describedby~="${hint.id}"]`);
      expect(described, `hint ${hint.id} is not referenced by any input`).not.toBeNull();
    }
  });

  it("gives every input an accessible name from a real label", () => {
    render(<RentCheck />);
    for (const input of document.querySelectorAll("input:not([type=radio])")) {
      const label = document.querySelector(`label[for="${input.id}"]`);
      expect(label?.textContent?.length ?? 0, `input #${input.id} has no label`).toBeGreaterThan(3);
    }
  });
});
