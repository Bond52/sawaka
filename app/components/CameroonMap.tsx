"use client";

import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/src/i18n/I18nProvider";

export default function CameroonMap() {
  const { t } = useTranslation();
  const router = useRouter();
  const [geo, setGeo] = useState<any>(null);
  const [counts, setCounts] = useState<any>({});

  useEffect(() => {
    fetch("/maps/cameroon-regions.json")
      .then((res) => res.json())
      .then(setGeo)
      .catch(console.error);

    fetch("https://ecommerce-web-avec-tailwind.onrender.com/stats/artisans-par-region")
      .then((res) => res.json())
      .then(setCounts)
      .catch(console.error);
  }, []);

  const regionStyle = (feature: any) => {
    const name = feature.properties?.region || feature.properties?.name;
    const value = counts[name] ?? 0;

    const color =
      value === 0 ? "#f0e5d8" :
      value === 1 ? "#f7c58d" :
      value === 2 ? "#ee9f49" :
      "#d97904";

    return {
      fillColor: color,
      weight: 1,
      opacity: 1,
      color: "#8a5500",
      fillOpacity: 0.7,
    };
  };

  const onEachRegion = (feature: any, layer: any) => {
    const rawName = feature.properties?.region || feature.properties?.name;

    layer.bindTooltip(`${rawName}`, {
      permanent: false,
      sticky: true
    });

    layer.on("click", () => {
      const normalized = rawName
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-");

      router.push(`/artisans?region=${normalized}`);
    });
  };

  if (!geo)
    return <p className="text-center py-6">{t("network.mapLoading")}</p>;

  return (
    <div className="wrap my-12">
      <h2 className="text-3xl md:text-4xl font-bold text-sawaka-800 mb-4 text-center">
        {t("network.mapTitle")}
      </h2>

      <p className="text-lg text-sawaka-600 text-center mb-6">
        {t("network.mapSubtitle")}
      </p>

      <div className="flex justify-center gap-6 mb-4 text-sm">
        <div className="flex items-center gap-2">
          <span style={{ width: 20, height: 20, background: "#f0e5d8", border: "1px solid #aaa" }}></span> {t("network.legend0")}
        </div>
        <div className="flex items-center gap-2">
          <span style={{ width: 20, height: 20, background: "#f7c58d", border: "1px solid #aaa" }}></span> {t("network.legend1")}
        </div>
        <div className="flex items-center gap-2">
          <span style={{ width: 20, height: 20, background: "#ee9f49", border: "1px solid #aaa" }}></span> {t("network.legend2")}
        </div>
        <div className="flex items-center gap-2">
          <span style={{ width: 20, height: 20, background: "#d97904", border: "1px solid #aaa" }}></span> {t("network.legend3")}
        </div>
      </div>

      <MapContainer
        center={[7.3, 12.4]}
        zoom={6.3}
        scrollWheelZoom={false}
        style={{ height: "550px", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution={t("network.osmAttribution")}
        />

        <GeoJSON
          data={geo}
          style={regionStyle}
          onEachFeature={onEachRegion}
        />
      </MapContainer>
    </div>
  );
}
