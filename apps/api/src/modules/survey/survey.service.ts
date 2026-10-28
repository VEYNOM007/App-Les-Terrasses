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
        },
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
