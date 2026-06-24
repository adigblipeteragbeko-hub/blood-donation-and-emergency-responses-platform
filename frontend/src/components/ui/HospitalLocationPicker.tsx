import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ENGLISH_FRIENDLY_TILE_ATTRIBUTION, ENGLISH_FRIENDLY_TILE_URL } from '../../constants/map-tiles';

const GHANA_CENTER: [number, number] = [7.9465, -1.0232];

const hospitalPinIcon = L.divIcon({
  className: 'live-map-marker',
  html: '<span style="background:#0f766e">H</span>',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

function PickerPin({
  selectedPosition,
  onSelect,
}: {
  selectedPosition: [number, number] | null;
  onSelect: (latitude: number, longitude: number) => void;
}) {
  const markerPosition = selectedPosition ?? GHANA_CENTER;

  useMapEvents({
    click(event) {
      onSelect(event.latlng.lat, event.latlng.lng);
    },
  });

  return (
    <Marker
      draggable
      eventHandlers={{
        dragend(event) {
          const next = event.target.getLatLng();
          onSelect(next.lat, next.lng);
        },
      }}
      icon={hospitalPinIcon}
      position={markerPosition}
    />
  );
}

type HospitalLocationPickerProps = {
  latitude: number | null;
  longitude: number | null;
  onChange: (latitude: number, longitude: number) => void;
  className?: string;
};

export function HospitalLocationPicker({ latitude, longitude, onChange, className }: HospitalLocationPickerProps) {
  const selectedPosition =
    typeof latitude === 'number' && typeof longitude === 'number' ? ([latitude, longitude] as [number, number]) : null;
  const mapCenter = selectedPosition ?? GHANA_CENTER;

  return (
    <div className={className ?? 'h-64 w-full'}>
      <MapContainer center={mapCenter} className="h-full w-full rounded-xl" scrollWheelZoom zoom={selectedPosition ? 13 : 7}>
        <TileLayer attribution={ENGLISH_FRIENDLY_TILE_ATTRIBUTION} url={ENGLISH_FRIENDLY_TILE_URL} />
        <PickerPin
          selectedPosition={selectedPosition}
          onSelect={(nextLat, nextLng) => {
            onChange(Number(nextLat.toFixed(6)), Number(nextLng.toFixed(6)));
          }}
        />
      </MapContainer>
    </div>
  );
}

