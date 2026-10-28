import { sanitizeSource } from './survey.constants';
import { csvCell, toCsv, type SurveyCsvRow } from './survey-csv';

const ROW: SurveyCsvRow = {
  createdAt: new Date('2026-10-28T12:00:00.000Z'),
  source: 'flyer-01',
  residence: 'LOME',
  togoLink: 'DIASPORA',
  projectGoal: 'RESIDENCE_PRINCIPALE',
  preference: 'APPARTEMENT',
  budget: '20_35M',
  budgetCurrency: 'XOF',
  size: 'T3',
  decisionMakers: ['MOI', 'CONJOINT'],
  blockers: ['PRIX'],
  reassurances: ['TITRE_PAR_LOT', 'SUIVI_PHOTO'],
  whyText: 'Le calme ; la sécurité',
  experienceText: null,
  contact: { email: 'vous@exemple.com', whatsapp: null, consent: true },
};

describe('csvCell', () => {
  it('laisse une valeur simple intacte', () => {
    expect(csvCell('Lomé')).toBe('Lomé');
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });

  it('protège les séparateurs, guillemets et retours à la ligne', () => {
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell('a"b')).toBe('"a""b"');
    expect(csvCell('a\nb')).toBe('"a\nb"');
  });
});

describe('toCsv', () => {
  it('commence par le BOM UTF-8 et un en-tête lisible', () => {
    const csv = toCsv([ROW]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('Date (UTC);Source;Résidence');
  });

  it('traduit les valeurs du référentiel et joint les choix multiples', () => {
    const csv = toCsv([ROW]);
    expect(csv).toContain('Lomé');
    expect(csv).toContain('Résidence principale');
    expect(csv).toContain('Moi | Conjoint(e)');
    expect(csv).toContain('Titre foncier par lot | Suivi photo / vidéo');
  });

  it('échappe les textes libres et sépare les réponses', () => {
    const csv = toCsv([ROW]);
    expect(csv).toContain('"Le calme ; la sécurité"');
    expect(csv).toContain('vous@exemple.com');
    expect(csv.trim().split('\r\n')).toHaveLength(2);
  });

  it('gère une réponse sans contact', () => {
    const csv = toCsv([{ ...ROW, contact: null }]);
    expect(csv).toContain('Non\r\n');
  });
});

describe('sanitizeSource', () => {
  it('normalise un identifiant de QR code', () => {
    expect(sanitizeSource(' Flyer_QR-01 ')).toBe('flyer_qr-01');
  });

  it('rejette les valeurs vides ou non textuelles', () => {
    expect(sanitizeSource('')).toBeNull();
    expect(sanitizeSource(null)).toBeNull();
    expect(sanitizeSource(42)).toBeNull();
    expect(sanitizeSource('!!!')).toBeNull();
  });
});
