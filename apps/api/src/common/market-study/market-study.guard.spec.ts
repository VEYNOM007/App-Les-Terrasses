import { ForbiddenException } from '@nestjs/common';
import { MarketStudyGuard } from './market-study.guard';

describe('MarketStudyGuard', () => {
  const original = process.env.MARKET_STUDY_MODE;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.MARKET_STUDY_MODE;
    } else {
      process.env.MARKET_STUDY_MODE = original;
    }
  });

  it('refuse les actions de vente quand le flag est absent (défaut)', () => {
    delete process.env.MARKET_STUDY_MODE;
    expect(() => new MarketStudyGuard().canActivate()).toThrow(ForbiddenException);
  });

  it('refuse les actions de vente quand le flag vaut true', () => {
    process.env.MARKET_STUDY_MODE = 'true';
    expect(() => new MarketStudyGuard().canActivate()).toThrow(ForbiddenException);
  });

  it('autorise les actions de vente quand le flag vaut false', () => {
    process.env.MARKET_STUDY_MODE = 'false';
    expect(new MarketStudyGuard().canActivate()).toBe(true);
  });
});
