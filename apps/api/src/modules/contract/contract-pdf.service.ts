import { Injectable } from '@nestjs/common';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { mkdir, writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import * as path from 'path';
import { UPLOAD_ROOT } from '../../common/files/uploads.util';

export interface ContractPdfSection {
  heading: string;
  lines: string[];
}

export interface ContractPdfInput {
  title: string;
  reference: string;
  sections: ContractPdfSection[];
}

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 54;
const BODY_SIZE = 11;
const LINE_HEIGHT = 17;

@Injectable()
export class ContractPdfService {
  async generate(input: ContractPdfInput): Promise<string> {
    const document = await PDFDocument.create();
    const regular = await document.embedFont(StandardFonts.Helvetica);
    const bold = await document.embedFont(StandardFonts.HelveticaBold);
    let page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let cursorY = PAGE_HEIGHT - MARGIN;

    const addPageIfNeeded = (height: number) => {
      if (cursorY - height < MARGIN) {
        page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        cursorY = PAGE_HEIGHT - MARGIN;
      }
    };

    const drawLine = (text: string, options: { bold?: boolean; size?: number } = {}) => {
      const size = options.size ?? BODY_SIZE;
      addPageIfNeeded(LINE_HEIGHT);
      page.drawText(text, {
        x: MARGIN,
        y: cursorY,
        size,
        font: options.bold ? bold : regular,
        color: rgb(0.12, 0.16, 0.18),
        maxWidth: PAGE_WIDTH - MARGIN * 2,
      });
      cursorY -= LINE_HEIGHT;
    };

    page.drawText('TERRASSES DE BAGUIDA', {
      x: MARGIN,
      y: cursorY,
      size: 10,
      font: bold,
      color: rgb(0.45, 0.2, 0.12),
    });
    cursorY -= 32;
    drawLine(input.title, { bold: true, size: 19 });
    drawLine(`Référence : ${input.reference}`, { size: 9 });
    cursorY -= 14;

    for (const section of input.sections) {
      drawLine(section.heading, { bold: true, size: 13 });
      for (const line of section.lines) drawLine(line);
      cursorY -= 8;
    }

    addPageIfNeeded(40);
    cursorY -= 15;
    drawLine('Document généré automatiquement par Résidence Catalog.', { size: 9 });

    const fileName = `${randomUUID()}.pdf`;
    const relativeDirectory = 'contracts';
    const absoluteDirectory = path.join(UPLOAD_ROOT, relativeDirectory);
    await mkdir(absoluteDirectory, { recursive: true });
    await writeFile(path.join(absoluteDirectory, fileName), await document.save());

    return `/uploads/${relativeDirectory}/${fileName}`;
  }
}
