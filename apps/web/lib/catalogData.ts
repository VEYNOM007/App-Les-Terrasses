export interface ComplexView {
  id: string;
  title: string;
  subtitle: string;
  category: 'masterplan' | 'aerial' | 'facade' | 'garden' | 'amenities';
  imageUrl: string;
  description: string;
  hotspots?: {
    id: string;
    label: string;
    targetBlockId: string;
    top: string; // percentage
    left: string; // percentage
  }[];
}

export interface UnitFinishingOption {
  id: string;
  category: 'carrelage' | 'cuisine' | 'solaire' | 'domotique';
  name: string;
  description: string;
  priceDeltaXOF: number;
  previewColor?: string;
  previewImage?: string;
  isDefault?: boolean;
}

export interface TechnicalSpec {
  category: string;
  items: { label: string; detail: string }[];
}

export interface Unit3DDetails {
  id: string;
  name: string;
  type: 'STUDIO' | 'T2' | 'T3' | 'T5' | 'COMMERCE';
  blockId: string;
  blockName: string;
  floor: string;
  surfaceHabitableM2: number;
  surfaceTerrasseM2: number;
  surfaceTotaleM2: number;
  ceilingHeightM: number;
  orientation: string;
  startingPriceXOF: number;
  startingPriceFormatted: string;
  availableUnitsCount: number;
  totalUnitsCount: number;
  badge?: string;
  description: string;
  keyFeatures: string[];
  
  // 3D & Gallery assets
  renderPhotos: {
    title: string;
    url: string;
    angle: 'séjour' | 'chambre' | 'cuisine' | 'salle_d_eau' | 'terrasse' | 'exterieur';
  }[];
  floorPlan2DUrl: string;
  floorPlan3DUrl?: string;
  virtualTour3DUrl?: string; // Matterport / Sketchfab embed link

  // VEFA Specs
  technicalSpecs: TechnicalSpec[];
  finishingOptions: UnitFinishingOption[];

  // Investment simulation defaults
  estimatedMonthlyRentXOF: number;
  estimatedNetYieldAnnual: number;
}

export interface ComplexInfo {
  name: string;
  location: string;
  titleDeed: string;
  totalLandArea: string;
  deliveryDate: string;
  notaryName: string;
  escrowBank: string;
  views: ComplexView[];
  units: Unit3DDetails[];
}

