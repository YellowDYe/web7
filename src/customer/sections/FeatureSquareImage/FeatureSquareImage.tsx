import React, { useState } from 'react';
import { Benefit } from '../../types';
import { resolveImageUrl } from '../../../utils/imageHelper';

interface FeatureSquareImageProps {
  title?: string;
  benefits?: Benefit[];
  leftImage?: string;
  rightBackgroundColor?: string;
}

export const FeatureSquareImage: React.FC<FeatureSquareImageProps> = ({
  title = "BENEFICIOS",
  leftImage = "/rectangle.png",
  rightBackgroundColor = "#e9ff93",
  benefits = [
    {
      id: "tiempo",
      title: "Más tiempo para ti",
      description: "Olvídate de cocinar y lavar, la comida llega lista para calentar.",
      highlighted: true
    },
    {
      id: "comida",
      title: "Comida rica y saludable",
      description: "Platillos variados que te ayudan a bajar de peso y mantener energía.",
      highlighted: true
    },
    {
      id: "flexibilidad",
      title: "Flexibilidad total",
      description: "Pausa tu plan, ajusta por alergias o elige el menú que mejor se adapte a ti.",
      highlighted: true
    }
  ]
}) => {
  const [imageError, setImageError] = useState(false);
  const imageUrl = resolveImageUrl(leftImage);

  return (
    <section className="w-full py-8 md:py-16">
      <div className="w-full max-w-7xl mx-auto px-8">
        {/* Mobile: Content first, then image */}
        <div className="flex flex-col md:flex-row gap-8">
          {/* Content - shows first on mobile, second on desktop */}
          <div className="w-full md:w-1/2 rounded-[45px] flex flex-col justify-center p-6 md:p-8 lg:p-16 order-1 md:order-2" style={{ backgroundColor: rightBackgroundColor }}>
            <div className="max-w-lg mx-auto md:mx-0 text-center md:text-left">
              <h2 className="[font-family:'Antonio',Helvetica] font-bold text-black text-3xl md:text-4xl lg:text-5xl tracking-[-0.25px] leading-tight md:leading-[70px] mb-8 md:mb-12">
                {title}
              </h2>

              <div className="space-y-6 md:space-y-8">
                {benefits.map((benefit) => (
                  <div key={benefit.id}>
                    <h3 className={`[font-family:'Inria_Serif',Helvetica] ${benefit.highlighted ? 'font-bold' : 'font-normal'} text-[#1d1c21] text-base md:text-xl tracking-[-0.05px] leading-7 md:leading-[35px] mb-2`}>
                      {benefit.title}
                    </h3>
                    <p className="[font-family:'Inria_Serif',Helvetica] font-normal text-[#1d1c21] text-base sm:text-lg md:text-xl tracking-[-0.25px] leading-6 sm:leading-7 md:leading-[35px]">
                      {benefit.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Image - shows second on mobile, first on desktop */}
          <div className="w-full md:w-1/2 order-2 md:order-1 h-64 md:h-auto md:min-h-[500px] lg:min-h-[600px]">
            {imageUrl && !imageError ? (
              <img
                className="w-full h-full object-contain object-center rounded-[45px]"
                alt="Benefits illustration"
                src={imageUrl}
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="w-full h-full bg-gray-200 rounded-[45px] flex items-center justify-center">
                <span className="text-gray-400">Image not available</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};