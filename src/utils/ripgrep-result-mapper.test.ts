import assert from "node:assert/strict";
import { test } from "node:test";
import type { SearchResult } from "../types/search.ts";
import { decodeRipgrepText, RipgrepResultMapper } from "./ripgrep-result-mapper.ts";

test("decodes ripgrep byte values", () => {
  assert.equal(decodeRipgrepText({ bytes: Buffer.from("Türkçe yol").toString("base64") }), "Türkçe yol");
});

test("keeps multiple same-line submatches distinct and attaches context", () => {
  const emitted: SearchResult[] = [];
  const mapper = new RipgrepResultMapper("/tmp/Arama Klasörü", 1, 1, (batch) => emitted.push(...batch));

  mapper.consume({ type: "begin", data: {} });
  mapper.consume({ type: "context", data: { lines: { text: "önce\n" } } });
  mapper.consume({
    type: "match",
    data: {
      path: { bytes: Buffer.from("/tmp/Arama Klasörü/ölçüm.txt").toString("base64") },
      lines: { text: "ara ara\n" },
      line_number: 2,
      submatches: [
        { start: 0, end: 3, match: { text: "ara" } },
        { start: 4, end: 7, match: { text: "ara" } },
      ],
    },
  });
  mapper.consume({ type: "context", data: { lines: { text: "sonra\n" } } });
  mapper.consume({ type: "end", data: {} });

  assert.equal(emitted.length, 2);
  assert.deepEqual(
    emitted.map((result) => result.column),
    [1, 5],
  );
  assert.equal(emitted[0]?.relativePath, "ölçüm.txt");
  assert.deepEqual(emitted[0]?.contextBefore, ["önce"]);
  assert.deepEqual(emitted[0]?.contextAfter, ["sonra"]);
});
