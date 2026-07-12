import React from 'react';
import type { Step } from '../../../types/website';

interface StepsFeatureProps {
  title?: string;
  subtitle?: string;
  steps?: Step[];
  backgroundColor?: string;
}

export const StepsFeature: React.FC<StepsFeatureProps> = ({
  title = "COMO FUNCIONA",
  subtitle = "Sabemos que estás cansado de cocinar y repetir siempre lo mismo.",
  backgroundColor = "#f4ffeb",
  steps = [
    {
      id: "step1",
      number: "1",
      title: "Paso 1",
      description: "Sabemos que estás cansado de cocinar y repetir siempre lo mismo. Con Hola Dieta comes delicioso, cuidas tu salud y te olvidas del estrés de planear."
    },
    {
      id: "step2",
      number: "2",
      title: "Paso 2",
      description: "Sabemos que estás cansado de cocinar y repetir siempre lo mismo. Con Hola Dieta comes delicioso, cuidas tu salud y te olvidas del estrés de planear."
    },
    {
      id: "step3",
      number: "3",
      title: "Paso 3",
      description: "Sabemos que estás cansado de cocinar y repetir siempre lo mismo. Con Hola Dieta comes delicioso, cuidas tu salud y te olvidas del estrés de planear."
    }
  ]
}) => {
  return (
    <section className="w-full py-8 md:py-16 px-8 rounded-[45px]" style={{ backgroundColor }}>
      <div className="text-center mb-8 md:mb-16">
        <h2 className="font-antonio font-bold text-black text-4xl lg:text-5xl text-center tracking-[-0.25px] leading-tight lg:leading-[120px] mb-2 lg:mb-4">
          {title}
        </h2>
        <p className="font-medium text-[#1d1c21] text-xl text-center leading-7 tracking-[-0.25px] max-w-4xl mx-auto">
          {subtitle}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {steps.map((step) => (
          <div key={step.id} className="text-center">
            <div className="w-[77px] h-[77px] bg-[#bfd730] rounded-full mx-auto mb-8 flex items-center justify-center">
              <span className="font-normal text-black text-[40px] tracking-[-0.25px] leading-7">
                {step.number}
              </span>
            </div>

            <h3 className="font-antonio font-bold text-black text-3xl lg:text-4xl text-center tracking-[-0.25px] leading-9 mb-6">
              {step.title}
            </h3>

            <p className="font-normal text-[#1d1c21] text-base text-center leading-7 tracking-[-0.25px] max-w-sm mx-auto">
              {step.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};
