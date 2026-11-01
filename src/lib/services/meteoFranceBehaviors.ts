// Catalogues et comportements officiels de Météo-France
export interface PhenomenonOfficialAdvice {
  id: number;
  name: string;
  title: string;
  consequences_orange: string[];
  conseils_orange: string[];
  consequences_rouge: string[];
  conseils_rouge: string[];
}

export const METEO_FRANCE_PHENOMENA: Record<number, PhenomenonOfficialAdvice> = {
  "1": {
    "id": 1,
    "name": "Vent violent",
    "title": "Vent",
    "consequences_orange": [
      "Des coupures d'électricité et de téléphone peuvent affecter les réseaux de distribution pendant des durées relativement importantes.",
      "Les toitures et les cheminées peuvent être endommagées.",
      "Des branches d'arbre risquent de se rompre.",
      "Les véhicules peuvent être déportés.",
      "La circulation routière peut être perturbée, en particulier sur le réseau secondaire en zone forestière.",
      "Le fonctionnement des infrastructures des stations de ski est perturbé.",
      "Quelques dégâts peuvent affecter les réseaux de distribution d'électricité et de téléphone."
    ],
    "conseils_orange": [
      "Je protège ma maison et les biens exposés au vent",
      "Je me tiens informé auprès des autorités",
      "Je limite mes déplacements",
      "Je prends garde aux chutes d'arbres et d'objets",
      "Je n’interviens pas sur les toits",
      "J’installe les groupes électrogènes à l'extérieur de la maison"
    ],
    "consequences_rouge": [
      "Avis de tempête très violente",
      "Des coupures d'électricité et de téléphone peuvent affecter les réseaux de distribution pendant des durées très importantes. Des dégâts nombreux et importants sont à attendre sur les habitations, les parcs et plantations. Les massifs forestiers peuvent être fortement touchés.",
      "La circulation routière peut être rendue très difficile sur l'ensemble du réseau.",
      "Les transports aériens, ferroviaires et maritimes peuvent être sérieusement affectés.",
      "Le fonctionnement des infrastructures des stations de ski peut être rendu impossible",
      "Des inondations importantes peuvent être à craindre aux abords des estuaires en période de marée haute.",
      "De très importants dégâts peuvent affecter les réseaux de distribution d'électricité et de téléphone pendant plusieurs jours."
    ],
    "conseils_rouge": [
      "Je ferme portes, fenêtres, et volets",
      "Je n’utilise pas ma voiture",
      "Je reste chez moi",
      "Je me tiens informé auprès des autorités"
    ]
  },
  "2": {
    "id": 2,
    "name": "Pluie-Inondation",
    "title": "Pluie Inondation",
    "consequences_orange": [
      "De fortes précipitations susceptibles d'affecter les activités humaines  sont attendues.",
      "Des inondations importantes sont possibles dans les zones habituellement inondables, sur l'ensemble des bassins hydrologiques des  départements concernés.",
      "Des cumuls importants de précipitation sur de courtes durées, peuvent, localement, provoquer des crues inhabituelles de ruisseaux et fossés.",
      "Risque de débordement des réseaux d'assainissement.",
      "Les conditions de circulation routière peuvent être rendues difficiles sur l'ensemble du réseau secondaire et quelques perturbations peuvent affecter les transports ferroviaires en dehors du réseau « grandes lignes ».",
      "Des coupures d'électricité peuvent se produire."
    ],
    "conseils_orange": [
      "Je m’éloigne des cours d'eau et des points bas, je rejoins un point haut ou je m’abrite à l'étage",
      "Je ne m’engage pas sur une route immergée, même partiellement",
      "J'évite de me déplacer",
      "Je me tiens informé et je surveille la montée des eaux",
      "Je ne descends pas dans les sous-sols",
      "Je mets mes biens hors d'eau et je localise mon kit d'urgence"
    ],
    "consequences_rouge": [
      "De très fortes précipitations sont attendues  susceptibles d'affecter les activités humaines et la vie économique pendant plusieurs jours",
      "Des inondations très importantes sont possibles, y compris dans des zones rarement inondables, sur l'ensemble des bassins hydrologiques des départements concernés.",
      "Des cumuls très importants de précipitations sur de courtes durées peuvent localement provoquer des crues torrentielles de ruisseaux et fossés.",
      "Les conditions de circulation routière peuvent être rendues extrêmement difficiles sur l'ensemble du réseau.",
      "Risque de débordement des réseaux d'assainissement.",
      "Des coupures d'électricité plus ou moins longues peuvent  se produire."
    ],
    "conseils_rouge": [
      "Je reste chez moi et je me tiens informé auprès des autorités",
      "Je n'utilise pas ma voiture",
      "Je ne vais pas chercher mes enfants à l'école",
      "Je m'éloigne des cours d'eau, des points bas et des ponts et je rejoins le point le plus haut possible",
      "Je me réfugie en étage, en dernier recours sur le toit, je ne descends pas dans les sous-sols",
      "J'évacue uniquement sur ordre des autorités en emportant mon kit d'urgence"
    ]
  },
  "3": {
    "id": 3,
    "name": "Orages",
    "title": "Orages",
    "consequences_orange": [
      "Violents orages susceptibles de provoquer localement des dégâts importants.",
      "Des dégâts importants sont localement à craindre sur l'habitat léger et les installations provisoires.",
      "Des inondations de caves et points bas peuvent se produire très rapidement.",
      "Quelques départs de feux peuvent être enregistrés en forêt suite à des impacts de foudre non accompagnés de précipitations."
    ],
    "conseils_orange": [
      "Je m'éloigne des arbres et des cours d'eau",
      "Je m'abrite dans un bâtiment en dur",
      "Je me tiens informé et j'évite de me déplacer",
      "Je protège les biens exposés au vent ou qui peuvent être inondés",
      "J'évite d'utiliser mon téléphone et les appareils électriques"
    ],
    "consequences_rouge": [
      "Nombreux et vraisemblablement très violents orages, susceptibles de provoquer localement des dégâts très importants.",
      "Localement, des dégâts très importants sont à craindre sur les habitations, les parcs, les cultures et plantations.",
      "Les massifs forestiers peuvent localement subir de très forts dommages et peuvent être rendus vulnérables aux feux par de très nombreux impacts de foudre.",
      "L'habitat léger et les installations provisoires peuvent être mis en réel danger.",
      "Des inondations de caves et points bas sont à craindre, ainsi que des crues torrentielles aux abords des ruisseaux et petites rivières."
    ],
    "conseils_rouge": [
      "Je reste chez moi et je me tiens informé",
      "Je m’abrite dans un bâtiment en dur",
      "Je n’utilise pas mon véhicule. Si je suis sur la route, je roule au pas et je ne m'engage pas sur une route immergée. Je stationne en sécurité et ne quitte pas mon véhicule",
      "Je n'utilise mon téléphone qu'en cas d'urgence"
    ]
  },
  "5": {
    "id": 5,
    "name": "Neige-Verglas",
    "title": "Neige Verglas",
    "consequences_orange": [
      "Des chutes de neige ou du verglas, dans des proportions importantes pour la région, sont attendus.",
      "Les conditions de circulation peuvent devenir rapidement très difficiles sur l'ensemble du réseau, tout particulièrement en secteur forestier où des chutes d'arbres peuvent accentuer les difficultés.",
      "Les risques d'accident sont accrus.",
      "Quelques dégâts peuvent affecter les réseaux de distribution d'électricité et de téléphone."
    ],
    "conseils_orange": [
      "Je me tiens informé auprès des autorités",
      "Je limite mes déplacements",
      "Pour la route, je munis mon véhicule d'équipements spéciaux, j’emporte des vivres et des couvertures",
      "J’installe les groupes électrogènes à l'extérieur de la maison et n'utilise pas les chauffages à combustion en continu"
    ],
    "consequences_rouge": [
      "De très importantes chutes de neige ou du verglas sont attendus, susceptibles d'affecter gravement les activités humaines et la vie économique.",
      "Les routes risquent de devenir rapidement impraticables sur l'ensemble du réseau.",
      "De très importants dégâts peuvent affecter les réseaux de distribution d'électricité et de téléphone pendant plusieurs jours.",
      "De très importantes perturbations sont à craindre concernant les transports aériens et ferroviaires."
    ],
    "conseils_rouge": [
      "Je reste chez moi",
      "Je me tiens informé auprès des autorités",
      "Si je suis immobilisé sur la route, je quitte mon véhicule uniquement sur ordre des autorités",
      "J’installe les groupes électrogènes à l'extérieur de la maison et n'utilise pas les chauffages à combustion en continu"
    ]
  },
  "6": {
    "id": 6,
    "name": "Canicule",
    "title": "Canicule",
    "consequences_orange": [
      "Chacun d'entre nous est menacé, même les sujets en bonne santé.",
      "Le danger est plus grand pour les personnes âgées, les personnes atteintes de maladie chronique ou de troubles de la santé mentale, les personnes qui prennent régulièrement des médicaments, et les personnes isolées.",
      "Chez les sportifs et les personnes qui travaillent dehors, attention à la déshydratation et au coup de chaleur.",
      "Veillez aussi sur les enfants.",
      "Les symptômes d'un coup de chaleur sont : une fièvre supérieure à 40°C, une peau chaude, rouge et sèche, des maux de tête, des nausées, une somnolence, une soif intense, une confusion, des convulsions et une perte de connaissance."
    ],
    "conseils_orange": [
      "Buvez de l'eau plusieurs fois par jour",
      "Continuez à manger normalement.",
      "Mouillez vous le corps plusieurs fois par jour à l’aide d’un brumisateur, d’un gant de toilette ou en prenant des douches ou des bains tièdes.",
      "Ne sortez pas aux heures les plus chaudes.",
      "Si vous devez sortir portez un chapeau et des vêtements légers.",
      "Essayez de vous rendre dans un endroit frais ou climatisé deux à trois heures par jour, tout en continuant de respecter la distanciation physique et les gestes barrière.",
      "Limitez vos activités physiques et sportives.",
      "Pendant la journée, fermez volets, rideaux et fenêtres. Aérez la nuit.",
      "Si vous avez des personnes âgées, souffrant de maladies chroniques ou isolées dans votre entourage, prenez de leurs nouvelles ou rendez leur visite.  Accompagnez-les dans un endroit frais.",
      "En cas de malaise ou de troubles du comportement, appelez un médecin.",
      "Si vous avez besoin d’aide appelez la mairie.",
      "Pour en savoir plus, consultez le site https://sante.gouv.fr/"
    ],
    "consequences_rouge": [
      "Chacun d'entre nous est menacé, même les sujets en bonne santé.",
      "L'augmentation de la température peut mettre en danger les personnes à risque c'est-à-dire les personnes âgées, handicapées, atteintes de maladies chroniques ou de troubles mentaux, les personnes qui prennent régulièrement des médicaments, les personnes isolées.",
      "Chez les sportifs et les personnes qui travaillent dehors, attention au coup de chaleur.",
      "Veillez aussi sur les enfants."
    ],
    "conseils_rouge": [
      "Buvez de l'eau plusieurs fois par jour",
      "Continuez à manger normalement.",
      "Mouillez vous le corps plusieurs fois par jour à l’aide d’un brumisateur, d’un gant de toilette ou en prenant des douches ou des bains tièdes.",
      "Ne sortez pas aux heures les plus chaudes.",
      "Si vous devez sortir portez un chapeau et des vêtements légers.",
      "Essayez de vous rendre dans un endroit frais ou climatisé deux à trois heures par jour, tout en continuant de respecter la distanciation physique et les gestes barrière.",
      "Limitez vos activités physiques et sportives.",
      "Pendant la journée, fermez volets, rideaux et fenêtres. Aérez la nuit.",
      "Si vous avez des personnes âgées, souffrant de maladies chroniques ou isolées dans votre entourage, prenez de leurs nouvelles ou rendez leur visite.  Accompagnez-les dans un endroit frais.",
      "En cas de malaise ou de troubles du comportement, appelez un médecin.",
      "Si vous avez besoin d’aide appelez la mairie.",
      "Soyez vigilant : toute personne, même si elle est en bonne santé, est concernée.",
      "Pour prévenir les feux de végétation, n’utilisez pas de matériel susceptible de produire des étincelles et veillez à ne pas avoir de comportement pouvant favoriser les départs de feux (cigarette, barbecue, etc.).",
      "En cas de départ de feu, appelez immédiatement le 112 ou le 18 et mettez-vous à l’abri.",
      "Pour en savoir plus, consultez le site : https://www.sante.gouv.fr/"
    ]
  },
  "7": {
    "id": 7,
    "name": "Grand Froid",
    "title": "Grand froid",
    "consequences_orange": [
      "Le grand froid peut mettre en danger les personnes fragilisées ou isolées, notamment les personnes âgées, handicapées, souffrant de maladies cardiovasculaires, respiratoires, endocriniennes ou certaines pathologies oculaires, les personnes souffrant de troubles mentaux ou du syndrome de Raynaud.",
      "Veillez particulièrement aux enfants.",
      "Certaines prises médicamenteuses peuvent avoir des contre- indications en cas de grands froids : demandez conseil à votre médecin.",
      "En cas de sensibilité personnelle aux gerçures (mains, lèvres), consultez un pharmacien.",
      "Chez les sportifs et les personnes qui travaillent à l'extérieur : attention à l'hypothermie et à l'aggravation de symptômes préexistants.",
      "Les symptômes de l'hypothermie sont progressifs : chair de poule, frissons, engourdissement des extrémités sont des signaux d'alarme : en cas de persistance ils peuvent nécessiter une aide médicale.",
      "Veillez particulièrement aux moyens utilisés pour vous chauffer et à la ventilation de votre logement : - une utilisation en continu des chauffages d'appoint ; - une utilisation de cuisinière, braséro, etc. pour vous chauffer ; - le fait de boucher les entrées d'air du logement ; peuvent entrainer un risque mortel d'intoxication au monoxyde de carbone"
    ],
    "conseils_orange": [
      "Evitez les expositions prolongées au froid et au vent , évitez les sorties le soir et la nuit.",
      "Protégez-vous des courants d'air et des chocs thermiques brusques.",
      "Habillez-vous chaudement, de plusieurs couches de vêtements, avec une couche extérieure imperméable au vent et à l'eau, couvrez-vous la tête et les mains ; ne gardez pas de vêtements humides.",
      "De retour à l'intérieur, alimentez-vous convenablement et prenez une boisson chaude, pas de boisson alcoolisée.",
      "Attention aux moyens utilisés pour vous chauffer : les chauffages d'appoint ne doivent pas fonctionner en continu ; ne jamais utiliser des cuisinières, braséros, etc. pour se chauffer. Ne bouchez pas les entrées d'air de votre logement.",
      "Par ailleurs, aérez votre logement quelques minutes même en hiver.",
      "Evitez les efforts brusques.",
      "Si vous devez prendre la route, informez-vous de l'état des routes. En cas de neige ou au verglas, ne prenez votre véhicule qu'en cas d'obligation forte. En tout cas, emmenez des boissons chaudes (thermos), des vêtements chauds et des couvertures, vos médicaments habituels, votre téléphoneportable chargé.",
      "Pour les personnes sensibles ou fragilisées : restez en contact avec votre médecin, évitez un isolement prolongé.",
      "Si vous remarquez une personne sans abri ou en difficulté, prévenez le \" 115 \".",
      "Pour en savoir plus, consultez les sites\r\n\t\r\n\t\thttps://sante.gouv.fr/",
      "https://www.santepubliquefrance.fr/ sur les aspects sanitaires",
      "www.bison-fute.gouv.fr pour les conditions de circulation"
    ],
    "consequences_rouge": [
      "une utilisation en continu des chauffages d'appoint ;",
      "une utilisation de cuisinière, braséro, etc. pour vous chauffer ;",
      "le fait de boucher les entrées d'air du logement ;"
    ],
    "conseils_rouge": [
      "Pour les personnes sensibles ou fragilisées : ne sortez qu'en  cas de force majeure, évitez un isolement prolongé, restez en contact avec votre médecin.",
      "Pour tous demeurez actifs, évitez les sorties surtout le soir, la nuit et en début de matinée.",
      "Habillez-vous chaudement, de plusieurs couches de vêtements, avec une couche extérieure imperméable au vent et à l'eau, couvrez-vous la tête et les mains ; ne gardez pas de vêtements humides.",
      "De retour à l'intérieur assurez vous un repos prolongé, avec douche ou bain chaud, alimentez-vous convenablement, prenez une boisson chaude, pas de boisson alcoolisée.",
      "Attention aux moyens utilisés pour vous chauffer : les chauffages d'appoint ne doivent pas fonctionner en continu ; ne jamais utiliser des cuisinières, braséros, etc. pour se chauffer. Ne bouchez pas les entrées d'air de votre logement.",
      "Par ailleurs, aérez votre logement quelques minutes même en hiver.",
      "Evitez les efforts brusques.",
      "Si vous devez prendre la route , informez-vous de l'état des routes. Si le froid est associé à la neige ou au verglas, ne prenez votre véhicule qu'en cas d'obligation forte. En tout cas, prévoyez des boissons chaudes (thermos), des vêtements chauds et des couvertures, vos médicaments habituels, votre téléphone portable chargé.",
      "Si vous remarquez une personne sans abri ou en difficulté, prévenez le \" 115 \".",
      "Restez en contact avec les personnes sensibles de votre entourage.",
      "Pour en savoir plus, consultez les sites\r\n\t\r\n\t\thttps://sante.gouv.fr/",
      "https://www.santepubliquefrance.fr/ sur les aspects sanitaires",
      "www.bison-fute.gouv.fr pour les conditions de circulation"
    ]
  },
  "9": {
    "id": 9,
    "name": "Vagues-Submersion",
    "title": "Vagues submersion",
    "consequences_orange": [
      "Fortes vagues déferlant sur le littoral",
      "Projections de galets et de macro-déchets."
    ],
    "conseils_orange": [
      "Je ne prends pas la mer",
      "Je m'éloigne des côtes et des estuaires",
      "Je me tiens informé et je localise mon kit d'urgence",
      "Je surveille la montée des eaux et je protège les biens qui peuvent être inondés",
      "Je rejoins le plus haut point possible ou me réfugie en étage, en dernier recours sur le toit"
    ],
    "consequences_rouge": [
      "Associées à de fortes pluies et à des vents tempétueux, les hauteurs d'eau attendues peuvent submerger les systèmes de défense côtiers (digues des ports, ouvrages de défense contre la mer, cordon dunaire) et provoquer des débordements dans les ports, la rupture des infrastructures de transports (routes, voies ferrées ...) et des inondations de zones habitées ainsi que de zones d'activités économiques.",
      "Les circulations routière et ferroviaire sur les axes longeant le littoral peuvent être rendues très difficiles.",
      "L'habitat léger et les installations provisoires sur le rivage et le littoral peuvent être mis en réel danger.",
      "Associés à de forts coefficients de marée (vives eaux), les risques de submersion côtiers et d'inondation des terres seront extrêmes."
    ],
    "conseils_rouge": [
      "Je ne prends pas la mer",
      "Je m'éloigne des côtes et des estuaires",
      "Je me tiens informé auprès des autorités",
      "Je rejoins le plus haut point possible ou me réfugie en étage, en dernier recours sur le toit",
      "J'évacue uniquement sur ordre des autorités et j'emporte mon kit d'urgence"
    ]
  },
  "8": {
    "id": 8,
    "name": "Avalanches",
    "title": "Avalanches",
    "consequences_orange": [
      "Très fort risque d'avalanche.",
      "Nombreux départs spontanés d'avalanche."
    ],
    "conseils_orange": [
      "Je ne sors pas en montagne",
      "Je me tiens informé auprès des autorités",
      "Je respecte les consignes de sécurité en vigueur dans les stations de montagne"
    ],
    "consequences_rouge": [
      "Très fort risque d'avalanche.",
      "Nombreux départs spontanés d'avalanche d'ampleur exceptionnelle."
    ],
    "conseils_rouge": [
      "Je reste chez moi",
      "Je me tiens informé auprès des autorités",
      "Je respecte les consignes de sécurité des autorités et des stations de montagne"
    ]
  },
  "4": {
    "id": 4,
    "name": "Inondation / Crues",
    "title": "Crues",
    "consequences_orange": [
      "Des crues importantes sont possibles.",
      "Les conditions de circulation peuvent être rendues difficiles sur l'ensemble du réseau et des perturbations peuvent affecter les transports ferroviaires.",
      "Des coupures d'électricité peuvent se produire.",
      "Les digues peuvent être fragilisées ou submergées."
    ],
    "conseils_orange": [
      "Je m’éloigne des cours d'eau et des ponts, je rejoins un point haut ou je m’abrite à l'étage",
      "Je ne m’engage pas sur une route immergée, même partiellement",
      "J'évite de me déplacer et je me tiens informé sur les conditions météo",
      "Je surveille la montée des eaux",
      "Je ne descends pas dans les sous-sols",
      "Je mets mes biens hors d'eau et je localise mon kit d'urgence"
    ],
    "consequences_rouge": [
      "Des crues très importantes sont possibles y compris dans les zones rarement inondées.",
      "Les conditions de circulation peuvent être rendues extrêmement difficiles sur l'ensemble du réseau routier ou ferroviaire.",
      "Des coupures d'électricité plus ou moins longues peuvent se produire.",
      "Des phénomènes de rupture ou de débordement de digues peuvent se produire."
    ],
    "conseils_rouge": [
      "Je reste chez moi et je me tiens informé auprès des autorités",
      "Je n'utilise pas ma voiture",
      "Je ne vais pas chercher mes enfants à l'école",
      "Je m'éloigne des cours d'eau, des points bas et des ponts et je rejoins le point le plus haut possible",
      "Je me réfugie en étage, en dernier recours sur le toit, je ne descends pas dans les sous-sols",
      "J'évacue uniquement sur ordre des autorités en emportant mon kit d'urgence"
    ]
  }
};

export const METEO_FRANCE_DEFAULT_YELLOW_ADVICE = [
  "Soyez attentif si vous pratiquez des activités extérieures sensibles au risque météorologique.",
  "Des phénomènes habituels dans la région mais occasionnellement et localement dangereux sont prévus.",
  "Tenez-vous régulièrement au courant de l'évolution de la situation météorologique."
];

export const METEO_FRANCE_DEFAULT_GREEN_ADVICE = [
  "Pas de vigilance particulière requise pour ce phénomène."
];
