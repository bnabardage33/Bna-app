import React from "react";

interface HeaderProps {
  userName?: string;
  currentDate?: string;
  onOpenAuth?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  userName = "",
  currentDate = "Jeudi 29 octobre",
  onOpenAuth,
}) => {
  const initial = userName ? userName.charAt(0).toUpperCase() : "B";
  const greeting = userName ? `Bonjour, ${userName}` : "Bonjour";

  return (
    <header className="pt-2 pb-4 md:pb-6">
      {/* Ligne logo uniquement visible sur mobile (< md), car présente dans la barre supérieure sur Desktop */}
      <div className="flex items-center justify-between md:hidden">
        <div className="font-display font-black text-2xl tracking-tighter text-bna-anthracite">
          BN<span className="text-bna-copper">A</span>
        </div>
        <button
          onClick={onOpenAuth}
          className="w-8 h-8 rounded-full bg-bna-border/50 border border-bna-border flex items-center justify-center font-display font-semibold text-xs text-bna-anthracite hover:border-bna-copper transition-colors cursor-pointer"
          title="Mon profil & connexion"
          aria-label="Mon profil & connexion"
        >
          {initial}
        </button>
      </div>

      {/* Salutation & date (avec bouton profil aligné à droite sur Desktop) */}
      <div className="mt-4 md:mt-0 flex items-center justify-between gap-4">
        <div>
          <span className="text-xs font-medium text-bna-muted">{currentDate}</span>
          <h1 className="font-display font-bold text-2xl md:text-3xl text-bna-anthracite mt-0.5 tracking-tight">
            {greeting}
          </h1>
        </div>

        <button
          onClick={onOpenAuth}
          className="hidden md:flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-white border border-bna-border hover:border-bna-copper transition-colors cursor-pointer shadow-2xs"
          title="Mon profil & connexion"
          aria-label="Mon profil & connexion"
        >
          <span className="w-7 h-7 rounded-full bg-bna-offwhite border border-bna-border flex items-center justify-center font-display font-bold text-xs text-bna-anthracite">
            {initial}
          </span>
          <span className="text-xs font-semibold text-bna-anthracite pr-1">
            {userName || "Compte BNA"}
          </span>
        </button>
      </div>
    </header>
  );
};
