import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface ChartImageResult {
  dataUrl: string;
  width: number;
  height: number;
}

const chartCanvasToImageData = async (element: HTMLElement): Promise<ChartImageResult> => {
  const chartCanvas = element.querySelector('canvas') as HTMLCanvasElement | null;

  if (chartCanvas && chartCanvas.width > 0 && chartCanvas.height > 0) {
    return {
      dataUrl: chartCanvas.toDataURL('image/png'),
      width: chartCanvas.width,
      height: chartCanvas.height
    };
  }

  const canvas = await html2canvas(element, {
    backgroundColor: '#ffffff',
    scale: 3,
    logging: false,
    useCORS: true,
    allowTaint: true,
    foreignObjectRendering: true,
    imageTimeout: 0,
    width: element.scrollWidth,
    height: element.scrollHeight,
    scrollX: -window.scrollX,
    scrollY: -window.scrollY
  });

  return {
    dataUrl: canvas.toDataURL('image/png'),
    width: canvas.width,
    height: canvas.height
  };
};

const getTitleFromElement = (element: HTMLElement): string | null => {
  const titleEl = element.querySelector('h3');
  return titleEl ? titleEl.textContent : null;
};

const addImageToPdf = (pdf: jsPDF, image: ChartImageResult, title: string | null) => {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const maxImgWidth = pageWidth - margin * 2;

  let imgWidth = maxImgWidth;
  let imgHeight = (image.height * imgWidth) / image.width;

  let y = margin;

  if (title) {
    pdf.setFontSize(14);
    pdf.text(title, margin, y + 7);
    y += 12;
  }

  if (imgHeight > pageHeight - y - margin) {
    imgHeight = pageHeight - y - margin;
    imgWidth = (imgHeight * image.width) / image.height;
  }

  pdf.addImage(image.dataUrl, 'PNG', margin, y, imgWidth, imgHeight);
};

/**
 * Exporta un elemento HTML a PDF
 * @param elementId - ID del elemento a exportar
 * @param fileName - Nombre del archivo PDF (sin extensión)
 */
export async function exportToPDF(elementId: string, fileName: string = 'documento'): Promise<void> {
  try {
    const element = document.getElementById(elementId);

    if (!element) {
      console.error(`Elemento con ID "${elementId}" no encontrado`);
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 1000));

    const image = await chartCanvasToImageData(element);
    const title = getTitleFromElement(element);

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    addImageToPdf(pdf, image, title);
    pdf.save(`${fileName}.pdf`);
  } catch (error) {
    console.error('Error al exportar PDF:', error);
    alert('Error al exportar el gráfico a PDF. Intenta de nuevo.');
  }
}

/**
 * Exporta múltiples elementos a un solo PDF
 * @param elementIds - IDs de los elementos a exportar
 * @param fileName - Nombre del archivo PDF
 */
export async function exportMultipleToPDF(elementIds: string[], fileName: string = 'reporte'): Promise<void> {
  try {
    const pdf = new jsPDF('portrait', 'mm', 'a4');
    let isFirstPage = true;

    for (const elementId of elementIds) {
      const element = document.getElementById(elementId);
      if (!element) {
        console.warn(`Elemento con ID "${elementId}" no encontrado, saltando...`);
        continue;
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
      const image = await chartCanvasToImageData(element);
      const title = getTitleFromElement(element);

      if (!isFirstPage) {
        pdf.addPage();
      }

      addImageToPdf(pdf, image, title);
      isFirstPage = false;
    }

    pdf.save(`${fileName}.pdf`);
  } catch (error) {
    console.error('Error al exportar múltiples gráficos a PDF:', error);
    alert('Error al exportar los gráficos. Intenta de nuevo.');
  }
}
