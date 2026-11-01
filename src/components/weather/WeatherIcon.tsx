"use client";

import React from "react";
import {
  Sun,
  CloudSun,
  Cloud,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  CloudSnow,
  CloudLightning,
} from "lucide-react";

interface WeatherIconProps {
  iconName: string;
  className?: string;
}

export const WeatherIcon: React.FC<WeatherIconProps> = ({ iconName, className = "w-6 h-6" }) => {
  switch (iconName) {
    case "Sun":
      return <Sun className={className} />;
    case "CloudSun":
      return <CloudSun className={className} />;
    case "Cloud":
      return <Cloud className={className} />;
    case "CloudFog":
      return <CloudFog className={className} />;
    case "CloudDrizzle":
      return <CloudDrizzle className={className} />;
    case "CloudRain":
      return <CloudRain className={className} />;
    case "CloudSnow":
      return <CloudSnow className={className} />;
    case "CloudLightning":
      return <CloudLightning className={className} />;
    default:
      return <Cloud className={className} />;
  }
};
