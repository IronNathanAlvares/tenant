import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RentCheck } from "../app/rent-check";

/**
 * The rent check, driven the way a person drives it.
 *
 * Two things are being verified here that unit tests on the engine cannot reach.
 *
 * The **wiring**: that what someone types produces the figure the engine computes, rather
 * than the form and the engine agreeing separately while the page shows something else.
 *
 * The **privacy claim**: R-PRIV-01 says the rent and the dates never leave the browser,
 * and R-PRIV-03 says that has to be asserted by a test rather than promised in a README.
 * Every network primitive is replaced with a spy that fails the test if it is called.
 */

/** Every way a page could talk to a server. Any of them firing fails the test. */
function trapNetwork() {
  const calls: string[] = [];
  const trap = (name: string) =>
    vi.fn((...args: unknown[]) => {
      calls.push(`${name}(${String(args[0]).slice(0, 80)})`);
      throw new Error(`${name} was called during a calculation`);
    });

  vi.stubGlobal("fetch", trap("fetch"));
  vi.stubGlobal(
    "XMLHttpRequest",
    class {
      open(...args: unknown[]) {
        calls.push(`XMLHttpRequest.open(${String(args[1]).slice(0, 80)})`);
        throw new Error("XMLHttpRequest was used during a calculation");
      }
    },
  );
  vi.stubGlobal("WebSocket", trap("WebSocket"));
  vi.stubGlobal("sendBeacon", trap("sendBeacon"));
  if (typeof navigator !== "undefined") {
    Object.defineProperty(navigator, "sendBeacon", {
      configurable: true,
      value: trap("navigator.sendBeacon"),
    });
  }
  return calls;
}

let networkCalls: string[] = [];

beforeEach(() => {
  networkCalls = trapNetwork();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** The worked example from docs/01 and docs/measurements/01. */
async function fillWorkedExample() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/what rent are you paying now/i), "2000");
  await user.type(screen.getByLabelText(/when was that rent last set/i), "2025-06-01");
  await user.type(screen.getByLabelText(/when does the new rent start/i), "2026-09-01");
  return user;
}

/**
 * Open the optional sections directly.
 *
 * jsdom does not reliably toggle a `<details>` when its `<summary>` is clicked, and the
 * disclosure widget is a browser behaviour rather than something this app implements. What
 * matters here is the fields inside it, so open them and test those.
 */
function openOptionalSections() {
  for (const details of document.querySelectorAll("details")) {
    details.open = true;
  }
}

