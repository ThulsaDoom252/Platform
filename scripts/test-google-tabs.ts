import { googleDocumentId, googleTabsToImportNodes } from "../src/lib/google-docs-tabs";

function assert(ok: unknown, message: string) {
  if (!ok) throw new Error(message);
}

const id = "1AbCdEfGhIjKlMnOpQrStUvWxYz_1234";
assert(
  googleDocumentId(`https://docs.google.com/document/d/${id}/edit?tab=t.0`) === id,
  "document id",
);

const nodes = googleTabsToImportNodes({
  tabs: [
    {
      tabProperties: { title: "Vocabulary", iconEmoji: "📚", index: 1 },
      childTabs: [
        { tabProperties: { title: "Cities and areas", iconEmoji: "🏙️", index: 1 } },
        {
          tabProperties: { title: "Idioms", iconEmoji: "🤪", index: 0 },
          childTabs: [
            { tabProperties: { title: "Work idioms", iconEmoji: "👷‍♂️", index: 0 } },
          ],
        },
      ],
    },
    { tabProperties: { title: "Learned", iconEmoji: "📘", index: 0 } },
  ],
});

assert(nodes[0]?.name === "Learned" && nodes[0]?.kind === "FILE", "root ordering/file");
assert(nodes[1]?.name === "Vocabulary" && nodes[1]?.kind === "FOLDER", "folder");
assert(nodes[1]?.children[0]?.name === "Idioms", "child ordering");
assert(nodes[1]?.children[0]?.children[0]?.icon === "👷‍♂️", "compound emoji");

process.stdout.write("Google tabs parser: OK\n");
