import assert from "node:assert/strict";
import test from "node:test";
import {
  googleStructuralElementsToText,
  googleTabsToImportNodes,
} from "../src/lib/google-docs-tabs";

test("extracts paragraphs, bullets and tables from a Google tab", () => {
  const text = googleStructuralElementsToText([
    {
      paragraph: {
        elements: [{ textRun: { content: "word /wɜːd/ — слово\n" } }],
      },
    },
    {
      paragraph: {
        bullet: {},
        elements: [{ textRun: { content: "An example. — Приклад.\n" } }],
      },
    },
    {
      table: {
        tableRows: [
          {
            tableCells: [
              { content: [{ paragraph: { elements: [{ textRun: { content: "EN\n" } }] } }] },
              { content: [{ paragraph: { elements: [{ textRun: { content: "UA\n" } }] } }] },
            ],
          },
        ],
      },
    },
  ]);

  assert.equal(text, "word /wɜːd/ — слово\n• An example. — Приклад.\nEN\tUA");
});

test("attaches each tab body to its preview node", () => {
  const { nodes } = googleTabsToImportNodes({
    tabs: [
      {
        tabProperties: { title: "Food", index: 0 },
        documentTab: {
          body: {
            content: [
              {
                paragraph: {
                  elements: [{ textRun: { content: "apple — яблуко\n" } }],
                },
              },
            ],
          },
        },
      },
    ],
  });

  assert.equal(nodes[0]?.content, "apple — яблуко");
});
