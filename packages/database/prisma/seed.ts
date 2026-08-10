import {
  PrismaClient,
  UserRole,
  ProjectStatus,
  UnitType,
  Frontage,
  UnitStatus,
  LaunchStatus,
  ParkingType,
  ArtisanTrade,
  MediaType,
  ReservationStatus,
  InstallmentStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

// Prix catalogue de départ (point de départ éditable via l'admin — décision Temps 2).
const PRICE_XOF: Record<UnitType, number> = {
  STUDIO: 15_000_000,
  T2: 24_000_000,
  T3: 35_000_000,
  T4: 42_000_000,
  T5: 55_000_000,
  COMMERCE: 38_000_000,
};

interface SeedUnit {
  type: UnitType;
  floor: number;
  status: UnitStatus;
  surface: number;
  hasStorefront?: boolean;
  streetFacing?: boolean;
}

const RENDER_PHOTOS: Record<UnitType, { title: string; url: string }[]> = {
  STUDIO: [
    { title: 'Séjour & Coin Nuit 3D', url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80' },
    { title: 'Salle deau à litalienne', url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&q=80' },
  ],
  T2: [
    { title: 'Séjour & Espace Repas', url: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1200&q=80' },
    { title: 'Chambre Principale', url: 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&q=80' },
  ],
  T3: [
    { title: 'Grand Séjour Familial', url: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=80' },
    { title: 'Salle deau Italienne & Marbre', url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&q=80' },
  ],
  T4: [],
  T5: [
    { title: 'Séjour Cathédrale & Baies Vitrées', url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80' },
    { title: 'Master Suite Parentale Vue Panoramique', url: 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&q=80' },
  ],
  COMMERCE: [
    { title: 'Vitrine Commerciale sur Rue', url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80' },
  ],
};

const FLOOR_PLAN_2D = 'https://images.unsplash.com/photo-1600585152220-90363fe7e115?auto=format&fit=crop&w=1200&q=80';

// Echéancier standard du projet (reflet de PaymentService.DEFAULT_INSTALLMENT_PLAN).
const INSTALLMENT_PLAN = [
  { label: 'Acompte réservation', percent: 0.1, daysOffset: 0 },
  { label: 'Tranche fondations', percent: 0.2, daysOffset: 60 },
  { label: 'Tranche gros œuvre', percent: 0.3, daysOffset: 150 },
  { label: 'Tranche finitions', percent: 0.25, daysOffset: 270 },
  { label: 'Solde livraison', percent: 0.15, daysOffset: 365 },
];

async function main() {
  console.log('🌱 Démarrage du seed de la base de données Résidence Catalog...');

  // 0. Nettoyage des données existantes (ordre respectueux des FK)
  await prisma.unitMedia.deleteMany({});
  await prisma.parkingSpot.deleteMany({});
  await prisma.paymentInstallment.deleteMany({});
  await prisma.paymentSchedule.deleteMany({});
  await prisma.reservation.deleteMany({});
  await prisma.unit.deleteMany({});
  await prisma.artisanAssignment.deleteMany({});
  await prisma.quote.deleteMany({});
  await prisma.block.deleteMany({});
  await prisma.project.deleteMany({});

  // 1. Utilisateurs démo
  await prisma.user.upsert({
    where: { email: 'admin@terrasses-baguida.tg' },
    update: {},
    create: {
      email: 'admin@terrasses-baguida.tg',
      phone: '+22890000001',
      fullName: 'Administrateur Promotion',
      passwordHash: '$2b$10$e8K7b...demo',
      role: UserRole.ADMIN,
    },
  });

  const buyerUser = await prisma.user.upsert({
    where: { email: 'akossiwa@example.com' },
    update: {},
    create: {
      email: 'akossiwa@example.com',
      phone: '+22890123456',
      fullName: 'Akossiwa Mensah',
      passwordHash: '$2b$10$e8K7b...demo',
      role: UserRole.ACHETEUR,
    },
  });

  const artisanUser = await prisma.user.upsert({
    where: { email: 'artisan.macon@btp-togo.tg' },
    update: {},
    create: {
      email: 'artisan.macon@btp-togo.tg',
      phone: '+22890987654',
      fullName: 'Koffi Amouzou (BTP Togo)',
      passwordHash: '$2b$10$e8K7b...demo',
      role: UserRole.ARTISAN,
    },
  });

  const artisanProfile = await prisma.artisan.upsert({
    where: { userId: artisanUser.id },
    update: {},
    create: {
      userId: artisanUser.id,
      companyName: 'Amouzou Maçonnerie & Gros Œuvre SARL',
      trade: ArtisanTrade.MACONNERIE,
    },
  });

  // 2. Projet "Les Terrasses de Baguida"
  const project = await prisma.project.create({
    data: {
      name: 'Les Terrasses de Baguida',
      description:
        'Studios, T2, T3 et T5 en résidence fermée sécurisée avec façade commerciale et auvents solaires à Baguida, Lomé.',
      location: 'Baguida, Lomé (Titre Foncier RM 100/71)',
      amenities: ['gardiennage', 'aire_de_jeux', 'auvents_solaires', 'parking_pilotis'],
      status: ProjectStatus.PUBLIE,
      siteMapImageUrl: '/images/masterplan-les-terrasses.jpg',
      // Infos marketing stockées en base (fini catalogData.ts côté front).
      marketingInfo: {
        name: 'Résidence Les Terrasses · Baguida',
        location: 'Baguida, Lomé - Togo (à 5 min du Littoral)',
        titleDeed: 'RM 100/71 (Titre Foncier Définitif et Libéré)',
        totalLandArea: '6 593 m²',
        deliveryDate: 'Trimestre 4 - 2026',
        notaryName: 'Étude Maître K. Lawson & Associés (Notaire Agréé)',
        escrowBank: 'Compte Séquestre Garantia - Ecobank / Coris Bank',
      },
    },
  });

  console.log(`🏢 Projet créé : ${project.name} (ID: ${project.id})`);

  // 3. Les 4 blocs
  const blockA = await prisma.block.create({
    data: {
      projectId: project.id,
      name: 'Bloc A',
      floors: 3,
      frontage: Frontage.FACADE_SECONDAIRE,
      launchStatus: LaunchStatus.EN_COMMERCIALISATION,
      fundingThresholdPercent: 60,
    },
  });

  const blockB = await prisma.block.create({
    data: {
      projectId: project.id,
      name: 'Bloc B',
      floors: 3,
      frontage: Frontage.INTERIEUR_ILOT,
      launchStatus: LaunchStatus.EN_COMMERCIALISATION,
      fundingThresholdPercent: 60,
    },
  });

  const blockC = await prisma.block.create({
    data: {
      projectId: project.id,
      name: 'Bloc C',
      floors: 3,
      frontage: Frontage.INTERIEUR_ILOT,
      launchStatus: LaunchStatus.SEUIL_ATTEINT,
      thresholdReachedAt: new Date(),
      fundingThresholdPercent: 60,
    },
  });

  const blockD = await prisma.block.create({
    data: {
      projectId: project.id,
      name: 'Bloc D',
      floors: 3,
      frontage: Frontage.MITOYEN,
      launchStatus: LaunchStatus.EN_COMMERCIALISATION,
      fundingThresholdPercent: 60,
    },
  });

  console.log('✅ Blocs A, B, C, D créés');

  // 3bis. Vues du catalogue — stockées en base, hotspots câblés sur les vrais ids de blocs
  await prisma.project.update({
    where: { id: project.id },
    data: {
      views: [
        {
          id: 'view-masterplan',
          title: 'Plan de Masse Officiel',
          subtitle: 'Plan Cadastral & Découpe des Blocs (Titre Foncier RM 100/71)',
          category: 'masterplan',
          imageUrl: '/images/masterplan-les-terrasses.jpg',
          description:
            "Plan de masse vectoriel officiel à l'échelle 1/500. Cliquez sur les blocs pour explorer les appartements.",
          hotspots: [
            { id: 'hs-mp-a', label: 'BLOC A · Studios, T2 & Boutique', targetBlockId: blockA.id, top: '30%', left: '35%' },
            { id: 'hs-mp-b', label: 'BLOC B · T2 & T3 Spacieux', targetBlockId: blockB.id, top: '30%', left: '65%' },
            { id: 'hs-mp-c', label: 'BLOC C · T2, T3 & T5', targetBlockId: blockC.id, top: '65%', left: '35%' },
            { id: 'hs-mp-d', label: 'BLOC D · Studios & T3', targetBlockId: blockD.id, top: '65%', left: '65%' },
          ],
        },
        {
          id: 'view-aerial',
          title: 'Vue Aérienne HD du Complexe',
          subtitle: 'Vue Rendu Photoréaliste Haute Définition · Baguida',
          category: 'aerial',
          imageUrl: '/images/masterplan-les-terrasses.jpg',
          description:
            'Vue aérienne officielle. Survolez et cliquez sur les boutons interactifs placés sur les bâtiments pour réserver votre bien.',
          hotspots: [
            { id: 'hs-aerial-a', label: 'BLOC A · Studios, T2 & Boutique', targetBlockId: blockA.id, top: '31%', left: '38%' },
            { id: 'hs-aerial-b', label: 'BLOC B · T2 & T3', targetBlockId: blockB.id, top: '31%', left: '68%' },
            { id: 'hs-aerial-c', label: 'BLOC C · T2, T3 & T5', targetBlockId: blockC.id, top: '62%', left: '34%' },
            { id: 'hs-aerial-d', label: 'BLOC D · Studios & T3', targetBlockId: blockD.id, top: '62%', left: '68%' },
          ],
        },
        {
          id: 'view-facade',
          title: 'Architecture Extérieure & Jardins',
          subtitle: 'Matériaux durables, brise-soleil bioclimatiques et enduits minéraux',
          category: 'facade',
          imageUrl:
            'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=80',
          description:
            'Conception bioclimatique optimisée pour le climat côtier togolais. Façades ventilées, éclairage LED solaire et balcons suspendus.',
        },
        {
          id: 'view-amenities',
          title: 'Espaces Communs & Piscine Centrale',
          subtitle: 'Cadre de vie paisible et sécurisé pour toute la famille',
          category: 'amenities',
          imageUrl:
            'https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?auto=format&fit=crop&w=1600&q=80',
          description:
            'Piscine lagon, club-house, aires de jeux enfants et verdure paysagée entretenue avec récupération des eaux pluviales.',
        },
      ],
    },
  });

  // 4. Affectation de l'Artisan au Bloc C
  await prisma.artisanAssignment.create({
    data: {
      artisanId: artisanProfile.id,
      blockId: blockC.id,
      scope: 'Fondations et Gros Œuvre Bloc C',
    },
  });

  // 5. Inventaire multi-unités par bloc (vrais étages, statuts, prix seed)
  const blockInventory: Record<string, SeedUnit[]> = {
    [blockA.id]: [
      { type: UnitType.COMMERCE, floor: 1, status: UnitStatus.DISPONIBLE, surface: 70, hasStorefront: true, streetFacing: true },
      { type: UnitType.STUDIO, floor: 1, status: UnitStatus.DISPONIBLE, surface: 25 },
      { type: UnitType.STUDIO, floor: 2, status: UnitStatus.RESERVE, surface: 25 },
      { type: UnitType.T2, floor: 2, status: UnitStatus.DISPONIBLE, surface: 45 },
      { type: UnitType.T3, floor: 3, status: UnitStatus.DISPONIBLE, surface: 65 },
    ],
    [blockB.id]: [
      { type: UnitType.T2, floor: 1, status: UnitStatus.DISPONIBLE, surface: 45 },
      { type: UnitType.T2, floor: 1, status: UnitStatus.DISPONIBLE, surface: 45 },
      { type: UnitType.T3, floor: 2, status: UnitStatus.DISPONIBLE, surface: 65 },
      { type: UnitType.T2, floor: 3, status: UnitStatus.RESERVE, surface: 45 },
      { type: UnitType.T3, floor: 3, status: UnitStatus.DISPONIBLE, surface: 65 },
    ],
    [blockC.id]: [
      { type: UnitType.T2, floor: 1, status: UnitStatus.DISPONIBLE, surface: 45 },
      { type: UnitType.T3, floor: 2, status: UnitStatus.DISPONIBLE, surface: 65 },
      { type: UnitType.T5, floor: 3, status: UnitStatus.VENDU, surface: 100 },
    ],
    [blockD.id]: [
      { type: UnitType.STUDIO, floor: 1, status: UnitStatus.DISPONIBLE, surface: 25 },
      { type: UnitType.T2, floor: 2, status: UnitStatus.DISPONIBLE, surface: 45 },
      { type: UnitType.T3, floor: 3, status: UnitStatus.DISPONIBLE, surface: 65 },
    ],
  };

  const createdUnits: { id: string; type: UnitType; floor: number; blockId: string }[] = [];

  for (const [blockId, units] of Object.entries(blockInventory)) {
    for (const u of units) {
      const unit = await prisma.unit.create({
        data: {
          blockId,
          type: u.type,
          surface: u.surface,
          floor: u.floor,
          price: PRICE_XOF[u.type],
          status: u.status,
          hasStorefront: u.hasStorefront ?? false,
          streetFacing: u.streetFacing ?? false,
        },
      });
      createdUnits.push({ id: unit.id, type: u.type, floor: u.floor, blockId });
    }
  }

  console.log(`🏠 ${createdUnits.length} unités créées`);

  // 6. Médias des unités vitrines (PHOTO / PLAN / RENDU_3D).
  // RENDU_3D alimente automatiquement le badge "Vue d'artiste" côté catalogue.
  const showcaseTypes = new Set<UnitType>([UnitType.STUDIO, UnitType.T2, UnitType.T3, UnitType.T5, UnitType.COMMERCE]);
  for (const unit of createdUnits) {
    if (!showcaseTypes.has(unit.type)) continue;

    const photos = RENDER_PHOTOS[unit.type] ?? [];
    const mediaData: {
      unitId: string;
      type: MediaType;
      url: string;
      altText: string;
      sortOrder: number;
    }[] = photos.map((p, i) => ({
      unitId: unit.id,
      type: MediaType.PHOTO,
      url: p.url,
      altText: p.title,
      sortOrder: i,
    }));
    mediaData.push({
      unitId: unit.id,
      type: MediaType.PLAN,
      url: FLOOR_PLAN_2D,
      altText: `Plan 2D ${unit.type} · Étage ${unit.floor}`,
      sortOrder: mediaData.length,
    });
    if (unit.type === UnitType.T5) {
      mediaData.push({
        unitId: unit.id,
        type: MediaType.RENDU_3D,
        url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80',
        altText: "Rendu 3D Penthouse T5 — vue d'artiste",
        sortOrder: mediaData.length,
      });
    }
    await prisma.unitMedia.createMany({ data: mediaData });
  }

  // 7. Vente démo Bloc C — T5 avec offre personnalisée (dossier de financement honnête).
  const soldUnit = createdUnits.find((u) => u.type === UnitType.T5);
  if (!soldUnit) {
    throw new Error('Unit T5 introuvable dans l\'inventaire seed (Bloc C).');
  }

  const catalogPrice = PRICE_XOF[UnitType.T5];
  const offerPrice = 50_000_000; // offre à 50M vs 55M catalogue
  const reservation = await prisma.reservation.create({
    data: {
      unitId: soldUnit.id,
      userId: buyerUser.id,
      status: ReservationStatus.CONFIRMEE,
      lockExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      offerPrice,
      offerLabel: 'Offre de lancement — phase 1',
      paymentSchedule: {
        create: {
          totalAmount: offerPrice,
          currency: 'XOF',
          installments: {
            create: INSTALLMENT_PLAN.map((t, i) => ({
              label: t.label,
              amount: Math.round(offerPrice * t.percent),
              dueDate: new Date(Date.now() + t.daysOffset * 24 * 60 * 60 * 1000),
              status: i === 0 ? InstallmentStatus.PAYE : InstallmentStatus.EN_ATTENTE,
              paidAt: i === 0 ? new Date() : null,
            })),
          },
        },
      },
    },
  });

  console.log(
    `💼 Vente démo : T5 Bloc C vendu à ${offerPrice} XOF (catalogue ${catalogPrice}) — réservation ${reservation.id}`,
  );

  // 8. Places de parking
  await prisma.parkingSpot.createMany({
    data: [
      { blockId: blockA.id, numero: 'PK-A-01', type: ParkingType.SOUS_PILOTIS },
      { blockId: blockA.id, numero: 'PK-A-02', type: ParkingType.SOUS_PILOTIS },
      { numero: 'PK-SOL-01', type: ParkingType.AUVENT_SOLAIRE },
      { numero: 'PK-SOL-02', type: ParkingType.AUVENT_SOLAIRE },
    ],
  });

  console.log('🎉 Seed de la base de données terminé avec succès !');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
