import React, { useState } from 'react';
import { Button } from '../../components/ui/button';
import { CMSContent } from '../../types';
import { resolveImageUrl } from '../../../utils/imageHelper';

interface MainHeroProps extends CMSContent {
  leftBackgroundColor?: string;
  rightBackgroundImage?: string;
}

export const MainHero: React.FC<MainHeroProps> = ({
  title = "COME SANO, AHORRA TIEMPO Y ALCANZA TUS METAS SIN COCINAR",
  description = "Sabemos que estás cansado de cocinar y repetir siempre lo mismo. Con Hola Dieta comes delicioso, cuidas tu salud y te olvidas del estrés de planear.",
  buttonText = "SELECCIONA TU PLAN",
  buttonLink = "",
  leftBackgroundColor = "#ffcfe3",
  rightBackgroundImage = "/rectangle-1.png"
}) => {
  const [imageError, setImageError] = useState(false);
  const heroImageUrl = resolveImageUrl(rightBackgroundImage);

  return (
    <section className="w-full relative">
      {/* Desktop Background Layers - Full Width */}
      <div className="hidden md:block absolute inset-0 w-1/2 rounded-[45px_0px_0px_45px]" style={{ backgroundColor: leftBackgroundColor }} />
      {heroImageUrl && !imageError ? (
        <div className="hidden md:block absolute inset-0 left-1/2 w-1/2 rounded-[0px_45px_45px_0px] overflow-hidden">
          <img
            src={heroImageUrl}
            alt="Hero background"
            className="w-full h-full object-cover object-center"
            onError={() => setImageError(true)}
          />
        </div>
      ) : (
        <div className="hidden md:block absolute inset-0 left-1/2 w-1/2 rounded-[0px_45px_45px_0px]" style={{ backgroundColor: leftBackgroundColor }} />
      )}

      <div className="relative z-10 max-w-[1440px] mx-auto flex flex-col md:flex-row md:h-[712px]">
        <div className="w-full md:w-1/2 flex flex-col justify-center px-16 md:px-12 lg:px-20 py-6 md:py-0 rounded-t-[45px] md:rounded-none" style={{ backgroundColor: leftBackgroundColor }}>
          <div className="max-w-lg mx-auto md:mx-0 text-center md:text-left">
            <h1 className="[font-family:'Antonio',Helvetica] font-bold text-[#1e1e1e] text-2xl sm:text-3xl md:text-4xl lg:text-5xl tracking-[-0.25px] leading-tight mb-4 md:mb-8">
              {title}
            </h1>

            <p className="[font-family:'Inria_Serif',Helvetica] font-normal text-[#1e1e1e] text-base sm:text-lg md:text-lg lg:text-xl leading-6 sm:leading-7 md:leading-7 tracking-[-0.25px] mb-4 md:mb-12">
              {description}
            </p>

            {buttonText && (buttonLink ? (
              <a
                href={buttonLink}
                target={buttonLink.startsWith('http') ? '_blank' : undefined}
                rel={buttonLink.startsWith('http') ? 'noopener noreferrer' : undefined}
                className="inline-flex items-center justify-center h-auto bg-[#e9ff93] rounded-[100px] border border-solid border-black text-black text-base sm:text-lg md:text-lg lg:text-xl [font-family:'Chivo',Helvetica] font-normal px-6 sm:px-8 md:px-[30px] py-3 sm:py-4 md:py-[15px] hover:bg-[#d4e87a] active:scale-95 transition-all duration-200 mb-4 md:mb-0 no-underline cursor-pointer select-none"
              >
                {buttonText}
              </a>
            ) : (
              <Button className="h-auto bg-[#e9ff93] rounded-[100px] border border-solid border-black text-black text-base sm:text-lg md:text-lg lg:text-xl [font-family:'Chivo',Helvetica] font-normal px-6 sm:px-8 md:px-[30px] py-3 sm:py-4 md:py-[15px] hover:bg-[#d4e87a] active:scale-95 transition-all duration-200 mb-4 md:mb-0">
                {buttonText}
              </Button>
            ))}
          </div>
        </div>

        {/* Right Image Section */}
        <div className="w-full md:w-1/2 h-80 md:h-[712px] relative md:bg-none rounded-b-[45px] md:rounded-none overflow-hidden">
          {heroImageUrl && !imageError ? (
            <img
              src={heroImageUrl}
              alt="Hero"
              className="w-full h-full object-cover object-center md:hidden rounded-b-[45px]"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full md:hidden rounded-b-[45px]" style={{ backgroundColor: leftBackgroundColor }} />
          )}
        </div>
      </div>
    </section>
  );
};