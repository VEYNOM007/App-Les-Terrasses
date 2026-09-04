import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
} from '@nestjs/common';
import { Response } from 'express';

export interface ValidationMessageFragment {
  property: string;
  isInteger?: boolean;
  isNumber?: boolean;
  isString?: boolean;
  min?: number;
  max?: number;
}

/**
 * Convertit une ligne de contrainte class-validator en fragment exploitable.
 * Format par défaut : "<property> must not be greater than 100", etc.
 */
export function parseValidationMessage(
  raw: string,
): ValidationMessageFragment | null {
  const property = raw.split(' ')[0];
  if (!property) return null;

  const fragment: ValidationMessageFragment = { property };
  if (/must be an integer/.test(raw)) fragment.isInteger = true;
  if (/must be a (number|\d+)/.test(raw) && !/an integer/.test(raw)) {
    fragment.isNumber = true;
  }
  if (/must be a string/.test(raw)) fragment.isString = true;

  const maxMatch = /must not be greater than (\d+)/.exec(raw);
  if (maxMatch) fragment.max = Number(maxMatch[1]);

  const minMatch = /must not be less than (\d+)/.exec(raw);
  if (minMatch) fragment.min = Number(minMatch[1]);

  return fragment;
}

function describeType(f: ValidationMessageFragment): string {
  if (f.isInteger) return 'un nombre entier';
  if (f.isString) return 'une chaîne de caractères';
  return 'un nombre';
}

function bounds(f: ValidationMessageFragment): string | null {
  if (f.min !== undefined && f.max !== undefined) return `entre ${f.min} et ${f.max}`;
  if (f.min !== undefined) return `d'au moins ${f.min}`;
  if (f.max !== undefined) return `d'au plus ${f.max}`;
  return null;
}

function describeFragment(f: ValidationMessageFragment): string {
  const parts: string[] = [];
  parts.push(describeType(f));
  const b = bounds(f);
  if (b) parts.push(b);
  return parts.join(' ');
}

function propertyLabel(property: string): string {
  // downPaymentPercent -> "downPaymentPercent" (aucune liste blanche : on
  // garde le nom technique du champ, plus proche du formulaire affiché).
  return property;
}

/**
 * Filet de sécurité global : traduit en français lisible les erreurs de la
 * ValidationPipe (class-validator), dont le `message` est un TABLEAU de
 * chaînes techniques ("downPaymentPercent must not be greater than 100").
 *
 * Règle de discrimination : une erreur métier (ex. BadRequestException
 * "Cette échéance est déjà payée.") a `message` en STRING et est laissée
 * INTACTE. Seules les erreurs de validation automatique (Array) sont
 * reformatées — aucun risque de casser les messages déjà rédigés pour
 * l'utilisateur.
 */
@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
  catch(exception: BadRequestException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const response = exception.getResponse();

    const message = typeof response === 'string' ? response : (response as { message?: unknown }).message;

    // Erreur métier (string) ou format inattendu : on la laisse telle quelle.
    if (typeof message !== 'object' || !Array.isArray(message)) {
      const status = exception.getStatus();
      res.status(status).json(
        typeof response === 'string' ? { statusCode: status, message: response, error: 'Bad Request' } : response,
      );
      return;
    }

    const fragments = message
      .map((m) => (typeof m === 'string' ? parseValidationMessage(m) : null))
      .filter((f): f is ValidationMessageFragment => f !== null)
      // On ne reformate que si au moins un fragment porte une contrainte
      // exploitable (type ou borne) : sinon on garde le message d'origine.
      .filter((f) => f.isInteger || f.isNumber || f.isString || f.min !== undefined || f.max !== undefined);

    if (fragments.length === 0) {
      const status = exception.getStatus();
      res.status(status).json(response);
      return;
    }

    // Fusionne tous les fragments du même champ (une requête invalide
    // produit plusieurs messages class-validator pour la même propriété).
    const merged: ValidationMessageFragment = { property: fragments[0].property };
    for (const f of fragments) {
      if (f.isInteger) merged.isInteger = true;
      if (f.isNumber) merged.isNumber = true;
      if (f.isString) merged.isString = true;
      if (f.min !== undefined) merged.min = f.min;
      if (f.max !== undefined) merged.max = f.max;
    }

    const label = propertyLabel(merged.property);
    const readable = `Le champ « ${label} » doit être ${describeFragment(merged)}.`;

    res.status(exception.getStatus()).json({
      statusCode: exception.getStatus(),
      message: readable,
      error: 'Bad Request',
    });
  }
}
