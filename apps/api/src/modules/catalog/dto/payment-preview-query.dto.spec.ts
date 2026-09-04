import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PaymentPreviewQueryDto } from './payment-preview-query.dto';

/**
 * Les query params HTTP arrivent en string : `@Type(() => Number)` les
 * convertit avant validation (couplé au ValidationPipe transform). Sans cette
 * conversion, `downPaymentPercent=51` arrive en `"51"` (string) et fait
 * échouer @IsInt/@Min/@Max d'un coup — exactement l'erreur brute vue par
 * l'utilisateur ("must not be greater than 100, must not be less than 1, must
 * be an integer number").
 */
describe('PaymentPreviewQueryDto — downPaymentPercent', () => {
  it('convertit une valeur valide "51" (string HTTP) en nombre 51 sans erreur', async () => {
    const dto = plainToInstance(PaymentPreviewQueryDto, { downPaymentPercent: '51' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.downPaymentPercent).toBe(51);
  });

  it('convertit la borne basse "1" en 1 sans erreur', async () => {
    const dto = plainToInstance(PaymentPreviewQueryDto, { downPaymentPercent: '1' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.downPaymentPercent).toBe(1);
  });

  it('convertit la borne haute "100" en 100 sans erreur', async () => {
    const dto = plainToInstance(PaymentPreviewQueryDto, { downPaymentPercent: '100' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.downPaymentPercent).toBe(100);
  });

  it('absente (undefined) -> 0 erreur (l\u2019API applique l\u2019acompte par d\u00e9faut)', async () => {
    const dto = plainToInstance(PaymentPreviewQueryDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.downPaymentPercent).toBeUndefined();
  });

  it.each([
    ['hors borne basse', '0'],
    ['hors borne haute', '101'],
    ['non num\u00e9rique', 'abc'],
    ['cha\u00eene vide', ''],
    ['d\u00e9cimal', '10.5'],
  ])('rejette %s ("%s")', async (_label, raw) => {
    const dto = plainToInstance(PaymentPreviewQueryDto, { downPaymentPercent: raw });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
  });
});
