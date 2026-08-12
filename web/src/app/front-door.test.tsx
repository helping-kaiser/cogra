import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test/providers";
import { FrontDoor } from "./front-door";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const ID = "0198c9a2-1f6b-7c31-9d70-3a4f5b6c7d8e";

describe("FrontDoor", () => {
  beforeEach(() => {
    window.localStorage.clear();
    push.mockClear();
  });

  it("routes a pasted invite to /join", () => {
    renderWithProviders(<FrontDoor />);
    fireEvent.change(screen.getByTestId("invite_input"), {
      target: { value: `https://cogra.example/join/${ID}` },
    });
    fireEvent.click(screen.getByTestId("invite_continue"));
    expect(push).toHaveBeenCalledWith(`/join/${ID}`);
  });

  it("flags input with no invite in it", () => {
    renderWithProviders(<FrontDoor />);
    fireEvent.change(screen.getByTestId("invite_input"), { target: { value: "hello" } });
    fireEvent.click(screen.getByTestId("invite_continue"));
    expect(screen.getByTestId("invite_error")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("disables continue while empty and keeps the sign-in path", () => {
    renderWithProviders(<FrontDoor />);
    expect(screen.getByTestId("invite_continue")).toBeDisabled();
    expect(screen.getByTestId("invite_login")).toHaveAttribute("href", "/login");
  });

  it("offers anonymous browsing before any commitment", () => {
    renderWithProviders(<FrontDoor />);
    expect(screen.getByTestId("front_door_browse")).toHaveAttribute("href", "/feed");
  });
});
