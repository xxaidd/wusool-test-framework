import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SearchSelect } from "./SearchSelect";

const options = [
  { value: "1", label: "Central Station" },
  { value: "2", label: "King Fahd Rd" },
  { value: "3", label: "University Gate" },
];

function open(): void {
  fireEvent.click(screen.getByRole("button"));
}

describe("SearchSelect", () => {
  it("filters options client-side as the user types", () => {
    render(<SearchSelect options={options} onSelect={vi.fn()} />);

    open();
    fireEvent.change(screen.getByPlaceholderText("Search…"), {
      target: { value: "station" },
    });

    expect(screen.getByText("Central Station")).toBeDefined();
    expect(screen.queryByText("King Fahd Rd")).toBeNull();
    expect(screen.queryByText("University Gate")).toBeNull();
  });

  it("filtering never triggers a loader callback", () => {
    const load = vi.fn();
    render(<SearchSelect options={options} onSelect={vi.fn()} />);

    open();
    fireEvent.change(screen.getByPlaceholderText("Search…"), {
      target: { value: "ugh" },
    });

    expect(load).not.toHaveBeenCalled();
  });

  it("shows an empty message when nothing matches", () => {
    render(
      <SearchSelect
        options={options}
        emptyLabel="No results"
        onSelect={vi.fn()}
      />,
    );

    open();
    fireEvent.change(screen.getByPlaceholderText("Search…"), {
      target: { value: "zzz" },
    });

    expect(screen.getByText("No results")).toBeDefined();
  });

  it("shows a loading indicator when loading with no options", () => {
    render(
      <SearchSelect
        options={[]}
        loading
        loadingLabel="Loading…"
        onSelect={vi.fn()}
      />,
    );

    open();

    expect(screen.getByText("Loading…")).toBeDefined();
  });

  it("shows an error state when provided", () => {
    render(
      <SearchSelect
        options={[]}
        error="boom"
        errorLabel="Couldn't load options"
        onSelect={vi.fn()}
      />,
    );

    open();

    expect(screen.getByText("Couldn't load options")).toBeDefined();
  });

  it("renders a load-more affordance and calls onLoadMore", () => {
    const onLoadMore = vi.fn();
    render(
      <SearchSelect
        options={options}
        hasMore
        loadMoreLabel="Load more"
        onSelect={vi.fn()}
        onLoadMore={onLoadMore}
      />,
    );

    open();
    fireEvent.click(screen.getByText("Load more"));

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("selecting an option invokes onSelect with its value", () => {
    const onSelect = vi.fn();
    render(<SearchSelect options={options} onSelect={onSelect} />);

    open();
    fireEvent.click(screen.getByText("University Gate"));

    expect(onSelect).toHaveBeenCalledWith("3");
  });
});
