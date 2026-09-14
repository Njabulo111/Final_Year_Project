import { MapContainer, TileLayer, Circle, Popup, Marker, Tooltip } from 'react-leaflet';
import { Airport, AccessPoint } from '../types/wifi';
import 'leaflet/dist/leaflet.css';

interface AirportMapProps {
  airport: Airport;
  accessPoints: AccessPoint[];
}

const statusColors = {
  excellent: '#10b981',
  good: '#3b82f6',
  fair: '#f59e0b',
  poor: '#ef4444',
};

export function AirportMap({ airport, accessPoints }: AirportMapProps) {
  const nmToMeters = (nm: number) => nm * 1852;

  return (
    <div className="w-full h-96 rounded-lg overflow-hidden border border-[rgb(var(--color-border))]">
      <MapContainer
        center={[airport.coordinates.latitude, airport.coordinates.longitude]}
        zoom={10}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
        />

        {accessPoints.map((ap) => (
          <Circle
            key={ap.id}
            center={[ap.coordinates.latitude, ap.coordinates.longitude]}
            radius={nmToMeters(ap.rangeNM)}
            fillColor={statusColors[ap.status]}
            weight={2}
            opacity={0.3}
            fillOpacity={0.1}
            color={statusColors[ap.status]}
          >
            <Popup>
              <div className="space-y-1 text-sm">
                <p className="font-semibold">{ap.ssid}</p>
                <p>Callsign: {ap.bssid}</p>
                <p>Freq: {ap.frequency} MHz</p>
                <p>Signal: {ap.signal.toFixed(0)} dBm</p>
                <p>Score: {ap.score}</p>
              </div>
            </Popup>
            <Tooltip direction="top" offset={[0, -10]} opacity={1}>
              {ap.ssid}
            </Tooltip>
          </Circle>
        ))}

        {accessPoints.map((ap) => (
          <Marker
            key={`marker-${ap.id}`}
            position={[ap.coordinates.latitude, ap.coordinates.longitude]}
          >
            <Popup>
              <div className="space-y-2 text-sm">
                <h3 className="font-semibold">{ap.ssid}</h3>
                <div className="space-y-1">
                  <p>Callsign: {ap.bssid}</p>
                  <p>Frequency: {ap.frequency} MHz</p>
                  <p>Signal: {ap.signal.toFixed(0)} dBm</p>
                  <p>Latency: {ap.latency.toFixed(1)} ms</p>
                  <p>Packet Loss: {ap.packetLoss.toFixed(2)}%</p>
                  <p>Score: {ap.score}</p>
                  <p className="font-medium">Status: {ap.status.toUpperCase()}</p>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        <Marker position={[airport.coordinates.latitude, airport.coordinates.longitude]}>
          <Popup>
            <div className="space-y-1">
              <p className="font-semibold">{airport.name}</p>
              <p className="text-sm">Code: {airport.code}</p>
              <p className="text-sm">Elevation: {airport.elevation} ft</p>
            </div>
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
