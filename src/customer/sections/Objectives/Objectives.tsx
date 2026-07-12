import React from 'react';
import { Button } from '../../components/ui/button';

export interface ObjectiveCard {
  id: string;
  title?: string;
  description?: string;
  borderColor?: string;
  buttonText?: string;
  buttonLink?: string;
}

interface ObjectivesProps {
  title?: string;
  subtitle?: string;
  backgroundColor?: string;
  cards?: ObjectiveCard[];
}

const ObjectiveCardComponent: React.FC<{ card: ObjectiveCard }> = ({ card }) => {
  return (
    <div
      className="flex flex-col justify-between bg-white rounded-2xl border-2 p-8 h-full"
      style={{ borderColor: card.borderColor || '#e9ff93' }}
    >
      <div>
        <h3 className="[font-family:'Antonio',Helvetica] font-bold text-[#1e1e1e] text-2xl lg:text-3xl tracking-[-0.25px] leading-tight mb-4">
          {card.title || 'Objective Title'}
        </h3>
        <p className="[font-family:'Inria_Serif',Helvetica] font-normal text-[#444444] text-base leading-[1.6] tracking-[-0.25px]">
          {card.description || 'Describe this objective and its benefits here.'}
        </p>
      </div>

      <div className="mt-8">
        {card.buttonLink ? (
          <a
            href={card.buttonLink}
            target={card.buttonLink.startsWith('http') ? '_blank' : undefined}
            rel={card.buttonLink.startsWith('http') ? 'noopener noreferrer' : undefined}
            className="inline-flex items-center justify-center h-auto bg-[#e9ff93] rounded-[100px] border border-solid border-black text-black text-base lg:text-lg [font-family:'Chivo',Helvetica] font-normal px-6 py-3 hover:bg-[#d4e87a] active:scale-95 transition-all duration-200 no-underline cursor-pointer select-none"
          >
            {card.buttonText || 'Learn More'}
          </a>
        ) : (
          <Button className="h-auto bg-[#e9ff93] rounded-[100px] border border-solid border-black text-black text-base lg:text-lg [font-family:'Chivo',Helvetica] font-normal px-6 py-3 hover:bg-[#d4e87a] active:scale-95 transition-all duration-200">
            {card.buttonText || 'Learn More'}
          </Button>
        )}
      </div>
    </div>
  );
};

const defaultCards: ObjectiveCard[] = [
  {
    id: 'objective-1',
    title: 'Our First Objective',
    description: 'Describe what this objective means and how it drives your mission forward. Add context and value here.',
    borderColor: '#e9ff93',
    buttonText: 'Learn More',
    buttonLink: ''
  },
  {
    id: 'objective-2',
    title: 'Our Second Objective',
    description: 'Describe what this objective means and how it drives your mission forward. Add context and value here.',
    borderColor: '#ffcfe3',
    buttonText: 'Learn More',
    buttonLink: ''
  },
  {
    id: 'objective-3',
    title: 'Our Third Objective',
    description: 'Describe what this objective means and how it drives your mission forward. Add context and value here.',
    borderColor: '#bfd730',
    buttonText: 'Learn More',
    buttonLink: ''
  }
];

export const Objectives: React.FC<ObjectivesProps> = ({
  title = 'OUR OBJECTIVES',
  subtitle = 'What we stand for and where we are headed',
  backgroundColor = '#ffffff',
  cards = defaultCards
}) => {
  return (
    <section className="w-full py-12 md:py-20 px-8 rounded-[45px]" style={{ backgroundColor }}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10 md:mb-16">
          <h2 className="[font-family:'Antonio',Helvetica] font-bold text-[#1e1e1e] text-4xl lg:text-5xl tracking-[-0.25px] leading-tight mb-3">
            {title}
          </h2>
          <p className="[font-family:'Chivo',Helvetica] font-medium text-[#444444] text-lg text-center leading-7 tracking-[-0.25px]">
            {subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {cards.map((card) => (
            <ObjectiveCardComponent key={card.id} card={card} />
          ))}
        </div>
      </div>
    </section>
  );
};
