import { toPng } from "html-to-image";
import jsPDF from "jspdf";

export async function exportElementToPdf(element: HTMLElement, fileName: string): Promise<void> {
  const imageData = await toPng(element, {
    pixelRatio: 2,
    backgroundColor: "#f3f5f8",
  });

  const image = new Image();
  image.src = imageData;

  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
  });

  const pageOrientation = image.width >= image.height ? "landscape" : "portrait";
  const pdf = new jsPDF({
    orientation: pageOrientation,
    unit: "pt",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const scale = Math.min(pageWidth / image.width, pageHeight / image.height);
  const renderWidth = image.width * scale;
  const renderHeight = image.height * scale;
  const x = (pageWidth - renderWidth) / 2;
  const y = (pageHeight - renderHeight) / 2;

  pdf.addImage(imageData, "PNG", x, y, renderWidth, renderHeight);
  pdf.save(fileName);
}
