import {
  convertXofToEurCents,
  DEFAULT_XOF_TO_EUR_RATE,
  resolveXofToEurRate,
} from './eur-conversion';

describe('eur-conversion', () => {
  describe('convertXofToEurCents', () => {
    it('convertit 500 000 XOF en centimes EUR avec le taux par défaut (1 EUR = 655,957 XOF)', () => {
      expect(convertXofToEurCents(500000, DEFAULT_XOF_TO_EUR_RATE)).toBe(76225);
    });

    it('convertit 0 XOF en 0 centime', () => {
      expect(convertXofToEurCents(0, DEFAULT_XOF_TO_EUR_RATE)).toBe(0);
    });

    it('respecte un taux personnalisé', () => {
      // 1000 XOF à 1000 XOF/EUR = 1 EUR = 100 centimes
      expect(convertXofToEurCents(1000, 1000)).toBe(100);
    });

    it('arrondit à l\'entier le plus proche (centime)', () => {
      // 0,005 EUR → 1 centime
      expect(convertXofToEurCents(3, 600)).toBe(1);
    });

    it('lève RangeError si xofAmount est négatif', () => {
      expect(() => convertXofToEurCents(-1, DEFAULT_XOF_TO_EUR_RATE)).toThrow(RangeError);
    });

    it('lève RangeError si le taux est négatif ou nul', () => {
      expect(() => convertXofToEurCents(1000, 0)).toThrow(RangeError);
      expect(() => convertXofToEurCents(1000, -5)).toThrow(RangeError);
    });
  });

  describe('resolveXofToEurRate', () => {
    const originalRate = process.env.STRIPE_EUR_XOF_RATE;

    afterEach(() => {
      if (originalRate === undefined) {
        delete process.env.STRIPE_EUR_XOF_RATE;
      } else {
        process.env.STRIPE_EUR_XOF_RATE = originalRate;
      }
    });

    it('retourne le taux officiel par défaut si la variable est absente', () => {
      delete process.env.STRIPE_EUR_XOF_RATE;
      expect(resolveXofToEurRate()).toBe(DEFAULT_XOF_TO_EUR_RATE);
    });

    it('lit un taux surchargé via l\'environnement', () => {
      process.env.STRIPE_EUR_XOF_RATE = '700';
      expect(resolveXofToEurRate()).toBe(700);
    });

    it('lève RangeError si STRIPE_EUR_XOF_RATE est invalide (jamais de repli silencieux)', () => {
      process.env.STRIPE_EUR_XOF_RATE = 'abc';
      expect(() => resolveXofToEurRate()).toThrow(RangeError);
      process.env.STRIPE_EUR_XOF_RATE = '0';
      expect(() => resolveXofToEurRate()).toThrow(RangeError);
    });
  });
});
