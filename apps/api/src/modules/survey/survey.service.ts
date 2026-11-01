import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateSurveyDto } from './dto/create-survey.dto';
import { sanitizeSource, SURVEY_CONSENT_VERSION } from './survey.constants';

@Injectable()
export class SurveyService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSurveyDto): Promise<{ id: string }> {
    const email = dto.contact?.email?.trim().toLowerCase() ?? null;
    const whatsapp = dto.contact?.whatsapp?.trim() ?? null;
    const hasContact = email !== null || whatsapp !== null;

    // Le contact est facultatif, mais son enregistrement exige un
    // consentement explicite — vérifié aussi côté serveur.
    if (hasContact && dto.contact?.consent !== true) {
      throw new BadRequestException(
        'Le consentement est requis pour enregistrer un contact.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const sanitizeText = (value: unknown): string | null => {
        if (typeof value !== 'string') return null;
        const cleaned = value.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();
        if (cleaned.length === 0) return null;
        return cleaned.slice(0, 200);
      };

      const allowedOtherKeys = new Set([
        'freins',
        'decision',
        'residence',
        'togoLink',
        'projectGoal',
        'preference',
        'size',
        'reassurances',
      ]);

      let otherAnswers: Record<string, string> | undefined;
      if (dto.otherAnswers && typeof dto.otherAnswers === 'object') {
        const cleaned: Record<string, string> = {};
        for (const [key, value] of Object.entries(dto.otherAnswers)) {
          if (!allowedOtherKeys.has(key)) continue;
          const text = sanitizeText(value);
          if (!text) continue;
          if (key === 'freins' && !Array.isArray(dto.blockers)) continue;
          if (key === 'freins' && !dto.blockers.includes('AUTRE')) continue;
          if (key === 'decision' && !Array.isArray(dto.decisionMakers)) continue;
          if (key === 'decision' && !dto.decisionMakers.includes('AUTRE')) continue;
          if (key === 'residence' && dto.residence !== 'AUTRE') continue;
          if (key === 'togoLink' && !String(dto.togoLink).toUpperCase().includes('AUTRE')) continue;
          if (key === 'projectGoal' && !String(dto.projectGoal).toUpperCase().includes('AUTRE')) continue;
          if (key === 'preference' && !String(dto.preference).toUpperCase().includes('AUTRE')) continue;
          if (key === 'size' && !String(dto.size).toUpperCase().includes('AUTRE')) continue;
          if (key === 'reassurances' && !Array.isArray(dto.reassurances)) continue;
          if (key === 'reassurances' && !dto.reassurances.includes('AUTRE')) continue;
          cleaned[key] = text;
        }
        if (Object.keys(cleaned).length > 0) {
          otherAnswers = cleaned;
        }
      }

      const response = await tx.surveyResponse.create({
        data: {
          source: sanitizeSource(dto.source),
          residence: dto.residence,
          togoLink: dto.togoLink,
          projectGoal: dto.projectGoal,
          preference: dto.preference,
          whyText: dto.whyText?.trim() || null,
          budget: dto.budget,
          budgetCurrency: dto.budgetCurrency,
          size: dto.size,
          decisionMakers: dto.decisionMakers,
          blockers: dto.blockers,
          reassurances: dto.reassurances,
          experienceText: dto.experienceText?.trim() || null,
          intentBefore: typeof dto.intentBefore === 'number' ? dto.intentBefore : null,
          intentAfter: typeof dto.intentAfter === 'number' ? dto.intentAfter : null,
          topAtouts: Array.isArray(dto.topAtouts) ? dto.topAtouts : [],
          remainingBlockers: dto.remainingBlockers?.trim() || null,
          otherAnswers: otherAnswers ?? undefined,
        } as any,
      });

      if (hasContact) {
        await tx.surveyContact.create({
          data: {
            responseId: response.id,
            email,
            whatsapp,
            consent: true,
            consentAt: new Date(),
            consentVersion: SURVEY_CONSENT_VERSION,
          },
        });
      }

      return { id: response.id };
    });
  }

  list(source?: string) {
    const normalized = source ? sanitizeSource(source) : null;

    return this.prisma.surveyResponse.findMany({
      where: source
        ? { source: normalized ?? '__source_invalide__' }
        : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        contact: {
          select: { email: true, whatsapp: true, consent: true },
        },
      },
    });
  }
}
