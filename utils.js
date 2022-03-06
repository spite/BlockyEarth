import { projection, MERCATOR_RANGE } from "./Mercator.js";

function calculateTileFromLatLng(pos, zoom) {
  const zoom2 = Math.pow(2, zoom);
  const worldCoordinate = projection.fromLatLngToPoint(pos);
  const pixelCoordinate = new google.maps.Point(
    worldCoordinate.x * zoom2,
    worldCoordinate.y * zoom2
  );
  const tileCoordinate = new google.maps.Point(
    Math.floor(pixelCoordinate.x / MERCATOR_RANGE),
    Math.floor(pixelCoordinate.y / MERCATOR_RANGE)
  );

  if (tileCoordinate.x < 0) tileCoordinate.x += zoom2;
  tileCoordinate.x %= zoom2;
  if (tileCoordinate.y < 0) tileCoordinate.y += zoom2;
  tileCoordinate.y %= zoom2;

  return { x: tileCoordinate.x, y: tileCoordinate.y };
}

export { calculateTileFromLatLng };
