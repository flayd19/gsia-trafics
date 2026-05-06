// =====================================================================
// CityMap — mapa REAL de Goianésia via Leaflet + OpenStreetMap tiles.
//
// Estratégia:
//   • TileLayer puxa tiles do tile.openstreetmap.org (mostra ruas e
//     construções reais da cidade).
//   • Polígonos dos lotes são desenhados por cima como overlay, com
//     renderer Canvas (performance pra ~4700 polígonos).
//   • Hover/click via eventos do Leaflet em cada Polygon.
//   • Pan e zoom nativos do Leaflet (mouse + touch).
// =====================================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Polygon, Polyline, useMap } from 'react-leaflet';
import L, { type LatLngBoundsExpression, type LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { CityData, CityLot, BuildingType } from '@/hooks/useCityLots';

interface CityMapProps {
  data:           CityData;
  myUserId?:      string | null;
  selectedLotId?: string | null;
  onLotClick?:    (lot: CityLot) => void;
  height?:        number;
}

const BUILDING_COLOR: Record<BuildingType, string> = {
  house:        '#fbbf24',
  commerce:     '#3b82f6',
  industry:     '#9ca3af',
  office:       '#a855f7',
  residential:  '#fcd34d',
  farm:         '#84cc16',
  garage:       '#06b6d4',
};

// Renderer Canvas (mais leve que SVG pra muitos polígonos)
const canvasRenderer = L.canvas({ padding: 0.3 });

export function CityMap({
  data, myUserId, selectedLotId, onLotClick, height = 600,
}: CityMapProps): JSX.Element {
  // bbox do JSON em [lat, lng] para Leaflet
  const bounds: LatLngBoundsExpression = useMemo(() => [
    [data.bbox.minLat, data.bbox.minLng],
    [data.bbox.maxLat, data.bbox.maxLng],
  ], [data.bbox]);

  const center: LatLngExpression = useMemo(() => [
    data.cityCenter[1], // lat
    data.cityCenter[0], // lng
  ], [data.cityCenter]);

  return (
    <div
      className="relative ios-surface rounded-[14px] overflow-hidden"
      style={{ height }}
    >
      <MapContainer
        center={center}
        zoom={14}
        minZoom={12}
        maxZoom={19}
        bounds={bounds}
        scrollWheelZoom
        style={{ height: '100%', width: '100%' }}
        preferCanvas
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Lotes — render como Polygon. Memoizado pra evitar re-render por hover. */}
        <LotsLayer
          lots={data.lots}
          myUserId={myUserId}
          selectedLotId={selectedLotId}
          onLotClick={onLotClick}
        />

        {/* Highway destacada (GO-080 etc.) */}
        {data.highways.map((h, i) => (
          <Polyline
            key={`hw_${i}`}
            positions={h.path.map(([lng, lat]) => [lat, lng] as [number, number])}
            pathOptions={{ color: '#facc15', weight: 4, opacity: 0.7 }}
            renderer={canvasRenderer}
          />
        ))}

        <FitBoundsOnMount bounds={bounds} />
      </MapContainer>

      {/* Legenda flutuante */}
      <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur rounded-[8px] px-2 py-1.5 text-[10px] space-y-0.5 shadow-md z-[400]">
        <div className="font-bold text-foreground mb-0.5">{data.city}</div>
        <LegendDot color="#f1f5f9" border="#94a3b8" label="Disponível" />
        <LegendDot color="#22c55e" label="Seu" />
        <LegendDot color="#ef4444" label="Outro player" />
        <LegendDot color="#fbbf24" label="Casa" />
        <LegendDot color="#3b82f6" label="Comércio" />
      </div>
    </div>
  );
}

// ── Componente filho: ajusta o viewport pra cobrir toda a cidade no mount ──
function FitBoundsOnMount({ bounds }: { bounds: LatLngBoundsExpression }): null {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(bounds, { padding: [10, 10] });
  }, [map, bounds]);
  return null;
}

// ── Camada de lotes ─────────────────────────────────────────────────
function LotsLayer({
  lots, myUserId, selectedLotId, onLotClick,
}: {
  lots: CityLot[];
  myUserId?: string | null;
  selectedLotId?: string | null;
  onLotClick?: (lot: CityLot) => void;
}): JSX.Element {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const map = useMap();

  // Performance: só renderiza polígonos dentro dos bounds atuais ao zoom alto.
  // Em zoom baixo, renderiza todos (são polígonos pequenos no canvas, ok).
  const [zoom, setZoom] = useState(map.getZoom());
  const [viewBounds, setViewBounds] = useState(map.getBounds());

  useEffect(() => {
    const onMove = () => {
      setZoom(map.getZoom());
      setViewBounds(map.getBounds());
    };
    map.on('moveend', onMove);
    map.on('zoomend', onMove);
    return () => {
      map.off('moveend', onMove);
      map.off('zoomend', onMove);
    };
  }, [map]);

  const visibleLots = useMemo(() => {
    if (zoom < 14) return lots; // zoom out: mostra tudo
    return lots.filter(l => {
      const [lng, lat] = l.polygon[0];
      return viewBounds.contains([lat, lng]);
    });
  }, [lots, zoom, viewBounds]);

  return (
    <>
      {visibleLots.map(l => {
        const isOwned = l.owner_user_id != null;
        const isMine  = isOwned && l.owner_user_id === myUserId;
        const isSelected = selectedLotId === l.id;
        const isHovered  = hoveredId === l.id;

        const fill = (() => {
          if (l.building_type) return BUILDING_COLOR[l.building_type];
          if (isMine)          return '#22c55e';
          if (isOwned)         return '#ef4444';
          return '#f1f5f9';
        })();

        const positions = l.polygon.map(
          ([lng, lat]) => [lat, lng] as [number, number]
        );

        return (
          <Polygon
            key={l.id}
            positions={positions}
            pathOptions={{
              fillColor:   fill,
              fillOpacity: isOwned || l.building_type ? 0.7 : 0.35,
              color:       isSelected ? '#0ea5e9' : isHovered ? '#0f172a' : '#475569',
              weight:      isSelected ? 2.5 : isHovered ? 1.8 : 0.6,
            }}
            renderer={canvasRenderer}
            eventHandlers={{
              click:     () => onLotClick?.(l),
              mouseover: () => setHoveredId(l.id),
              mouseout:  () => setHoveredId(prev => (prev === l.id ? null : prev)),
            }}
          />
        );
      })}
    </>
  );
}

// ── Subcomponentes ──────────────────────────────────────────────────
function LegendDot({
  color, border, label,
}: {
  color:   string;
  border?: string;
  label:   string;
}): JSX.Element {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="inline-block w-2.5 h-2.5 rounded-sm"
        style={{ background: color, border: border ? `1px solid ${border}` : 'none' }}
      />
      <span>{label}</span>
    </div>
  );
}
