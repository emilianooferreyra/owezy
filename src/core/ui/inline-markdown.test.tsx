// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { InlineMarkdown } from "./inline-markdown";

afterEach(cleanup);

const html = (text: string) => render(<p><InlineMarkdown text={text} /></p>).container.innerHTML;

describe("InlineMarkdown", () => {
  it("shows the model's **bold** as bold, without the asterisks", () => {
    const { container } = render(
      <p>
        <InlineMarkdown text="Listo, el cobro **C-0001** para **Kevin Ferreira** por **$25.000**." />
      </p>,
    );

    expect(container.textContent).toBe("Listo, el cobro C-0001 para Kevin Ferreira por $25.000.");
    expect([...container.querySelectorAll("strong")].map((node) => node.textContent)).toEqual([
      "C-0001",
      "Kevin Ferreira",
      "$25.000",
    ]);
  });

  it("leaves plain text and unpaired asterisks as they are", () => {
    expect(html("Sin formato")).toBe("<p>Sin formato</p>");
    expect(html("Un ** suelto y otro **")).toBe("<p>Un ** suelto y otro **</p>");
    expect(html("2 * 3 = 6")).toBe("<p>2 * 3 = 6</p>");
  });

  it("never turns the text into HTML, so a message cannot inject markup", () => {
    const { container } = render(<p><InlineMarkdown text={'**<img src=x onerror="alert(1)">**'} /></p>);

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("strong")?.textContent).toBe('<img src=x onerror="alert(1)">');
  });
});
