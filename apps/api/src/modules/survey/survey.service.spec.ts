import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateSurveyDto } from './dto/create-survey.dto';
import { SurveyService } from './survey.service';

function basePayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    residence: 'LOME',
    togoLink: 'RESIDENT',
    projectGoal: 'RESIDENCE_PRINCIPALE',
    preference: 'APPARTEMENT',
    budget: '20_35M',
    budgetCurrency: 'XOF',
    size: 'T3',
    decisionMakers: ['MOI'],
    blockers: ['PRIX'],
    reassurances: ['TITRE_PAR_LOT'],
    ...overrides,
  };
}

function dto(overrides: Record<string, unknown> = {}): CreateSurveyDto {
  return plainToInstance(CreateSurveyDto, basePayload(overrides));
}

async function buildService() {
  const responseCreate = jest.fn().mockResolvedValue({ id: 'resp-1' });
  const contactCreate = jest.fn().mockResolvedValue({ id: 'contact-1' });

  const prisma = {
    $transaction: jest.fn(
      async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          surveyResponse: { create: responseCreate },
          surveyContact: { create: contactCreate },
        }),
    ),
  };

  const moduleRef = await Test.createTestingModule({
    providers: [SurveyService, { provide: PrismaService, useValue: prisma }],
  }).compile();

  return { service: moduleRef.get(SurveyService), responseCreate, contactCreate };
}

describe('SurveyService — otherAnswers', () => {
  it('enregistre otherAnswers.freins quand « Autre » est cochée', async () => {
    const { service, responseCreate } = await buildService();

    await service.create(
      dto({
        blockers: ['PRIX', 'AUTRE'],
        otherAnswers: { freins: '  Projet trop loin  ' },
      }),
    );

    expect(responseCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        otherAnswers: { freins: 'Projet trop loin' },
      }),
    });
  });

  it('enregistre otherAnswers.decision quand « Autre » est cochée', async () => {
    const { service, responseCreate } = await buildService();

    await service.create(
      dto({
        decisionMakers: ['MOI', 'AUTRE'],
        otherAnswers: { decision: 'Mon cousin' },
      }),
    );

    expect(responseCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        otherAnswers: { decision: 'Mon cousin' },
      }),
    });
  });

  it('enregistre otherAnswers.reassurances quand « Autre » est cochée', async () => {
    const { service, responseCreate } = await buildService();

    await service.create(
      dto({
        reassurances: ['GARANTIES', 'AUTRE'],
        otherAnswers: { reassurances: 'Passage chez le notaire' },
      }),
    );

    expect(responseCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        otherAnswers: { reassurances: 'Passage chez le notaire' },
      }),
    });
  });

  it('ne stocke rien si « Autre » n’est pas cochée', async () => {
    const { service, responseCreate } = await buildService();

    await service.create(
      dto({
        blockers: ['PRIX'],
        decisionMakers: ['MOI'],
        reassurances: ['GARANTIES'],
        otherAnswers: { freins: 'Projet trop loin', decision: 'Mon cousin' },
      }),
    );

    expect(responseCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ otherAnswers: undefined }),
    });
  });

  it('ignore les clés inconnues et ne garde que les clés autorisées', async () => {
    const { service, responseCreate } = await buildService();

    await service.create(
      dto({
        blockers: ['AUTRE'],
        otherAnswers: { freins: 'ok', pirate: 'injection' },
      }),
    );

    expect(responseCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ otherAnswers: { freins: 'ok' } }),
    });
  });

  it('supprime les caractères de contrôle et tronque à 200 caractères', async () => {
    const { service, responseCreate } = await buildService();
    const long = 'a'.repeat(250);

    await service.create(
      dto({
        blockers: ['AUTRE'],
        otherAnswers: { freins: `  ${long}\u0000\u001f  ` },
      }),
    );

    const call = responseCreate.mock.calls[0][0];
    expect(call.data.otherAnswers.freins).toHaveLength(200);
    expect(call.data.otherAnswers.freins).toBe('a'.repeat(200));
  });
});