describe("the rent check, end to end through the form", () => {
  it("gives a direct answer by default, not the two-branch one", async () => {
    // Regression. The new-build question used to default to "unknown" and sit behind a
    // disclosure, so the default experience was "it depends" rather than an answer.
    render(<RentCheck />);
    await fillWorkedExample();
    expect(screen.queryByText(/turns on a question only your landlord can answer/i)).toBeNull();
  });

  it("asks the new-build question in the main form, not hidden away", () => {
    render(<RentCheck />);
    const question = screen.getByRole("group", { name: /recently built apartment/i });
    expect(question.closest("details")).toBeNull();
  });

  it("says nothing until it has enough to say something", () => {
    render(<RentCheck />);
    expect(screen.getByText(/fill in those three answers/i)).toBeDefined();
  });

  it("produces 2,050.00 for the worked example", async () => {
    render(<RentCheck />);
    await fillWorkedExample();

    // Assert the verdict, not just that the number appears somewhere on the page. An
    // earlier version of this test passed while the page was showing the two-branch
    // "it depends" answer, because 2,050.00 happens to be one of those branches.
    expect(document.querySelector(".verdict-label")?.textContent).toBe("The limit");
    // The same figure the RTB's own calculator gives, computed in the browser. It appears
    // twice on purpose: once visually with aria-hidden, once visually-hidden inside the
    // heading so a screen reader hears it as part of the sentence.
    expect(document.querySelector(".figure")?.textContent).toBe("€2,050.00");
    expect(screen.getAllByText("€2,050.00")).toHaveLength(2);
    expect(screen.getByText(/increase of €50\.00 a month/i)).toBeDefined();
  });

  it("shows the calculation step by step, with the provision cited", async () => {
    render(<RentCheck />);
    await fillWorkedExample();

    const steps = document.querySelectorAll("ol.audit > li");
    expect(steps.length).toBeGreaterThan(4);
    const labels = [...document.querySelectorAll("ol.audit .audit-label")].map(
      (node) => node.textContent,
    );
    expect(labels).toContain("Which cap binds");
    expect(labels).toContain("Percentage cap");
    expect(labels).toContain("Maximum lawful rent");

    const citations = document.querySelectorAll("a.cite");
    expect(citations.length).toBeGreaterThan(2);
    for (const citation of citations) {
      expect(citation.getAttribute("href")).toMatch(/^https:\/\//);
    }
  });

  it("judges a proposed rent that is over the limit, and says by how much", async () => {
    render(<RentCheck />);
    const user = await fillWorkedExample();

    openOptionalSections();
    await user.type(screen.getByLabelText(/what is the landlord asking for/i), "2200");

    expect(document.querySelector(".verdict-label")?.textContent).toBe("Over the limit");
    expect(screen.getByText(/€150\.00 a month above that limit/i)).toBeDefined();
  });

  it("accepts a proposed rent that is within the limit", async () => {
    render(<RentCheck />);
    const user = await fillWorkedExample();

    openOptionalSections();
    await user.type(screen.getByLabelText(/what is the landlord asking for/i), "2040");

    expect(document.querySelector(".verdict-label")?.textContent).toBe("Within the limit");
  });

  it("R-PRIV-01 and R-PRIV-03: nothing reaches the network", async () => {
    render(<RentCheck />);
    await fillWorkedExample();

    // The whole promise of the page. If this ever fails, the claim on the homepage is a lie.
    expect(networkCalls, `page made network calls: ${networkCalls.join(", ")}`).toEqual([]);
    expect(screen.getByText(/nothing you typed was sent anywhere/i)).toBeDefined();
  });

  it("names the CPI snapshot and rules version it used", async () => {
    render(<RentCheck />);
    await fillWorkedExample();
    expect(screen.getByText(/CPI data published up to 2026-07/i)).toBeDefined();
  });

  it("R-SAFE-03: every result names Threshold and the RTB", async () => {
    render(<RentCheck />);
    await fillWorkedExample();
    // Repeated on purpose: once on screen, once in the pack, which has to stand alone
    // once it is printed.
    expect(screen.getAllByText(/1800 454 454/).length).toBeGreaterThan(0);
    expect(screen.getByText(/disputes@rtb\.ie/)).toBeDefined();
  });

  it("produces a printable pack with a letter that carries the figure", async () => {
    render(<RentCheck />);
    const user = await fillWorkedExample();
    openOptionalSections();
    await user.type(screen.getByLabelText(/what is the landlord asking for/i), "2200");

    const letter = document.querySelector("textarea.letter") as HTMLTextAreaElement | null;
    expect(letter).not.toBeNull();
    expect(letter?.value).toContain("€2,050.00");
    expect(letter?.value).toContain("My working:");
    // R-SAFE-04, again, at the point it actually reaches a landlord.
    expect(letter?.value).not.toMatch(/offence|criminal|you will win/i);
  });

  it("the pack lists the law it rests on", async () => {
    render(<RentCheck />);
    await fillWorkedExample();
    const citations = document.querySelectorAll("ul.citation-list li");
    expect(citations.length).toBeGreaterThan(1);
  });
});

describe("when the answer honestly depends on something the tenant cannot check", () => {
  it("offers both figures rather than guessing", async () => {
    render(<RentCheck />);
    const user = await fillWorkedExample();

    const newBuild = screen.getByRole("group", { name: /recently built apartment/i });
    await user.click(within(newBuild).getByLabelText("I don't know"));

    expect(screen.getByText(/turns on a question only your landlord can answer/i)).toBeDefined();
    // 2,069.84 if the building qualifies, 2,050.00 if it does not.
    const branchFigures = [...document.querySelectorAll(".panel .figure")].map(
      (node) => node.textContent,
    );
    expect(branchFigures).toEqual(["€2,069.84", "€2,050.00"]);
  });
});

describe("regimes outside rent control", () => {
  it("does not invent a cap for a cost rental tenancy", async () => {
    render(<RentCheck />);
    const user = await fillWorkedExample();

    openOptionalSections();
    const kind = screen.getByRole("group", { name: /what kind of tenancy/i });
    await user.click(within(kind).getByLabelText("Cost rental"));

    expect(screen.getByText(/no 2 per cent or CPI cap on this tenancy/i)).toBeDefined();
    expect(screen.queryByText("€2,050.00")).toBeNull();
  });
});

describe("input handling", () => {
  it("complains about a rent it cannot parse, without crashing", async () => {
    render(<RentCheck />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/what rent are you paying now/i), "not a number");
    expect(screen.getByRole("alert").textContent).toMatch(/enter an amount/i);
  });

  it("does not treat a half-typed amount as an error until it is wrong", async () => {
    render(<RentCheck />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/what rent are you paying now/i), "15");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