export const DEFAULT_COMPLEX_DATA: ComplexInfo = {
  name: "Résidence Les Terrasses · Baguida",
  location: "Baguida, Lomé - Togo (à 5 min du Littoral)",
  titleDeed: "RM 100/71 (Titre Foncier Définitif et Libéré)",
  totalLandArea: "6 593 m²",
  deliveryDate: "Trimestre 4 - 2026",
  notaryName: "Étude Maître K. Lawson & Associés (Notaire Agréé)",
  escrowBank: "Compte Séquestre Garantia - Ecobank / Coris Bank",
  views: [
    {
      id: 'view-masterplan',
      title: 'Plan de Masse Officiel',
      subtitle: 'Plan Cadastral & Découpe des Blocs (Titre Foncier RM 100/71)',
      category: 'masterplan',
      imageUrl: '/masterplan-les-terrasses.jpg',
      description: 'Plan de masse vectoriel officiel à l\'échelle 1/500. Cliquez sur les Blocs Nord 1 & 2, Blocs Sud 1 & 2 ou Boutiques pour explorer les appartements.',
      hotspots: [
        { id: 'hs-mp-nord-1', label: 'BLOC NORD 1 · Studios & T2', targetBlockId: 'unit-studio', top: '30%', left: '35%' },
        { id: 'hs-mp-nord-2', label: 'BLOC NORD 2 · T2 Spacieux', targetBlockId: 'unit-t2', top: '30%', left: '65%' },
        { id: 'hs-mp-sud-1', label: 'BLOC SUD 1 · T3 Familial', targetBlockId: 'unit-t3', top: '65%', left: '35%' },
        { id: 'hs-mp-sud-2', label: 'BLOC SUD 2 · Penthouse T5', targetBlockId: 'unit-t5', top: '65%', left: '65%' },
        { id: 'hs-mp-commerce', label: 'Façade Boutiques Nord', targetBlockId: 'unit-commerce', top: '15%', left: '50%' },
      ],
    },
    {
      id: 'view-aerial',
      title: 'Vue Aérienne HD du Complexe',
      subtitle: 'Vue Rendu Photoréaliste Haute Définition · Baguida',
      category: 'aerial',
      imageUrl: '/masterplan-les-terrasses.jpg',
      description: 'Vue aérienne officielle. Survolez et cliquez sur les boutons interactifs placés sur les bâtiments pour réserver votre bien.',
      hotspots: [
        { id: 'hs-aerial-nord-1', label: 'BLOC NORD 1 · Studios & T2', targetBlockId: 'unit-studio', top: '31%', left: '38%' },
        { id: 'hs-aerial-nord-2', label: 'BLOC NORD 2 · T2 Spacieux', targetBlockId: 'unit-t2', top: '31%', left: '68%' },
        { id: 'hs-aerial-sud-1', label: 'BLOC SUD 1 · T3 Familial', targetBlockId: 'unit-t3', top: '62%', left: '34%' },
        { id: 'hs-aerial-sud-2', label: 'BLOC SUD 2 · Penthouse T5', targetBlockId: 'unit-t5', top: '62%', left: '68%' },
        { id: 'hs-aerial-commerce', label: 'Façade Boutiques Nord', targetBlockId: 'unit-commerce', top: '14%', left: '50%' },
      ],
    },
    {
      id: 'view-facade',
      title: 'Architecture Extérieure & Jardins',
      subtitle: 'Matériaux durables, brise-soleil bioclimatiques et enduits minéraux',
      category: 'facade',
      imageUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=80',
      description: 'Conception bioclimatique optimisée pour le climat côtier togolais. Façades ventilées, éclairage LED solaire et balcons suspendus.',
    },
    {
      id: 'view-amenities',
      title: 'Espaces Communs & Piscine Centrale',
      subtitle: 'Cadre de vie paisible et sécurisé pour toute la famille',
      category: 'amenities',
      imageUrl: 'https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?auto=format&fit=crop&w=1600&q=80',
      description: 'Piscine lagon, club-house, aires de jeux enfants et verdure paysagée entretenue avec récupération des eaux pluviales.',
    },
  ],
  units: [
    {
      id: 'unit-studio',
      name: 'Studio Design & Lumineux',
      type: 'STUDIO',
      blockId: 'block-a',
      blockName: 'Bloc A - Étage 1 à 3',
      floor: 'Étage 1 / 2 / 3',
      surfaceHabitableM2: 25,
      surfaceTerrasseM2: 5,
      surfaceTotaleM2: 30,
      ceilingHeightM: 2.8,
      orientation: 'Sud-Est (Brise marine)',
      startingPriceXOF: 18500000,
      startingPriceFormatted: '18 500 000 FCFA',
      availableUnitsCount: 14,
      totalUnitsCount: 20,
      badge: 'Idéal Rendement Locatif',
      description: 'Studio intelligemment conçu avec kitchenette équipée, salle d\'eau aux normes internationales et balcon privatif donnant sur le jardin intérieur.',
      keyFeatures: [
        'Cuisine américaine équipée',
        'Balcon privatif 5m²',
        'Accès sécurisé par badge & digicode',
        'Emplacement parking pilotis inclus'
      ],
      renderPhotos: [
        {
          title: 'Séjour & Coin Nuit 3D',
          url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80',
          angle: 'séjour'
        },
        {
          title: 'Kitchenette & Plan de travail',
          url: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=1200&q=80',
          angle: 'cuisine'
        },
        {
          title: 'Salle d\'eau à l\'italienne',
          url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&q=80',
          angle: 'salle_d_eau'
        },
        {
          title: 'Balcon extérieur',
          url: 'https://images.unsplash.com/photo-1512915922686-57c11dde9b6b?auto=format&fit=crop&w=1200&q=80',
          angle: 'terrasse'
        }
      ],
      floorPlan2DUrl: 'https://images.unsplash.com/photo-1600585152220-90363fe7e115?auto=format&fit=crop&w=1200&q=80',
      technicalSpecs: [
        {
          category: 'Gros Œuvre & Maçonnerie',
          items: [
            { label: 'Murs extérieurs', detail: 'Briques creuses comprimées isolantes (20cm) + enduit lissé' },
            { label: 'Planchers', detail: 'Dalle béton armé avec isolation phonique sous carrelage' }
          ]
        },
        {
          category: 'Revêtements & Menuiseries',
          items: [
            { label: 'Sol principal', detail: 'Grès cérame émaillé 60x60 cm antidérapant R10' },
            { label: 'Fenêtres & Baies', detail: 'Aluminium thermo-laqué noir double vitrage 4/12/4' },
            { label: 'Porte d\'entrée', detail: 'Porte blindée 5 points avec serrure haute sécurité' }
          ]
        },
        {
          category: 'Électricité & Énergie',
          items: [
            { label: 'Alimentation', detail: 'Comptage Schneider triphasé pré-câblé' },
            { label: 'Secours Solaire', detail: 'Inverseur automatique relié à la centrale solaire de la résidence' }
          ]
        }
      ],
      finishingOptions: [
        { id: 'fin-tile-1', category: 'carrelage', name: 'Grès Cérame Beige Sand (Standard)', description: 'Teinte chaude minérale naturelle', priceDeltaXOF: 0, previewColor: '#D8C9A3', isDefault: true },
        { id: 'fin-tile-2', category: 'carrelage', name: 'Grès Cérame Gris Scandinave', description: 'Look contemporain béton ciré', priceDeltaXOF: 250000, previewColor: '#8C9BAB' },
        { id: 'fin-kitchen-1', category: 'cuisine', name: 'Cuisine Aménagée Bois Flotté', description: 'Meubles hauts/bas + plan de travail stratifié haute résistance', priceDeltaXOF: 0, isDefault: true },
        { id: 'fin-kitchen-2', category: 'cuisine', name: 'Cuisine Premium Quartz Blanc', description: 'Plan de travail en quartz reconstitué + crédence miroir', priceDeltaXOF: 650000 },
        { id: 'fin-solar-1', category: 'solaire', name: 'Pack Énergie Solaire Hybride 2.5 kVA', description: 'Panneaux sur toit + batterie Lithium pour 100% d\'autonomie clim/frigo en coupure', priceDeltaXOF: 1800000 }
      ],
      estimatedMonthlyRentXOF: 180000,
      estimatedNetYieldAnnual: 11.2
    },
    {
      id: 'unit-t2',
      name: 'Appartement T2 Spacieux',
      type: 'T2',
      blockId: 'block-a',
      blockName: 'Bloc A - Étage 1 à 4',
      floor: 'Étage 1 / 2 / 3 / 4',
      surfaceHabitableM2: 45,
      surfaceTerrasseM2: 8,
      surfaceTotaleM2: 53,
      ceilingHeightM: 2.8,
      orientation: 'Double exposition Est / Ouest',
      startingPriceXOF: 29500000,
      startingPriceFormatted: '29 500 000 FCFA',
      availableUnitsCount: 22,
      totalUnitsCount: 30,
      badge: 'Coup de Cœur',
      description: 'Superbe T2 comprenant un grand séjour traversant, une chambre séparée avec dressing intégré, et un grand balcon idéal pour les repas en extérieur.',
      keyFeatures: [
        'Chambre indépendante avec dressing',
        'Grand séjour baigné de lumière',
        'Terrasse 8m² vue sur piscine',
        'Place de parking dédiée'
      ],
      renderPhotos: [
        {
          title: 'Séjour & Espace Repas',
          url: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1200&q=80',
          angle: 'séjour'
        },
        {
          title: 'Chambre Principale',
          url: 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&q=80',
          angle: 'chambre'
        },
        {
          title: 'Cuisine équipée ouverte',
          url: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=1200&q=80',
          angle: 'cuisine'
        },
        {
          title: 'Terrasse & Vue jardin',
          url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
          angle: 'terrasse'
        }
      ],
      floorPlan2DUrl: 'https://images.unsplash.com/photo-1600585152220-90363fe7e115?auto=format&fit=crop&w=1200&q=80',
      technicalSpecs: [
        {
          category: 'Gros Œuvre & Structure',
          items: [
            { label: 'Structure', detail: 'Poteaux-poutres en béton armé haute résistance aux normes parasismiques' },
            { label: 'Étanchéité', detail: 'Traitement bicouche élastomère sous terrasses et pièces humides' }
          ]
        },
        {
          category: 'Sanitaires & Plomberie',
          items: [
            { label: 'Robinetterie', detail: 'Mitigeurs thermostatiques Grohe / Roca garants d\'économies d\'eau' },
            { label: 'Chauffe-eau', detail: 'Chauffe-eau solaire individuel 150L sur toit' }
          ]
        }
      ],
      finishingOptions: [
        { id: 'fin-t2-tile-1', category: 'carrelage', name: 'Grès Cérame Beige Sand', description: 'Teinte naturelle warm', priceDeltaXOF: 0, previewColor: '#D8C9A3', isDefault: true },
        { id: 'fin-t2-tile-2', category: 'carrelage', name: 'Grès Cérame Effet Parquet Chêne', description: 'Lames grand format aspect bois naturel', priceDeltaXOF: 450000, previewColor: '#B57E49' },
        { id: 'fin-t2-clim-1', category: 'solaire', name: 'Pack Bi-Split Climatisation Inverter', description: '2 unités intérieures A+++ à faible consommation', priceDeltaXOF: 950000 }
      ],
      estimatedMonthlyRentXOF: 280000,
      estimatedNetYieldAnnual: 10.8
    },
    {
      id: 'unit-t3',
      name: 'Appartement T3 Familial & Suite',
      type: 'T3',
      blockId: 'block-b',
      blockName: 'Bloc B - Étage 1 à 4',
      floor: 'Étage 1 / 2 / 3 / 4',
      surfaceHabitableM2: 65,
      surfaceTerrasseM2: 12,
      surfaceTotaleM2: 77,
      ceilingHeightM: 2.85,
      orientation: 'Orienté Plein Sud vers lagon',
      startingPriceXOF: 44500000,
      startingPriceFormatted: '44 500 000 FCFA',
      availableUnitsCount: 18,
      totalUnitsCount: 25,
      badge: 'Le Plus Mandaté',
      description: 'Appartement 3 pièces comprenant une suite parentale avec salle d\'eau dédiée, une 2e chambre spacieuse, un grand salon et une terrasse traversante couverte.',
      keyFeatures: [
        'Suite parentale avec SDB privative',
        '2ème chambre avec placard mural',
        'Grand séjour avec baie vitrée coulissante 3 battants',
        'Terrasse 12m² avec brise-soleil',
        'Parking sous-sol réservé'
      ],
      renderPhotos: [
        {
          title: 'Grand Séjour Familial',
          url: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=80',
          angle: 'séjour'
        },
        {
          title: 'Suite Parentale',
          url: 'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=1200&q=80',
          angle: 'chambre'
        },
        {
          title: 'Salle d\'eau Italienne & Marbre',
          url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&q=80',
          angle: 'salle_d_eau'
        },
        {
          title: 'Vue Façade & Terrasse',
          url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
          angle: 'terrasse'
        }
      ],
      floorPlan2DUrl: 'https://images.unsplash.com/photo-1600585152220-90363fe7e115?auto=format&fit=crop&w=1200&q=80',
      technicalSpecs: [
        {
          category: 'Confort & Domotique',
          items: [
            { label: 'Visiophone', detail: 'Écran tactile couleur IP connecté au smartphone' },
            { label: 'Fibre Optique', detail: 'Prise RJ45 pré-câblée dans chaque pièce' }
          ]
        }
      ],
      finishingOptions: [
        { id: 'fin-t3-tile-1', category: 'carrelage', name: 'Grès Cérame Sand Standard', description: 'Teinte claire élégante', priceDeltaXOF: 0, isDefault: true },
        { id: 'fin-t3-pack-1', category: 'domotique', name: 'Pack Domotique Intelligente', description: 'Contrôle à distance des lumières, de la clim et alarme via application mobile', priceDeltaXOF: 750000 }
      ],
      estimatedMonthlyRentXOF: 420000,
      estimatedNetYieldAnnual: 10.5
    },
    {
      id: 'unit-t5',
      name: 'Penthouse T5 Prestige · Dernier Étage',
      type: 'T5',
      blockId: 'block-c',
      blockName: 'Bloc C & D - Étage Attique 5',
      floor: 'Attique (Étage 5)',
      surfaceHabitableM2: 105,
      surfaceTerrasseM2: 35,
      surfaceTotaleM2: 140,
      ceilingHeightM: 3.1,
      orientation: 'Triple exposition & Vue panoramique Mer',
      startingPriceXOF: 78000000,
      startingPriceFormatted: '78 000 000 FCFA',
      availableUnitsCount: 6,
      totalUnitsCount: 8,
      badge: 'Édition Limité Attique',
      description: 'L\'excellence au sommet de la résidence. 4 chambres, immense terrasse solarium de 35m², pièces de vie aux volumes généreux (hauteur 3.10m) et vue mer dégagée.',
      keyFeatures: [
        '4 chambres dont 2 suites parentales',
        'Terrasse solarium 35m² avec espace BBQ',
        'Accès ascenseur privatif par clé',
        '2 places de parking sous-sol incluses'
      ],
      renderPhotos: [
        {
          title: 'Séjour Cathédrale & Baies Vitrées',
          url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80',
          angle: 'séjour'
        },
        {
          title: 'Master Suite Parentale Vue Panoramique',
          url: 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&q=80',
          angle: 'chambre'
        },
        {
          title: 'Terrasse Solarium 35m²',
          url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
          angle: 'terrasse'
        }
      ],
      floorPlan2DUrl: 'https://images.unsplash.com/photo-1600585152220-90363fe7e115?auto=format&fit=crop&w=1200&q=80',
      technicalSpecs: [
        {
          category: 'Prestations d\'Exception',
          items: [
            { label: 'Climatisation', detail: 'Centrale VRV Daikin encastrée à régulation par pièce' },
            { label: 'Solarium', detail: 'Carrelage antidérapant imitation teck + attentes Jacuzzi' }
          ]
        }
      ],
      finishingOptions: [
        { id: 'fin-t5-jacuzzi', category: 'domotique', name: 'Option Spa Jacuzzi sur Terrasse', description: 'Installation complète spa 4 places avec bulles massantes et chromothérapie', priceDeltaXOF: 4500000 }
      ],
      estimatedMonthlyRentXOF: 750000,
      estimatedNetYieldAnnual: 10.2
    },
    {
      id: 'unit-commerce',
      name: 'Local Commercial Façade Nord',
      type: 'COMMERCE',
      blockId: 'commerce',
      blockName: 'Façade Nord - Rez-de-Chaussée',
      floor: 'Rez-de-chaussée sur rue',
      surfaceHabitableM2: 60,
      surfaceTerrasseM2: 10,
      surfaceTotaleM2: 70,
      ceilingHeightM: 3.5,
      orientation: 'Plein Nord avec vitrine sur grand axe',
      startingPriceXOF: 38000000,
      startingPriceFormatted: '38 000 000 FCFA',
      availableUnitsCount: 4,
      totalUnitsCount: 6,
      badge: 'Emplacement N°1',
      description: 'Local commercial brut de béton avec vitrine aluminium posée. Emplacement hautement stratégique pour pharmacie, cabinet médical, superette de proximité ou banque.',
      keyFeatures: [
        'Grande vitrine 6 mètres sur rue',
        'Hauteur sous plafond 3.50m',
        'Accès livraison arrière dédié',
        'Extraction pour restauration légère'
      ],
      renderPhotos: [
        {
          title: 'Vitrine Commerciale sur Rue',
          url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80',
          angle: 'exterieur'
        }
      ],
      floorPlan2DUrl: 'https://images.unsplash.com/photo-1600585152220-90363fe7e115?auto=format&fit=crop&w=1200&q=80',
      technicalSpecs: [
        {
          category: 'Livraison Commerciale',
          items: [
            { label: 'Finition', detail: 'Brut de béton avec fluide en attente (eau, électricité 380V, télécom)' }
          ]
        }
      ],
      finishingOptions: [],
      estimatedMonthlyRentXOF: 400000,
      estimatedNetYieldAnnual: 12.6
    }
  ]
};

const STORAGE_KEY = 'les_terrasses_catalog_custom_v1';

export function getCatalogData(): ComplexInfo {
  if (typeof window === 'undefined') return DEFAULT_COMPLEX_DATA;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Error loading stored catalog data:', e);
  }
  return DEFAULT_COMPLEX_DATA;
}

export function saveCatalogData(data: ComplexInfo): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Error saving catalog data:', e);
  }
}
