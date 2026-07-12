import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSiteBranding } from '../hooks/useSiteBranding';

interface CustomerSiteHeaderProps {
  basePath?: string;
  backgroundColor?: string;
  showAuthButton?: boolean;
}

export const CustomerSiteHeader: React.FC<CustomerSiteHeaderProps> = ({
  basePath = "/",
  backgroundColor = "bg-[#e9ff93]",
  showAuthButton = false
}) => {
  const [imageError, setImageError] = useState(false);
  const { logoUrl, logoAlt, siteName } = useSiteBranding();

  return (
    <header className={`flex w-full h-[90px] md:h-[104px] items-center justify-between py-4 md:py-8 px-4 md:px-8 ${backgroundColor} rounded-[0px_0px_45px_45px] border-b border-[#d9d9d9]`}>
      <div className="inline-flex items-center gap-6 relative flex-[0_0_auto]">
        <Link to={basePath}>
          <div className="flex items-center justify-center h-12 md:h-16 px-3 md:px-4">
            {!imageError && logoUrl && logoUrl.trim() ? (
              <img
                className="h-10 md:h-12 w-auto object-contain"
                alt={logoAlt || siteName || "Logo"}
                src={logoUrl}
                onError={() => setImageError(true)}
              />
            ) : (
              <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
                {siteName || "Hola Dieta"}
              </h1>
            )}
          </div>
        </Link>
      </div>
    </header>
  );
};

export default CustomerSiteHeader;
