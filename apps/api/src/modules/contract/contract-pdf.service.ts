import { Injectable } from '@nestjs/common';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { randomUUID } from 'crypto';
import { StorageService } from '../../common/storage/storage.service';

export interface ContractPdfSection {
  heading: string;
  lines: string[];
}

export interface ContractPdfInput {
  title: string;
  reference: string;
  sections: ContractPdfSection[];
}

export interface ContractPdfSignature {
  label: string;
  imageUrl: string;
}

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 54;
const BODY_SIZE = 11;
const LINE_HEIGHT = 17;

@Injectable()
export class ContractPdfService {
  constructor(private readonly storage: StorageService) {}

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

    return this.persist(document);
  }

  /**
   * Contresigne un PDF existant : charge l'original depuis B2 (clé interne),
   * incorpore les images de signature (PNG, aussi chargées depuis B2) sur la
   * dernière page et dépose une version signée à part. L'original reste
   * intact — seul `signedFileUrl` référence la copie signée.
   */
  async sign(fileUrl: string, signatures: ContractPdfSignature[]): Promise<string> {
    const original = await this.storage.getObject(fileUrl);
    const document = await PDFDocument.load(original.body);
    const regular = await document.embedFont(StandardFonts.Helvetica);
    const bold = await document.embedFont(StandardFonts.HelveticaBold);
    const page = document.getPage(document.getPageCount() - 1);
    const { width: pageWidth } = page.getSize();

    const signatureBoxHeight = 70;
    const gap = 40;
    const available = pageWidth - MARGIN * 2 - gap * (signatures.length - 1);
    const boxWidth = available / signatures.length;

    let cursorY = MARGIN;
    page.drawText('SIGNATURES', { x: MARGIN, y: cursorY, size: 13, font: bold });
    cursorY -= 32;

    let x = MARGIN;
    for (const signature of signatures) {
      const { body: imageBody } = await this.storage.getObject(signature.imageUrl);
      const image = await document.embedPng(imageBody);
      const scale = Math.min(boxWidth / image.width, signatureBoxHeight / image.height);
      const drawWidth = image.width * scale;
      const drawHeight = image.height * scale;
      page.drawImage(image, { x, y: cursorY - drawHeight, width: drawWidth, height: drawHeight });
      page.drawText(signature.label, { x, y: cursorY - drawHeight - 14, size: 9, font: regular });
      x += boxWidth + gap;
    }

    page.drawText(`Document signé le ${new Date().toISOString()}`, {
      x: MARGIN,
      y: MARGIN - 18,
      size: 9,
      font: regular,
      color: rgb(0.45, 0.45, 0.45),
    });

    return this.persist(document);
  }

  /** Dépose le PDF sur B2 et renvoie sa clé interne. */
  private async persist(document: PDFDocument): Promise<string> {
    const key = `contracts/${randomUUID()}.pdf`;
    await this.storage.putObject(key, Buffer.from(await document.save()), 'application/pdf');
    return key;
  }
}
