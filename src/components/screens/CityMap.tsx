// =====================================================================
// CityMap — SVG da cidade com pan, zoom, hover e click-to-select.
//
// Estratégias de performance:
//   • Renderiza só lotes dentro do viewBox atual (clip-by-bbox)
//   • Polígonos como <polygon> com fill que reflete estado (disponível,
//     próprio, do outro player) — sem re-render pesado
//   • Cada lote tem evento onMouseEnter (set hovered) e onClick (set selected)
//   • Pan via drag (mouse + touch). Zoom via wheel + pinch.
//
// Output do click: chama prop `onLotClick(lot)` — o consumidor decide
// se abre dialog de compra/construção/etc.
// =====================================================================
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import type { CityData, CityLot, LngLat, BuildingType } from '@/hooks/useCityLots';
import { Plus, Minus, Maximize2 } from 'lucide-react';

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

// Limites do zoom
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 8;

export function CityMap({
  data, myUserId, selectedLotId, onLotClick, height = 600,
}: CityMapProps): JSX.Element {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Projeção lng/lat → x/y (equirectangular, viewBox em "graus * 1000")
  const proj = useMemo(() => {
    const { minLng, maxLng, minLat, maxLat } = data.bbox;
    const w = (maxLng - minLng) * 1000;
    const h = (maxLat - minLat) * 1000;
    return {
      width:  w,
      height: h,
      x: (lng: number) => (lng - minLng) * 1000,
      y: (lat: number) => (maxLat - lat) * 1000, // inverte Y
    };
  }, [data.bbox]);

  // Estado de pan/zoom (em coords do viewBox)
  const initialView = useMemo(() => ({
    x: 0,
    y: 0,
    w: proj.width,
    h: proj.height,
  }), [proj]);

  const [view, setView] = useState(initialView);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const zoom = useCallback((factor: number, anchorX?: number, anchorY?: number) => {
    setView(v => {
      const newW = Math.max(proj.width / MAX_ZOOM, Math.min(proj.width / MIN_ZOOM, v.w / factor));
      const newH = Math.max(proj.height / MAX_ZOOM, Math.min(proj.height / MIN_ZOOM, v.h / factor));
      // Zoom em torno do âncora (default = centro)
      const ax = anchorX ?? v.x + v.w / 2;
      const ay = anchorY ?? v.y + v.h / 2;
      const dx = (ax - v.x) * (newW / v.w - 1);
      const dy = (ay - v.y) * (newH / v.h - 1);
      return {
        x: clamp(v.x - dx, -proj.width * 0.1, proj.width * 1.1 - newW),
        y: clamp(v.y - dy, -proj.height * 0.1, proj.height * 1.1 - newH),
        w: newW,
        h: newH,
      };
    });
  }, [proj]);

  // Wheel zoom
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const sx = (e.clientX - rect.left) / rect.width;
      const sy = (e.clientY - rect.top)  / rect.height;
      setView(v => {
        const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
        const newW = Math.max(proj.width / MAX_ZOOM, Math.min(proj.width / MIN_ZOOM, v.w / factor));
        const newH = Math.max(proj.height / MAX_ZOOM, Math.min(proj.height / MIN_ZOOM, v.h / factor));
        const ax = v.x + sx * v.w;
        const ay = v.y + sy * v.h;
        const newX = ax - sx * newW;
        const newY = ay - sy * newH;
        return {
          x: clamp(newX, -proj.width * 0.2, proj.width * 1.2 - newW),
          y: clamp(newY, -proj.height * 0.2, proj.height * 1.2 - newH),
          w: newW, h: newH,
        };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [proj]);

  // Pan
  const dragRef = useRef<{ startX: number; startY: number; viewX: number; viewY: number } | null>(null);
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    dragRef.current = { startX: e.clientX, startY: e.clientY, viewX: view.x, viewY: view.y };
  };
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const el = svgRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dx = ((e.clientX - drag.startX) / rect.width)  * view.w;
    const dy = ((e.clientY - drag.startY) / rect.height) * view.h;
    setView({
      x: clamp(drag.viewX - dx, -proj.width * 0.2, proj.width * 1.2 - view.w),
      y: clamp(drag.viewY - dy, -proj.height * 0.2, proj.height * 1.2 - view.h),
      w: view.w, h: view.h,
    });
  };
  const handleMouseUp = () => { dragRef.current = null; };

  // Touch (1 dedo = pan, 2 dedos = pinch)
  const touchRef = useRef<{ kind: 'pan' | 'pinch'; startX: number; startY: number; viewX: number; viewY: number; startDist?: number; startW?: number; startH?: number } | null>(null);
  const handleTouchStart = (e: React.TouchEvent<SVGSVGElement>) => {
    if (e.touches.length === 1) {
      touchRef.current = {
        kind: 'pan',
        startX: e.touches[0].clientX,
        startY: e.touches[0].clientY,
        viewX: view.x, viewY: view.y,
      };
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      touchRef.current = {
        kind: 'pinch',
        startX: 0, startY: 0, viewX: 0, viewY: 0,
        startDist: dist, startW: view.w, startH: view.h,
      };
    }
  };
  const handleTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    const t = touchRef.current;
    if (!t) return;
    const el = svgRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (t.kind === 'pan' && e.touches.length === 1) {
      const dx = ((e.touches[0].clientX - t.startX) / rect.width)  * view.w;
      const dy = ((e.touches[0].clientY - t.startY) / rect.height) * view.h;
      setView(v => ({
        x: clamp(t.viewX - dx, -proj.width * 0.2, proj.width * 1.2 - v.w),
        y: clamp(t.viewY - dy, -proj.height * 0.2, proj.height * 1.2 - v.h),
        w: v.w, h: v.h,
      }));
    } else if (t.kind === 'pinch' && e.touches.length === 2 && t.startDist) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const factor = dist / t.startDist;
      setView(v => {
        const newW = Math.max(proj.width / MAX_ZOOM, Math.min(proj.width / MIN_ZOOM, (t.startW ?? v.w) / factor));
        const newH = Math.max(proj.height / MAX_ZOOM, Math.min(proj.height / MIN_ZOOM, (t.startH ?? v.h) / factor));
        // mantém o ponto médio fixo
        const cx = v.x + v.w / 2;
        const cy = v.y + v.h / 2;
        return {
          x: clamp(cx - newW / 2, -proj.width * 0.2, proj.width * 1.2 - newW),
          y: clamp(cy - newH / 2, -proj.height * 0.2, proj.height * 1.2 - newH),
          w: newW, h: newH,
        };
      });
    }
  };
  const handleTouchEnd = () => { touchRef.current = null; };

  // Filtragem por viewport (renderiza só lotes que cruzam a view)
  const visibleLots = useMemo(() => {
    const minX = view.x;
    const minY = view.y;
    const maxX = view.x + view.w;
    const maxY = view.y + view.h;
    return data.lots.filter(l => {
      // Bounding box do lote em coords projetadas
      let lminX = Infinity, lminY = Infinity, lmaxX = -Infinity, lmaxY = -Infinity;
      for (const [lng, lat] of l.polygon) {
        const px = proj.x(lng); const py = proj.y(lat);
        if (px < lminX) lminX = px;
        if (py < lminY) lminY = py;
        if (px > lmaxX) lmaxX = px;
        if (py > lmaxY) lmaxY = py;
      }
      return !(lmaxX < minX || lminX > maxX || lmaxY < minY || lminY > maxY);
    });
  }, [data.lots, view, proj]);

  const polygonPoints = (poly: LngLat[]): string =>
    poly.map(([lng, lat]) => `${proj.x(lng).toFixed(2)},${proj.y(lat).toFixed(2)}`).join(' ');

  const fitToCity = () => setView(initialView);

  return (
    <div ref={containerRef} className="relative ios-surface rounded-[14px] overflow-hidden bg-[#dbe9d4]" style={{ height }}>
      <svg
        ref={svgRef}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        width="100%"
        height="100%"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ cursor: dragRef.current ? 'grabbing' : 'grab', touchAction: 'none' }}
      >
        {/* Background da cidade (área urbana) */}
        <rect x={view.x} y={view.y} width={view.w} height={view.h} fill="#e8efe5" />

        {/* Parques */}
        {data.parks.map(p => (
          <polygon
            key={p.id}
            points={polygonPoints(p.polygon)}
            fill="#86efac"
            stroke="#16a34a"
            strokeWidth={0.4}
            opacity={0.85}
          />
        ))}

        {/* Clubes */}
        {(data.clubs ?? []).map(c => (
          <polygon
            key={c.id}
            points={polygonPoints(c.polygon)}
            fill="#bbf7d0"
            stroke="#15803d"
            strokeWidth={0.4}
            strokeDasharray="1,1"
            opacity={0.7}
          />
        ))}

        {/* Ruas (locais) */}
        {data.streets.map(s => (
          <polyline
            key={s.id}
            points={s.path.map(([lng, lat]) => `${proj.x(lng).toFixed(2)},${proj.y(lat).toFixed(2)}`).join(' ')}
            stroke="#cbd5e1"
            strokeWidth={0.6}
            fill="none"
          />
        ))}

        {/* Highway (GO-080) */}
        {data.highways.map((h, i) => (
          <g key={i}>
            <polyline
              points={h.path.map(([lng, lat]) => `${proj.x(lng).toFixed(2)},${proj.y(lat).toFixed(2)}`).join(' ')}
              stroke="#facc15"
              strokeWidth={2.2}
              fill="none"
              strokeLinecap="round"
            />
            <polyline
              points={h.path.map(([lng, lat]) => `${proj.x(lng).toFixed(2)},${proj.y(lat).toFixed(2)}`).join(' ')}
              stroke="#fff"
              strokeWidth={0.4}
              strokeDasharray="3,2"
              fill="none"
            />
          </g>
        ))}

        {/* Lotes — renderiza só os visíveis */}
        {visibleLots.map(l => {
          const isOwned    = l.owner_user_id != null;
          const isMine     = isOwned && l.owner_user_id === myUserId;
          const isSelected = selectedLotId === l.id;
          const isHovered  = hoveredId === l.id;
          const fill = (() => {
            if (l.building_type) return BUILDING_COLOR[l.building_type];
            if (isMine)          return '#22c55e';
            if (isOwned)         return '#ef4444';
            return '#f1f5f9';
          })();
          return (
            <polygon
              key={l.id}
              points={polygonPoints(l.polygon)}
              fill={fill}
              fillOpacity={isOwned || l.building_type ? 0.85 : 0.6}
              stroke={isSelected ? '#0ea5e9' : isHovered ? '#1e293b' : '#94a3b8'}
              strokeWidth={isSelected ? 0.6 : isHovered ? 0.4 : 0.15}
              onMouseEnter={() => setHoveredId(l.id)}
              onMouseLeave={() => setHoveredId(prev => prev === l.id ? null : prev)}
              onClick={(e) => { e.stopPropagation(); onLotClick?.(l); }}
              style={{ cursor: 'pointer' }}
            />
          );
        })}

        {/* Labels de bairro (só em zoom out) */}
        {view.w > proj.width * 0.5 && data.neighborhoods.map(n => (
          <text
            key={n.name}
            x={proj.x(n.center[0])}
            y={proj.y(n.center[1])}
            fontSize={1.2}
            fontWeight="bold"
            fill="#475569"
            textAnchor="middle"
            pointerEvents="none"
            style={{ textShadow: '0 0 2px white' }}
          >
            {n.name}
          </text>
        ))}
      </svg>

      {/* Controles de zoom */}
      <div className="absolute top-2 right-2 flex flex-col gap-1.5">
        <button
          onClick={() => zoom(1.4)}
          className="w-8 h-8 rounded-full bg-white/90 hover:bg-white shadow flex items-center justify-center text-foreground"
          aria-label="Zoom in"
        >
          <Plus size={16} />
        </button>
        <button
          onClick={() => zoom(1 / 1.4)}
          className="w-8 h-8 rounded-full bg-white/90 hover:bg-white shadow flex items-center justify-center text-foreground"
          aria-label="Zoom out"
        >
          <Minus size={16} />
        </button>
        <button
          onClick={fitToCity}
          className="w-8 h-8 rounded-full bg-white/90 hover:bg-white shadow flex items-center justify-center text-foreground"
          aria-label="Ajustar"
        >
          <Maximize2 size={14} />
        </button>
      </div>

      {/* Legenda */}
      <div className="absolute bottom-2 left-2 bg-white/85 backdrop-blur rounded-[8px] px-2 py-1.5 text-[10px] space-y-0.5 shadow-sm">
        <div className="font-bold text-foreground mb-0.5">{data.city}</div>
        <LegendDot color="#f1f5f9" border="#94a3b8" label="Disponível" />
        <LegendDot color="#22c55e" label="Seu" />
        <LegendDot color="#ef4444" label="Outro player" />
        <LegendDot color="#fbbf24" label="Casa" />
        <LegendDot color="#3b82f6" label="Comércio" />
      </div>

      {/* Hint */}
      <div className="absolute top-2 left-2 bg-white/85 backdrop-blur rounded-[8px] px-2 py-1 text-[10px] text-muted-foreground">
        Arraste pra mover · scroll/pinch pra zoom · clique no lote
      </div>
    </div>
  );
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function LegendDot({ color, border, label }: { color: string; border?: string; label: string }) {
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
