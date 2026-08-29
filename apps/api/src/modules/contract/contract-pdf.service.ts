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
  /** Date exacte de SA signature (signedAt en base), jamais une date générique. */
  signedAt: string;
}

/**
 * Formate une date en lecture humaine pour un contrat : jour/mois/année et
 * heure locale (jamais le format ISO brut illisible — défaut historique des
 * mentions de signature).
 */
export function formatSignatureDate(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} à ${pad(
    date.getHours(),
  )}h${pad(date.getMinutes())}`;
}

/**
 * Mention affichée sous chaque signature : rôle + la date DE CETTE signature
 * précise. Deux signataires n'affichent jamais la même date/générique.
 */
export function buildSignatureCaption(label: string, signedAt: string): string {
  return `${label} — signé le ${formatSignatureDate(signedAt)}`;
}

/** Position/dimension d'une boîte de signature dans la bande dédiée. */
export interface SignaturePlacement {
  /** Abscisse gauche de la boîte (≥ MARGIN). */
  x: number;
  /** Ordonnée du bas de la boîte (% bas, coin bas-gauche en pdf-lib), ≥ 0. */
  y: number;
  /** Largeur max de la boîte. */
  width: number;
  /** Hauteur max de l'image de signature (bornée). */
  height: number;
}

export interface SignatureBandLayout {
  /** Ordonnée du titre « SIGNATURES ». */
  headingY: number;
  /** Ordonnée de l'étiquette rôle/date sous chaque boîte. */
  labelBaselineY: number;
  /** Ordonnée de la mention « Document contresigné le … ». */
  dateBaselineY: number;
  placements: SignaturePlacement[];
}

/**
 * Calcule la bande de signatures pour une page donnée : boîtes réparties sur
 * la largeur utile (marges respectées), une boîte par signataire, toutes les
 * coordonnées garanties dans les limites de la page (y ≥ 0, x + width ≤ page
 * width) et sans chevauchement horizontal (x avance de width + gap).
 * Invariant couvert par les tests R6 : aucune coordonnée négative ni hors
 * zone, quel que soit le nombre de signatures.
 */
export function signatureBandLayout(
  pageWidth: number,
  pageHeight: number,
  count: number,
): SignatureBandLayout {
  if (count <= 0) {
    throw new Error('signatureBandLayout : au moins un signataire requis.');
  }

  const available = pageWidth - MARGIN * 2 - SIGNATURE_GAP * (count - 1);
  const boxWidth = available / count;
  const baseY = MARGIN;

  const placements: SignaturePlacement[] = Array.from({ length: count }, (_, i) => ({
    x: MARGIN + i * (boxWidth + SIGNATURE_GAP),
    y: baseY,
    width: boxWidth,
    height: SIGNATURE_BOX_HEIGHT,
  }));

  const headingY = baseY + SIGNATURE_BOX_HEIGHT + 16;
  const labelBaselineY = baseY - 14;
  const dateBaselineY = baseY - 28;

  // Garde définitive : la bande doit tenir entièrement dans la page (coin
  // haut du titre pas au-delà du haut) et rien ne descend sous le bas.
  if (headingY > pageHeight || labelBaselineY < 0 || dateBaselineY < 0) {
    throw new Error(
      `Bande de signatures incompatible avec la page (${pageWidth}x${pageHeight}).`,
    );
  }

  return { headingY, labelBaselineY, dateBaselineY, placements };
}

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
export const MARGIN = 54;
const SIGNATURE_BOX_HEIGHT = 70;
const SIGNATURE_GAP = 40;
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
   * appose les images de signature (PNG, aussi chargées depuis B2) sur une
   * page finale dédiée et dépose une version signée à part. L'original reste
   * intact — seul `signedFileUrl` référence la copie signée.
   *
   * La page de signature est dédiée (et non la dernière page du contrat) :
   * elle peut être saturée de texte, et un bloc ancré à son bas risquerait
   * de se retrouver hors limites (troncature) ou de chevaucher le corps.
   * Une page vide garantit une zone bornée et déterministe.
   */
  async sign(fileUrl: string, signatures: ContractPdfSignature[]): Promise<string> {
    const original = await this.storage.getObject(fileUrl);
    const document = await PDFDocument.load(original.body);
    const regular = await document.embedFont(StandardFonts.Helvetica);
    const bold = await document.embedFont(StandardFonts.HelveticaBold);

    const page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const { width: pageWidth, height: pageHeight } = page.getSize();
    const layout = signatureBandLayout(pageWidth, pageHeight, signatures.length);

    page.drawText('SIGNATURES', { x: MARGIN, y: layout.headingY, size: 13, font: bold });

    for (let i = 0; i < signatures.length; i += 1) {
      const signature = signatures[i];
      const placement = layout.placements[i];
      const { body: imageBody } = await this.storage.getObject(signature.imageUrl);
      const image = await document.embedPng(imageBody);
      const scale = Math.min(placement.width / image.width, placement.height / image.height);
      const drawWidth = image.width * scale;
      const drawHeight = image.height * scale;
      // En pdf-lib, x/y est le coin bas-gauche : on ancre le BAS de l'image en
      // placement.y (≥ 0) ; l'image s'étend vers le haut sur au plus
      // placement.height. Plus jamais de coordonnée négative (bug historique
      // de troncature des signatures).
      page.drawImage(image, { x: placement.x, y: placement.y, width: drawWidth, height: drawHeight });
      page.drawText(buildSignatureCaption(signature.label, signature.signedAt), {
        x: placement.x,
        y: layout.labelBaselineY,
        size: 8,
        font: regular,
      });
    }

    page.drawText(`Document contresigné le ${formatSignatureDate(new Date().toISOString())}`, {
      x: MARGIN,
      y: layout.dateBaselineY,
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
