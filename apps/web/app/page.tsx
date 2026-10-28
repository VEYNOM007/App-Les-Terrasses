import React from 'react';
import Navbar from '../components/Navbar';
import MarketStudyBanner from '../components/MarketStudyBanner';
import Hero from '../components/Hero';
import ProjectShowcase from '../components/ProjectShowcase';
import Mechanism from '../components/Mechanism';
import CatalogGrid from '../components/CatalogGrid';
import SurveyCta from '../components/SurveyCta';
import Footer from '../components/Footer';

export default function Home() {
  return (
    <main className="min-h-screen bg-cream text-body">
      <Navbar />
      <MarketStudyBanner />
      <Hero />
      <ProjectShowcase />
      <Mechanism />
      <CatalogGrid />
      <SurveyCta />
      <Footer />
    </main>
  );
}
