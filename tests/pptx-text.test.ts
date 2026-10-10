import assert from "node:assert/strict";
import { test } from "node:test";
import JSZip from "jszip";
import { extractPptxText } from "../src/lib/pptx-text";

const slideXml = (text: string) => `<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:t>${text}</a:t></p:sld>`;

test("extracts PPTX slide text in numeric order and includes related speaker notes", async () => {
  const zip = new JSZip();
  zip.file("ppt/slides/slide10.xml", slideXml("Tenth slide"));
  zip.file("ppt/slides/slide2.xml", slideXml("Second &amp; welcome"));
  zip.file(
    "ppt/slides/_rels/slide2.xml.rels",
    '<Relationships><Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide4.xml"/></Relationships>',
  );
  zip.file("ppt/notesSlides/notesSlide4.xml", slideXml("Remember the demo"));
  const pptx = await zip.generateAsync({ type: "nodebuffer" });

  assert.deepEqual(await extractPptxText(pptx), [
    { slide: 2, text: "Second & welcome", notes: "Remember the demo" },
    { slide: 10, text: "Tenth slide" },
  ]);
});

test("limits extracted output to 60 slides and 20,000 characters", async () => {
  const slideLimitZip = new JSZip();
  for (let slide = 1; slide <= 61; slide += 1) {
    slideLimitZip.file(`ppt/slides/slide${slide}.xml`, slideXml("text"));
  }
  const slideLimited = await extractPptxText(await slideLimitZip.generateAsync({ type: "nodebuffer" }));
  assert.equal(slideLimited.length, 60);

  const characterLimitZip = new JSZip();
  characterLimitZip.file("ppt/slides/slide1.xml", slideXml("x".repeat(20_001)));
  characterLimitZip.file("ppt/slides/slide2.xml", slideXml("more"));
  const characterLimited = await extractPptxText(await characterLimitZip.generateAsync({ type: "nodebuffer" }));
  assert.equal(characterLimited.reduce((total, slide) => total + slide.text.length + (slide.notes?.length ?? 0), 0), 20_000);
});

test("returns an empty result for malformed archives", async () => {
  const originalError = console.error;
  let loggedErrors = 0;
  console.error = () => {
    loggedErrors += 1;
  };
  try {
    assert.deepEqual(await extractPptxText(Buffer.from("not a zip file")), []);
    assert.deepEqual(await extractPptxText(await new JSZip().generateAsync({ type: "nodebuffer" })), []);
    assert.equal(loggedErrors, 2);
  } finally {
    console.error = originalError;
  }
});
