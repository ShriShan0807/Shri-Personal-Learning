import QRCode from "qrcode";

/** Render a QR code for the given payload as a PNG Buffer. */
export async function qrPng(payload: string, size = 256): Promise<Buffer> {
  return QRCode.toBuffer(payload, {
    type: "png",
    width: size,
    margin: 1,
    errorCorrectionLevel: "M",
  });
}

/** Render a QR code as a data URL (for inline <img> in the browser). */
export async function qrDataUrl(payload: string, size = 256): Promise<string> {
  return QRCode.toDataURL(payload, {
    width: size,
    margin: 1,
    errorCorrectionLevel: "M",
  });
}
