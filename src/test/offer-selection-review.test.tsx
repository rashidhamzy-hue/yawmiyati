// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { OfferSelectionDemo } from "../components/store/OfferSelectionDemo";

afterEach(cleanup);

it("shows a local editorial brief only after the owner selects a recommended demo offer", () => {
  render(<OfferSelectionDemo market="iq" />);
  fireEvent.click(screen.getByRole("button", { name: "Open product selection demo" }));
  expect(screen.getByText(/5 of 5 offers read/)).toBeTruthy();
  expect(screen.getByText(/missing returnCost/)).toBeTruthy();
  expect(screen.queryByText(/Editorial brief/)).toBeNull();
  const approvals = screen.getAllByRole("button", { name: "Approve for content brief" });
  expect(approvals).toHaveLength(2);
  fireEvent.click(approvals[0]);
  expect(screen.getByText(/Editorial brief · ar-IQ/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Undo demo approval" }));
  expect(screen.queryByText(/Editorial brief/)).toBeNull();
});
