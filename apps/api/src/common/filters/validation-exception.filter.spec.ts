import { BadRequestException } from '@nestjs/common';
import { ValidationExceptionFilter, parseValidationMessage } from './validation-exception.filter';

/**
 * Filet de sécurité des erreurs de validation : un message en TABLEAU
 * (class-validator) doit devenir un message français lisible ; une erreur
 * métier en STRING doit rester intacte.
 */

function runFilter(exception: BadRequestException) {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const res = { status } as unknown as {
    status: jest.Mock;
    json: jest.Mock;
  };
  const host = {
    switchToHttp: () => ({ getResponse: () => res }),
  } as never;

  new ValidationExceptionFilter().catch(exception, host);
  return { status, json };
}

describe('ValidationExceptionFilter', () => {
  it('reformate une erreur de validation (Array) en message français lisible', () => {
    const e = new BadRequestException({
      statusCode: 400,
      message: [
        'downPaymentPercent must not be greater than 100',
        'downPaymentPercent must not be less than 1',
        'downPaymentPercent must be an integer number',
      ],
      error: 'Bad Request',
    });
    const { status, json } = runFilter(e);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: 'Le champ « downPaymentPercent » doit être un nombre entier entre 1 et 100.',
        error: 'Bad Request',
      }),
    );
  });

  it('laisse intacte une erreur métier (message STRING, déjà en français)', () => {
    const e = new BadRequestException('Cette échéance est déjà payée.');
    const { status, json } = runFilter(e);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400, message: 'Cette échéance est déjà payée.' }),
    );
  });

  it('laisse intacte une erreur de validation sans fragment exploitable', () => {
    const body = { statusCode: 400, message: ['???'], error: 'Bad Request' };
    const e = new BadRequestException(body);
    const { json } = runFilter(e);
    expect(json).toHaveBeenCalledWith(body);
  });
});

describe('parseValidationMessage', () => {
  it('extrait le champ, les bornes et le type entier', () => {
    expect(parseValidationMessage('downPaymentPercent must not be greater than 100')).toEqual({
      property: 'downPaymentPercent',
      max: 100,
    });
    expect(parseValidationMessage('downPaymentPercent must not be less than 1')).toEqual({
      property: 'downPaymentPercent',
      min: 1,
    });
    expect(parseValidationMessage('downPaymentPercent must be an integer number')).toEqual(
      expect.objectContaining({ property: 'downPaymentPercent', isInteger: true }),
    );
  });
});
