import React from 'react';
import { WhatsAppWidget } from '../../customer/components/WhatsAppWidget/WhatsAppWidget';
import { MainMenu } from '../../customer/sections/MainMenu/MainMenu';
import { MainHero } from '../../customer/sections/MainHero/MainHero';
import { MainHeroCarousel } from '../../customer/sections/MainHeroCarousel/MainHeroCarousel';
import { MultiCardFeature } from '../../customer/sections/MultiCardFeature/MultiCardFeature';
import { StepsFeature } from '../../customer/sections/StepsFeature/StepsFeature';
import { FeatureFullImage } from '../../customer/sections/FeatureFullImage/FeatureFullImage';
import { FeatureSquareImage } from '../../customer/sections/FeatureSquareImage/FeatureSquareImage';
import { FeaturePillImage } from '../../customer/sections/FeaturePillImage/FeaturePillImage';
import { Gallery } from '../../customer/sections/Gallery/Gallery';
import { StructuredGallery } from '../../customer/sections/StructuredGallery/StructuredGallery';
import { Footer } from '../../customer/sections/Footer/Footer';
import { CustomerProfile } from '../../customer/sections/CustomerProfile/CustomerProfile';
import { CustomerOrder } from '../../customer/sections/CustomerOrder/CustomerOrder';
import { CustomerCart } from '../../customer/sections/CustomerCart/CustomerCart';
import { CustomerCheckout } from '../../customer/sections/CustomerCheckout/CustomerCheckout';
import { ProteinShakes } from '../../customer/sections/ProteinShakes/ProteinShakes';
import { BlogGrid } from '../../customer/sections/BlogGrid/BlogGrid';
import { BlogPage } from '../../customer/sections/BlogPage/BlogPage';
import { Objectives } from '../../customer/sections/Objectives/Objectives';
import { FAQ } from '../../customer/sections/FAQ/FAQ';
import { TitleBlock } from '../../customer/sections/TitleBlock/TitleBlock';

export interface Module {
  id: string;
  type: string;
  content: any;
}

interface CMSRendererProps {
  modules: Module[];
  basePath?: string; // '/shop' for customer app, '/preview' for preview
}

export const CMSRenderer: React.FC<CMSRendererProps> = ({ modules, basePath = '' }) => {
  console.log('[CMSRenderer] Rendering', modules.length, 'modules');
  console.log('[CMSRenderer] Module types:', modules.map(m => m.type));

  const renderModule = (module: Module) => {
    const { type, content } = module;
    console.log('[CMSRenderer] Rendering module:', type);

    // Override navigation for customer routes
    if (type === 'MainMenu') {
      const updatedContent = {
        ...content,
        basePath,
        navigationItems: basePath && content.navigationItems
          ? content.navigationItems.map((item: any) => ({
              ...item,
              href: item.href.startsWith('/') ? `${basePath}${item.href}` : item.href
            }))
          : content.navigationItems
      };
      return <MainMenu key={module.id} {...updatedContent} />;
    }

    switch (type) {
      case 'MainHero':
        return <MainHero key={module.id} {...content} />;
      case 'MainHeroCarousel':
        return <MainHeroCarousel key={module.id} {...content} />;
      case 'MultiCardFeature':
        return <MultiCardFeature key={module.id} {...content} />;
      case 'StepsFeature':
        return <StepsFeature key={module.id} {...content} />;
      case 'FeatureFullImage':
        return <FeatureFullImage key={module.id} {...content} />;
      case 'FeatureSquareImage':
        return <FeatureSquareImage key={module.id} {...content} />;
      case 'FeaturePillImage':
        return <FeaturePillImage key={module.id} {...content} />;
      case 'Gallery':
        return <Gallery key={module.id} {...content} />;
      case 'StructuredGallery':
        return <StructuredGallery key={module.id} {...content} />;
      case 'CustomerProfile':
        return <CustomerProfile key={module.id} />;
      case 'CustomerOrder':
        return <CustomerOrder key={module.id} />;
      case 'CustomerCart':
        return <CustomerCart key={module.id} />;
      case 'CustomerCheckout':
        return <CustomerCheckout key={module.id} />;
      case 'ProteinShakes':
        return <ProteinShakes key={module.id} />;
      case 'BlogGrid':
        return <BlogGrid key={module.id} {...content} basePath={basePath} />;
      case 'BlogPage':
        return <BlogPage key={module.id} {...content} basePath={basePath} />;
      case 'Objectives':
        return <Objectives key={module.id} {...content} />;
      case 'FAQ':
        return <FAQ key={module.id} {...content} />;
      case 'TitleBlock':
        return <TitleBlock key={module.id} {...content} />;
      case 'Footer':
        return <Footer key={module.id} {...content} />;
      default:
        console.warn(`Unknown module type: ${type}`);
        return null;
    }
  };

  return (
    <div className="bg-white">
      {modules.map((module, index) => (
        <React.Fragment key={module.id}>
          {renderModule(module)}
          {/* Add spacing between modules, except for MainMenu and Footer */}
          {index < modules.length - 1 &&
           module.type !== 'MainMenu' &&
           modules[index + 1]?.type !== 'Footer' && (
            <div style={{ height: '5px' }}></div>
          )}
          {/* Special spacing after MainMenu */}
          {module.type === 'MainMenu' && index < modules.length - 1 && (
            <div style={{ height: '10px' }}></div>
          )}
        </React.Fragment>
      ))}
      <WhatsAppWidget />
    </div>
  );
};
