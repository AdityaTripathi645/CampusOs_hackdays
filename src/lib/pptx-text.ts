import "server-only";
import JSZip from "jszip";

export type PptxSlideText = { slide: number; text: string; notes?: string };

const MAX_CHARACTERS = 20_000;
const MAX_SLIDES = 60;

export function isPptxFile(fileName: string, mimeType: string) {
  return fileName.toLowerCase().endsWith(".pptx") || mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation";
}

export function isLegacyPptFile(fileName: string, mimeType: string) {
  return fileName.toLowerCase().endsWith(".ppt") || mimeType === "application/vnd.ms-powerpoint";
}

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function textRuns(xml: string) {
  return [...xml.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)]
    .map((match) => decodeXml(match[1]).trim())
    .filter(Boolean)
    .join(" ");
}

function notesPathForSlide(zip: JSZip, slideNumber: number) {
  const relationship = zip.file(`ppt/slides/_rels/slide${slideNumber}.xml.rels`);
  return relationship?.async("string").then((xml) => {
    const match = xml.match(/<Relationship\b(?=[^>]*\bType="[^"]*\/notesSlide")(?=[^>]*\bTarget="([^"]+)")[^>]*\/?>/);
    if (!match) return undefined;
    const normalized = new URL(match[1], "https://pptx.invalid/ppt/slides/").pathname.slice(1);
    return normalized.startsWith("ppt/notesSlides/") && normalized.endsWith(".xml") ? normalized : undefined;
  });
}

export async function extractPptxText(data: Buffer): Promise<PptxSlideText[]> {
  try {
    const zip = await JSZip.loadAsync(data);
    const slideFiles = Object.keys(zip.files)
      .map((name) => {
        const match = name.match(/^ppt\/slides\/slide(\d+)\.xml$/);
        return match ? { name, number: Number(match[1]) } : null;
      })
      .filter((slide): slide is { name: string; number: number } => slide !== null)
      .sort((left, right) => left.number - right.number)
      .slice(0, MAX_SLIDES);
    if (slideFiles.length === 0) throw new Error("PPTX archive does not contain any slides.");
    const result: PptxSlideText[] = [];
    let remaining = MAX_CHARACTERS;

    for (const slide of slideFiles) {
      if (remaining <= 0) break;
      const slideXml = await zip.file(slide.name)!.async("string");
      if (!/<(?:\w+:)?sld\b/.test(slideXml) || !/<\/(?:\w+:)?sld\s*>/.test(slideXml)) {
        throw new Error(`PPTX slide ${slide.number} contains malformed XML.`);
      }
      const text = textRuns(slideXml).slice(0, remaining);
      remaining -= text.length;
      const slideText: PptxSlideText = { slide: slide.number, text };

      const notesPath = await notesPathForSlide(zip, slide.number);
      if (notesPath && remaining > 0) {
        const notesFile = zip.file(notesPath);
        if (notesFile) {
          const notes = textRuns(await notesFile.async("string")).slice(0, remaining);
          if (notes) {
            slideText.notes = notes;
            remaining -= notes.length;
          }
        }
      }
      result.push(slideText);
    }

    return result;
  } catch (error) {
    console.error("[CampusOS] Could not extract text from PPTX", error);
    return [];
  }
}
