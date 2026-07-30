import React from 'react';
import type { PlanCard } from '../../../types/website';

interface MultiCardFeatureProps {
  title?: string;
  subtitle?: string;
  cards?: PlanCard[];
  backgroundColor?: string;
}

const parsePercent = (value: string): number => {
  const n = parseFloat(value);
  return isNaN(n) ? 0 : Math.max(0, n);
};

const MacrosBlock: React.FC<{ macros: PlanCard['macros'] }> = ({ macros }) => {
  if (!macros) return null;
  if (macros.macrosEnabled === false) return null;

  const columns = macros.columns || [];
  const total = columns.reduce((sum, c) => sum + parsePercent(c.percentage), 0) || 1;

  return (
    <div className="mt-4 w-full">
      <p className="text-xs font-bold text-black text-center uppercase tracking-widest mb-3 opacity-60">
        {macros.title || 'Macros'}
      </p>
      <div className="flex w-full h-6 rounded-full overflow-hidden border border-black/10">
        {columns.map((col, i) => {
          const pct = parsePercent(col.percentage);
          const width = (pct / total) * 100;
          return (
            <div
              key={i}
              className="flex items-center justify-center"
              style={{
                width: `${width}%`,
                backgroundColor: col.percentageBgColor || 'rgba(255,255,255,0.4)'
              }}
            >
              <span className="text-xs font-bold text-white leading-none drop-shadow-sm px-1 truncate">
                {col.percentage}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex w-full mt-2">
        {columns.map((col, i) => {
          const pct = parsePercent(col.percentage);
          const width = (pct / total) * 100;
          return (
            <div key={i} className="px-1" style={{ width: `${width}%` }}>
              <span className="block text-[10px] font-semibold text-black/70 text-center uppercase tracking-wide leading-tight truncate">
                {col.header}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const MultiCardFeature: React.FC<MultiCardFeatureProps> = ({
  title = "PLANES",
  subtitle = "Cada plan se adapta a una necesidad",
  backgroundColor = "#ffffff",
  cards = [
    {
      id: "balance",
      title: "BALANCE",
      description: "Sabemos que estás cansado de cocinar y repetir siempre lo mismo. Con Hola Dieta comes delicioso, cuidas tu salud y te olvidas del estrés de planear.",
      backgroundColor: "#e1fe6b",
      buttonText: "ORDENA",
      imageUrl: "/rectangle-9.svg",
      macros: {
        title: "Macros",
        columns: [
          { header: "Proteinas", percentage: "50%" },
          { header: "Carbohidratos", percentage: "50%" },
          { header: "Grasas", percentage: "50%" }
        ]
      }
    },
    {
      id: "fitness",
      title: "FITNESS",
      description: "Sabemos que estás cansado de cocinar y repetir siempre lo mismo. Con Hola Dieta comes delicioso, cuidas tu salud y te olvidas del estrés de planear.",
      backgroundColor: "#ffcfe3",
      buttonText: "ORDENA",
      imageUrl: "/rectangle-9.svg",
      macros: {
        title: "Macros",
        columns: [
          { header: "Proteinas", percentage: "50%" },
          { header: "Carbohidratos", percentage: "50%" },
          { header: "Grasas", percentage: "50%" }
        ]
      }
    },
    {
      id: "lowcarb",
      title: "LOW CARB",
      description: "Sabemos que estás cansado de cocinar y repetir siempre lo mismo. Con Hola Dieta comes delicioso, cuidas tu salud y te olvidas del estrés de planear.",
      backgroundColor: "#bfd730",
      buttonText: "ORDENA",
      imageUrl: "/rectangle-9.svg",
      macros: {
        title: "Macros",
        columns: [
          { header: "Proteinas", percentage: "50%" },
          { header: "Carbohidratos", percentage: "50%" },
          { header: "Grasas", percentage: "50%" }
        ]
      }
    }
  ]
}) => {
  return (
    <section className="w-full py-8 md:py-16 px-8 rounded-[45px]" style={{ backgroundColor }}>
      <div className="text-center mb-8 md:mb-16">
        <h2 className="font-antonio font-bold text-black text-4xl lg:text-5xl text-center tracking-[-0.25px] leading-tight lg:leading-[120px] mb-2 lg:mb-4">
          {title}
        </h2>
        <p className="font-medium text-[#1d1c21] text-xl text-center leading-7 tracking-[-0.25px]">
          {subtitle}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {cards.map((card) => (
          <div
            key={card.id}
            className="w-full bg-[#d9d9d9] rounded-[45px] overflow-hidden relative"
          >
            <div className="p-0 relative">
              <div className="h-[220px] relative overflow-hidden">
                <img
                  className="absolute w-full h-full top-0 left-0 object-contain object-top"
                  alt="Plan background"
                  src={card.imageUrl || "/rectangle-9.svg"}
                  crossOrigin="anonymous"
                />
              </div>

              <div
                className="rounded-[0px_0px_45px_45px] flex flex-col items-center p-8 pt-6"
                style={{ backgroundColor: card.backgroundColor }}
              >
                <h3 className="font-antonio font-bold text-black text-3xl lg:text-4xl text-center tracking-[-0.25px] leading-9 mb-4">
                  {card.title}
                </h3>

                <p className="font-normal text-[#1d1c21] text-base text-center leading-[22px] tracking-[-0.25px] mb-4 max-w-sm">
                  {card.description}
                </p>

                {card.macros && <MacrosBlock macros={card.macros} />}

                <div className="mt-6">
                  {card.buttonLink ? (
                    <a
                      href={card.buttonLink}
                      target={card.buttonLink.startsWith('http') ? '_blank' : undefined}
                      rel={card.buttonLink.startsWith('http') ? 'noopener noreferrer' : undefined}
                      className="inline-flex items-center justify-center h-auto bg-[#e9ff93] rounded-[100px] border border-solid border-black text-black text-xl lg:text-2xl font-normal px-4 py-2.5 hover:bg-[#d4e87a] active:scale-95 transition-all duration-200 no-underline cursor-pointer select-none"
                    >
                      {card.buttonText}
                    </a>
                  ) : (
                    <button className="h-auto bg-[#e9ff93] rounded-[100px] border border-solid border-black text-black text-xl lg:text-2xl font-normal px-4 py-2.5 hover:bg-[#d4e87a] active:scale-95 transition-all duration-200 cursor-pointer">
                      {card.buttonText}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
