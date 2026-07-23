'use client';

import React, { useState } from 'react';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import Mechanism from '../components/Mechanism';
import MasterPlanInteractive from '../components/MasterPlanInteractive';
import CatalogGrid, { UnitTypology } from '../components/CatalogGrid';
import ReservationModal from '../components/ReservationModal';
import LeadForm from '../components/LeadForm';
import Footer from '../components/Footer';

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTypology, setSelectedTypology] = useState<UnitTypology | null>(null);

  const handleSelectUnit = (typology: UnitTypology) => {
    setSelectedTypology(typology);
    setIsModalOpen(true);
  };

  const handleSelectBlock = (blockId: string) => {
    setIsModalOpen(true);
  };

  return (
    <main className="min-h-screen bg-ink text-paper selection:bg-laterite selection:text-paper">
      <Navbar />
      <Hero />
      <Mechanism />
      <MasterPlanInteractive onSelectBlock={handleSelectBlock} />
      <CatalogGrid onSelectUnit={handleSelectUnit} />
      <LeadForm />
      <Footer />

      <ReservationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        selectedTypology={selectedTypology}
      />
    </main>
  );
}
