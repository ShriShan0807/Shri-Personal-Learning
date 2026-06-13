import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { qrPng } from "./qr";

export interface LabelInput {
  code: string;
  productName: string;
}

// A4 in points.
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 28;
const COLS = 3;
const ROWS = 7;
const QR_SIZE = 96;

/**
 * Compose a printable PDF of labels arranged in a grid. Each label contains:
 * a QR code, the human-readable code, and the product name.
 */
export async function buildLabelPdf(labels: LabelInput[]): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const usableW = PAGE_W - MARGIN * 2;
  const usableH = PAGE_H - MARGIN * 2;
  const cellW = usableW / COLS;
  const cellH = usableH / ROWS;
  const perPage = COLS * ROWS;

  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    const idxOnPage = i % perPage;
    if (idxOnPage === 0) doc.addPage([PAGE_W, PAGE_H]);
    const page = doc.getPages()[doc.getPageCount() - 1];

    const col = idxOnPage % COLS;
    const row = Math.floor(idxOnPage / COLS);
    const cellX = MARGIN + col * cellW;
    // PDF origin is bottom-left; lay out rows top-to-bottom.
    const cellTop = PAGE_H - MARGIN - row * cellH;

    // Cell border.
    page.drawRectangle({
      x: cellX + 2,
      y: cellTop - cellH + 2,
      width: cellW - 4,
      height: cellH - 4,
      borderColor: rgb(0.85, 0.85, 0.85),
      borderWidth: 0.5,
    });

    // QR image.
    const png = await qrPng(label.code, 240);
    const image = await doc.embedPng(png);
    const qrX = cellX + (cellW - QR_SIZE) / 2;
    const qrY = cellTop - QR_SIZE - 10;
    page.drawImage(image, { x: qrX, y: qrY, width: QR_SIZE, height: QR_SIZE });

    // Product name (bold), truncated to fit.
    const name = truncate(label.productName, 26);
    const nameSize = 8;
    const nameWidth = fontBold.widthOfTextAtSize(name, nameSize);
    page.drawText(name, {
      x: cellX + (cellW - nameWidth) / 2,
      y: qrY - 14,
      size: nameSize,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });

    // Human-readable code.
    const codeSize = 7;
    const codeWidth = font.widthOfTextAtSize(label.code, codeSize);
    page.drawText(label.code, {
      x: cellX + (cellW - codeWidth) / 2,
      y: qrY - 26,
      size: codeSize,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });
  }

  if (labels.length === 0) doc.addPage([PAGE_W, PAGE_H]);

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "\u2026" : s;
}
