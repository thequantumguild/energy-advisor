import { NextRequest, NextResponse } from 'next/server';

// Proxies a Google Solar Data Layers GeoTIFF back to the client.
// The API key never leaves the server.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const type = searchParams.get('type') ?? 'annual'; // annual | monthly | mask | rgb

  if (!lat || !lng) {
    return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });
  }

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  try {
    // Step 1: get the Data Layers manifest to find the GeoTIFF URLs
    const layersUrl =
      `https://solar.googleapis.com/v1/dataLayers:get` +
      `?location.latitude=${lat}&location.longitude=${lng}` +
      `&radiusMeters=50&pixelSizeMeters=0.5` +
      `&key=${key}`;

    const layersRes = await fetch(layersUrl);
    if (!layersRes.ok) {
      return NextResponse.json({ error: 'Data layers unavailable' }, { status: 502 });
    }
    const layers = await layersRes.json();

    // Step 2: pick the right URL
    const urlMap: Record<string, string | undefined> = {
      annual:  layers.annualFluxUrl,
      monthly: layers.monthlyFluxUrl,
      mask:    layers.maskUrl,
      rgb:     layers.rgbUrl,
    };
    const targetUrl = urlMap[type];
    if (!targetUrl) {
      return NextResponse.json({ error: `No URL for type: ${type}` }, { status: 404 });
    }

    // Step 3: fetch the GeoTIFF with the server-side key
    const tiffUrl = targetUrl.includes('?')
      ? `${targetUrl}&key=${key}`
      : `${targetUrl}?key=${key}`;

    const tiffRes = await fetch(tiffUrl);
    if (!tiffRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch GeoTIFF' }, { status: 502 });
    }

    const tiffBuffer = await tiffRes.arrayBuffer();

    // Also return the bounds so the client can position the overlay
    const bb = layers.boundingBox;
    const bounds = bb ? {
      north: bb.ne?.latitude,
      south: bb.sw?.latitude,
      east:  bb.ne?.longitude,
      west:  bb.sw?.longitude,
    } : null;

    // Return the raw GeoTIFF binary with bounds in a header
    return new NextResponse(tiffBuffer, {
      headers: {
        'Content-Type': 'image/tiff',
        'Cache-Control': 'public, max-age=86400',
        'X-Flux-Bounds': bounds ? JSON.stringify(bounds) : '',
      },
    });
  } catch (err) {
    console.error('[fluxmap] error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
