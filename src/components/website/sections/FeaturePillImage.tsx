import React from 'react';
import type { ContactInfo } from '../../../types/website';

interface FeaturePillImageProps {
  title?: string;
  description?: string;
  contactInfo?: ContactInfo;
  leftImage?: string;
  backgroundColor?: string;
  iconImage?: string;
}

export const FeaturePillImage: React.FC<FeaturePillImageProps> = ({
  title = "CONTACTOS",
  description = "Sabemos que estás cansado de cocinar y repetir siempre lo mismo. Con Hola Dieta comes delicioso, cuidas tu salud y te olvidas del estrés de planear.",
  leftImage = "/clip-path-group-1.png",
  backgroundColor = "#ffb3e3",
  iconImage = "/phone-call.svg",
  contactInfo = {
    phone: "52 1 5545559432",
    email: "yellowdye@dobf.com"
  }
}) => {
  return (
    <section className="w-full rounded-[45px] py-8 md:py-16" style={{ backgroundColor }}>
      <div className="w-full max-w-7xl mx-auto px-8">
        <div className="flex flex-col md:flex-row md:items-center gap-8">
          <div className="w-full md:w-1/2 order-1 md:order-2 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start mb-6 md:mb-8">
              <img
                className="w-10 h-10 md:w-12 md:h-12 mr-3 md:mr-4"
                alt="Contact icon"
                src={iconImage}
                crossOrigin="anonymous"
              />
              <h2 className="font-antonio font-bold text-black text-3xl md:text-4xl lg:text-5xl tracking-[-0.25px] leading-tight md:leading-[67px]">
                {title}
              </h2>
            </div>

            <div className="font-normal text-[#1d1c21] text-base md:text-xl leading-6 md:leading-7 tracking-[-0.25px] max-w-lg mx-auto md:mx-0">
              <p className="mb-4 md:mb-6">{description}</p>

              {contactInfo.phone && (
                <>
                  <p className="font-bold mb-1 md:mb-2">Telefono:</p>
                  <p className="mb-4 md:mb-6">{contactInfo.phone}</p>
                </>
              )}

              {contactInfo.email && (
                <>
                  <p className="font-bold mb-1 md:mb-2">Email:</p>
                  <p>{contactInfo.email}</p>
                </>
              )}
            </div>
          </div>

          <div className="w-full md:w-1/2 flex justify-center order-2 md:order-1">
            <div className="w-3/4 md:w-4/5 aspect-square">
              <img
                className="w-full h-full object-contain object-center rounded-full border-4 border-black"
                alt="Contact illustration"
                src={leftImage}
                crossOrigin="anonymous"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
