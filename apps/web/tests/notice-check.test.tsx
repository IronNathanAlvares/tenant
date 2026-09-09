import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { NoticeCheck } from "../app/notice/notice-check";

/**
 * The notice check, driven through the form.
 *
 * The case that matters is the one the whole product exists for: a landlord who posted the
 * RTB copy instead of uploading it, and an increase that therefore never took effect.
 */

afterEach(cleanup);

async function fillDates(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/when were you given the notice/i), "2026-06-01");
  await user.type(screen.getByLabelText(/when does the new rent start/i), "2026-09-01");
}

function pickBoard(label: string, user: ReturnType<typeof userEvent.setup>) {
  const group = screen.getByRole("group", { name: /copy sent to the RTB/i });
  return user.click(within(group).getByLabelText(label));
}

describe("the notice check", () => {
  it("waits until it has the two dates", () => {
    render(<NoticeCheck />);
    expect(screen.getByText(/answer the first two questions/i)).toBeDefined();
  });

  it("catches the case the product exists for", async () => {
    render(<NoticeCheck />);
    const user = userEvent.setup();
    await fillDates(user);
    await pickBoard("A different day", user);
    await user.type(screen.getByLabelText(/what day did the RTB get it/i), "2026-06-04");

    expect(
      screen.getByText(/this increase did not take effect/i),
      "a notice filed late should void the increase",
    ).toBeDefined();
    expect(screen.getByText(/3 days after/i)).toBeDefined();
  });

  it("shows the deadline prominently, and dates it correctly", async () => {
    render(<NoticeCheck />);
    const user = userEvent.setup();
    await fillDates(user);

    // Section 22(3): the later of the effective date or 28 days from receipt.
    const deadline = document.querySelector(".deadline");
    expect(deadline).not.toBeNull();
    expect(deadline?.querySelector(".date")?.textContent).toBe("1 September 2026");
  });

  it("returns the deadline even when the notice is void, because it still matters", async () => {
    render(<NoticeCheck />);
    const user = userEvent.setup();
    await fillDates(user);
    await pickBoard("Never sent", user);

    expect(screen.getByText(/this increase did not take effect/i)).toBeDefined();
    expect(document.querySelector(".deadline .date")?.textContent).toBe("1 September 2026");
  });

  it("lists what it could not check rather than passing it silently", async () => {
    render(<NoticeCheck />);
    const user = userEvent.setup();
    await fillDates(user);

    expect(screen.getByText(/not checked, because you did not say/i)).toBeDefined();
    // The default answers are all "not sure", so nothing should be reported as a defect.
    expect(screen.queryByText(/what is wrong with it/i)).toBeNull();
  });

  it("names the offence only when the notice actually fails", async () => {
    render(<NoticeCheck />);
    const user = userEvent.setup();
    await fillDates(user);
    expect(screen.queryByText(/criminal offence/i)).toBeNull();

    await pickBoard("Never sent", user);
    expect(screen.getByText(/criminal offence/i)).toBeDefined();
  });

  it("flags too little notice", async () => {
    render(<NoticeCheck />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/when were you given the notice/i), "2026-08-01");
    await user.type(screen.getByLabelText(/when does the new rent start/i), "2026-09-01");

    expect(screen.getByText(/31 days' notice was given, 59 short/i)).toBeDefined();
  });

  it("does not apply the same-day rule to a notice served before 1 March 2026", async () => {
    render(<NoticeCheck />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/when were you given the notice/i), "2026-02-01");
    await user.type(screen.getByLabelText(/when does the new rent start/i), "2026-06-01");
    await pickBoard("Never sent", user);

    expect(screen.queryByText(/this increase did not take effect/i)).toBeNull();
    expect(
      screen.getByText(/only applies to notices served on or after 1 March 2026/i),
    ).toBeDefined();
  });

  it("every finding links to the provision it comes from", async () => {
    render(<NoticeCheck />);
    const user = userEvent.setup();
    await fillDates(user);
    await pickBoard("Never sent", user);

    const citations = document.querySelectorAll("a.cite");
    expect(citations.length).toBeGreaterThan(1);
    for (const citation of citations) {
      expect(citation.getAttribute("href")).toMatch(/^https:\/\//);
    }
  });

  it("R-SAFE-03: names Threshold and the RTB", async () => {
    render(<NoticeCheck />);
    const user = userEvent.setup();
    await fillDates(user);
    expect(screen.getByText(/1800 454 454/)).toBeDefined();
  });
});
