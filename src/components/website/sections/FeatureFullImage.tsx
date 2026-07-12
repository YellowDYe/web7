import React from 'react';

interface FeatureFullImageProps {
  title?: string;
  description?: string;
  buttonText?: string;
  buttonLink?: string;
  leftImage?: string;
  rightBackgroundColor?: string;
}

export const FeatureFullImage: React.FC<FeatureFullImageProps> = ({
  title = "RECIBE TODOS TUS ALIMENTOS SIN SALIR DE CASA",
  description = "Sabemos que estás cansado de cocinar y repetir siempre lo mismo. Con Hola Dieta comes delicioso, cuidas tu salud y te olvidas del estrés de planear.",
  buttonText = "SELECCIONA TU PLAN",
  buttonLink = "",
  leftImage = "/clip-path-group.png",
  rightBackgroundColor = "#ffffff"
}) => {
  return (
    <section className="w-full rounded-[45px] py-8 md:py-16" style={{ backgroundColor: rightBackgroundColor }}>
      <div className="w-full max-w-7xl mx-auto px-8">
        <div className="flex flex-col md:flex-row md:items-center gap-8">
          <div className="w-full md:w-1/2 flex justify-center order-1 md:order-2 h-64 md:h-[500px] lg:h-[600px]">
            <img
              className="w-full h-full object-contain object-center rounded-[45px]"
              alt="Feature illustration"
              src={leftImage}
              crossOrigin="anonymous"
            />
          </div>

          <div className="w-full md:w-1/2 order-2 md:order-1 text-center md:text-left">
            <h2 className="font-antonio font-bold text-black text-3xl md:text-4xl lg:text-5xl tracking-[-0.25px] leading-tight md:leading-[70px] mb-6 md:mb-8">
              {title}
            </h2>

            <p className="font-normal text-[#1d1c21] text-lg md:text-xl tracking-[-0.25px] leading-6 md:leading-7 mb-8 md:mb-12 max-w-lg mx-auto md:mx-0">
              {description}
            </p>

            {buttonLink ? (
              <a
                href={buttonLink}
                target={buttonLink.startsWith('http') ? '_blank' : undefined}
                rel={buttonLink.startsWith('http') ? 'noopener noreferrer' : undefined}
                className="inline-flex items-center justify-center h-auto bg-[#e9ff93] rounded-[100px] border border-solid border-black text-black text-lg md:text-xl font-normal px-6 md:px-[30px] py-3 md:py-[15px] hover:bg-[#d4e87a] active:scale-95 transition-all duration-200 no-underline cursor-pointer select-none"
              >
                {buttonText}
              </a>
            ) : (
              <button className="h-auto bg-[#e9ff93] rounded-[100px] border border-solid border-black text-black text-lg md:text-xl font-normal px-6 md:px-[30px] py-3 md:py-[15px] hover:bg-[#d4e87a] active:scale-95 transition-all duration-200 cursor-pointer">
                {buttonText}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
