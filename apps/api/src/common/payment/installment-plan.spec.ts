import {
  BALANCE_TRANCHES,
  DEFAULT_DOWN_PAYMENT_PERCENT,
  buildInstallmentPlan,
} from './installment-plan';

describe('buildInstallmentPlan', () => {
  it('construit l\'échéancier par défaut (acompte 10 %) avec 5 tranches qui somment au total', () => {
    const plan = buildInstallmentPlan({ totalAmount: 50_000_000 });

    expect(plan).toHaveLength(1 + BALANCE_TRANCHES.length);
    expect(plan[0]).toMatchObject({
      label: 'Acompte réservation',
      percent: DEFAULT_DOWN_PAYMENT_PERCENT / 100,
      amount: 5_000_000,
    });
    const total = plan.reduce((sum, item) => sum + item.amount, 0);
    expect(total).toBe(50_000_000);
  });

  it('renormalise les tranches d\'équilibre sur un acompte personnalisé borné à 1 %', () => {
    const plan = buildInstallmentPlan({ totalAmount: 50_000_000, downPaymentPercent: 1 });

    expect(plan).toHaveLength(1 + BALANCE_TRANCHES.length);
    expect(plan[0].amount).toBe(500_000);
    const total = plan.reduce((sum, item) => sum + item.amount, 0);
    expect(total).toBe(50_000_000);
  });

  it('à 100 % d\'acompte, exclut les tranches de montant nul (une seule échéance)', () => {
    const plan = buildInstallmentPlan({ totalAmount: 50_000_000, downPaymentPercent: 100 });

    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({
      label: 'Acompte réservation',
      percent: 1,
      amount: 50_000_000,
    });
    const total = plan.reduce((sum, item) => sum + item.amount, 0);
    expect(total).toBe(50_000_000);
  });

  it('ne laisse aucune tranche à 0 FCFA dans l\'échéancier', () => {
    const plan = buildInstallmentPlan({ totalAmount: 50_000_000, downPaymentPercent: 100 });

    expect(plan.every((item) => item.amount > 0)).toBe(true);
  });

  it('rejette un acompte hors de [1, 100]', () => {
    expect(() => buildInstallmentPlan({ totalAmount: 1_000_000, downPaymentPercent: 0 })).toThrow(RangeError);
    expect(() => buildInstallmentPlan({ totalAmount: 1_000_000, downPaymentPercent: 101 })).toThrow(RangeError);
  });

  it('rejette un montant négatif', () => {
    expect(() => buildInstallmentPlan({ totalAmount: -1 })).toThrow(RangeError);
  });

  it('décale les dates des tranches selon daysFromNow', () => {
    const startDate = new Date('2026-01-01T00:00:00.000Z');
    const plan = buildInstallmentPlan({ totalAmount: 10_000_000, startDate });

    expect(plan[0].dueDate.getTime()).toBe(startDate.getTime());
    expect(plan[1].dueDate.getTime()).toBe(
      startDate.getTime() + BALANCE_TRANCHES[0].daysFromNow * 24 * 60 * 60 * 1000,
    );
  });
});
