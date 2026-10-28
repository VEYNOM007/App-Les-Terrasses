import { CanActivate, ForbiddenException, Injectable } from '@nestjs/common';

/**
 * Mode étude de marché (activé par défaut).
 *
 * Le code de vente reste intégralement en place : ce garde ne supprime rien,
 * il refuse les actions commerciales (création de réservation, initiation de
 * paiement) tant que `MARKET_STUDY_MODE` n'est pas explicitement passé à
 * `false`. La réactivation se fait donc par configuration, sans redéploiement
 * de code métier différent.
 */
export function isMarketStudyMode(): boolean {
  return process.env.MARKET_STUDY_MODE !== 'false';
}

@Injectable()
export class MarketStudyGuard implements CanActivate {
  canActivate(): boolean {
    if (isMarketStudyMode()) {
      throw new ForbiddenException(
        "Le projet est en phase d'étude de marché : aucune réservation ni paiement n'est accepté.",
      );
    }
    return true;
  }
}
