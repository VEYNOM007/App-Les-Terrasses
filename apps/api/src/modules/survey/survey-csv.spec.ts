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
  intentBefore: 2,
  intentAfter: 5,
  topAtouts: ['securite', 'parc', 'mer'],
  remainingBlockers: null,
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

  it('neutralise whyText commençant par =', () => {
    const csv = toCsv([{ ...ROW, whyText: '=HYPERLINK("http://evil.test/","x")' }]);
    expect(csv).toContain("'=HYPERLINK");
  });

  it('neutralise experienceText commençant par +', () => {
    const csv = toCsv([{ ...ROW, experienceText: '+cmd|"/c calc"!A0' }]);
    expect(csv).toContain("'+cmd");
  });

  it('neutralise remainingBlockers commençant par -', () => {
    const csv = toCsv([{ ...ROW, remainingBlockers: '-2+3*cmd|"/c calc"!A0' }]);
    expect(csv).toContain("'-2");
  });

  it('neutralise email commençant par =', () => {
    const csv = toCsv([{ ...ROW, contact: { email: '=test@test.com', whatsapp: null, consent: true } }]);
    expect(csv).toContain("'=test@test.com");
  });

  it('neutralise whatsapp commençant par +', () => {
    const csv = toCsv([{ ...ROW, contact: { email: null, whatsapp: '+22812345678', consent: true } }]);
    expect(csv).toContain("'+22812345678");
  });

  it('neutralise source commençant par @', () => {
    const csv = toCsv([{ ...ROW, source: '@flyer' }]);
    expect(csv).toContain("'@flyer");
  });

  it('neutralise avec tabulation avant =', () => {
    const csv = toCsv([{ ...ROW, whyText: '\t=CMD' }]);
    expect(csv).toContain("'	=CMD");
  });

  it('neutralise avec CR avant +', () => {
    const csv = toCsv([{ ...ROW, whyText: '\r+CMD' }]);
    expect(csv).toContain("'\r+CMD");
  });

  it('neutralise un texte commençant par un retour chariot', () => {
    const csv = toCsv([{ ...ROW, whyText: '\rtexte' }]);
    expect(csv).toContain("'\rtexte");
  });

  it('neutralise otherAnswers freins avec tabulation', () => {
    const csv = toCsv([{ ...ROW, blockers: ['AUTRE'], otherAnswers: { freins: '\t=TEST' } }]);
    expect(csv).toContain("'	=TEST");
  });

  it('nomme la colonne de précision des rassurances « rassurances »', () => {
    const csv = toCsv([ROW]);
    expect(csv).toContain('Précision rassurances (Autre)');
    expect(csv).not.toContain('Précision assurances');
  });

  it('exporte l’intention avant/après, l’écart et les atouts', () => {
    const csv = toCsv([ROW]);
    expect(csv).toContain('Intention avant (1-5)');
    expect(csv).toContain('Intention après (1-5)');
    expect(csv).toContain('Écart');
    expect(csv).toContain('Atouts choisis');
    expect(csv).toContain('3');
    expect(csv).toContain(
      'Résidence fermée et sécurisée | Parc central planté | À environ 550 m de la mer et 3 minutes d’Agbodrafo en voiture',
    );
  });

  it('laisse vides les colonnes d’intention quand les notes sont absentes', () => {
    const csv = toCsv([{ ...ROW, intentBefore: null, intentAfter: null }]);
    const line = csv.trim().split('\r\n')[1];
    expect(line).toContain(';;;');
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
