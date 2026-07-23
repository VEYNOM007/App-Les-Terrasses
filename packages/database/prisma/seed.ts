import { PrismaClient, UserRole, ProjectStatus, UnitType, Frontage, UnitStatus, LaunchStatus, ParkingType, ArtisanTrade } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Démarrage du seed de la base de données Résidence Catalog...');

  // 1. Création des utilisateurs démo
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@terrasses-baguida.tg' },
    update: {},
    create: {
      email: 'admin@terrasses-baguida.tg',
      phone: '+22890000001',
      fullName: 'Administrateur Promotion',
      passwordHash: '$2b$10$e8K7b...demo', // hash démo
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

  // Profil Artisan
  const artisanProfile = await prisma.artisan.upsert({
    where: { userId: artisanUser.id },
    update: {},
    create: {
      userId: artisanUser.id,
      companyName: 'Amouzou Maçonnerie & Gros Œuvre SARL',
      trade: ArtisanTrade.MACONNERIE,
    },
  });

  // 2. Création du projet "Les Terrasses de Baguida"
  const project = await prisma.project.create({
    data: {
      name: 'Les Terrasses de Baguida',
      description: 'Studios, T2, T3 et T5 en résidence fermée sécurisée avec façade commerciale et auvents solaires à Baguida, Lomé.',
      location: 'Baguida, Lomé (Titre Foncier RM 100/71)',
      amenities: ['gardiennage', 'aire_de_jeux', 'auvents_solaires', 'parking_pilotis'],
      status: ProjectStatus.PUBLIE,
      siteMapImageUrl: '/images/site-plan-rm10071.png',
    },
  });

  console.log(`🏢 Projet créé : ${project.name} (ID: ${project.id})`);

  // 3. Création des 4 blocs principaux
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

  // 4. Affectation de l'Artisan au Bloc C
  await prisma.artisanAssignment.create({
    data: {
      artisanId: artisanProfile.id,
      blockId: blockC.id,
      scope: 'Fondations et Gros Œuvre Bloc C',
    },
  });

  // 5. Création de quelques unités types
  await prisma.unit.createMany({
    data: [
      { blockId: blockA.id, type: UnitType.STUDIO, surface: 25, floor: 1, price: 15000000, status: UnitStatus.DISPONIBLE },
      { blockId: blockA.id, type: UnitType.T2, surface: 45, floor: 2, price: 24000000, status: UnitStatus.DISPONIBLE },
      { blockId: blockA.id, type: UnitType.T3, surface: 65, floor: 3, price: 35000000, status: UnitStatus.RESERVE },
      { blockId: blockC.id, type: UnitType.T5, surface: 100, floor: 3, price: 55000000, status: UnitStatus.VENDU },
    ],
  });

  // 6. Création des places de parking
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
