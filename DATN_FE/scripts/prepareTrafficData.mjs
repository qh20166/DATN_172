import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const csvPath = path.resolve(rootDir, 'asset', 'traffic_weather_latest.csv');
const geometryPath = path.resolve(rootDir, 'asset', 'geometry.csv');
const outputPath = path.resolve(rootDir, 'public', 'traffic_summary.json');

const MAX_SEGMENTS = 1600;

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function clamp01(value) {
  return Math.max(0, Math.min(value, 1));
}

function computeCongestionScore(row) {
  const congestionIndex = Number(row.congestionIndex) || 0;
  const jamFactor = Number(row.jamFactor) || 0;
  const speedLimitRatio = Number(row.speedLimitRatio) || 0;
  const relativeCongestionIndex = Number(row.relativeCongestionIndex) || 0;

  const normalizedJam = clamp01(jamFactor / 10);
  const normalizedSpeedPenalty = 1 - clamp01(speedLimitRatio);

  return clamp01(
    (congestionIndex * 0.45)
      + (normalizedJam * 0.2)
      + (normalizedSpeedPenalty * 0.2)
      + (relativeCongestionIndex * 0.15),
  );
}

function classify(score) {
  if (score < 0.45) {
    return 'smooth';
  }
  if (score < 0.7) {
    return 'slow';
  }
  return 'heavy';
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeText(value, fallback = 'N/A') {
  return value && String(value).trim() ? value : fallback;
}

function randomId() {
  return `segment_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeStreetName(value) {
  return safeText(value, '').trim().toLocaleLowerCase('vi-VN');
}

function toLatLonPair(rawPair) {
  const [latRaw, lonRaw] = String(rawPair).split(',');
  const lat = Number(latRaw);
  const lon = Number(lonRaw);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  return [lat, lon];
}

function parseGeometry(fullGeometry) {
  if (!fullGeometry) {
    return [];
  }

  return String(fullGeometry)
    .split(';')
    .map((pair) => toLatLonPair(pair))
    .filter(Boolean);
}

function haversineMeters([lat1, lon1], [lat2, lon2]) {
  const radius = 6371000;
  const toRadians = (value) => (value * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(a));
}

function readGeometryLookup() {
  if (!fs.existsSync(geometryPath)) {
    return new Map();
  }

  const raw = fs.readFileSync(geometryPath, 'utf8');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) {
    return new Map();
  }

  const headers = parseCsvLine(lines[0]);
  const byStreet = new Map();

  lines.slice(1).forEach((line) => {
    const values = parseCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });

    const name = normalizeStreetName(row.street_name);
    const geometry = parseGeometry(row.full_geometry);
    if (!name || geometry.length < 2) {
      return;
    }

    const entry = {
      name,
      geometry,
      start: [toNumber(row.lat_snode), toNumber(row.long_snode)],
      end: [toNumber(row.lat_enode), toNumber(row.long_enode)],
    };

    if (!byStreet.has(name)) {
      byStreet.set(name, []);
    }
    byStreet.get(name).push(entry);
  });

  return byStreet;
}

function pickGeometryForSegment(segment, geometryLookup) {
  const key = normalizeStreetName(segment.name);
  const candidates = geometryLookup.get(key) || [];

  if (!candidates.length) {
    return null;
  }

  const segmentStart = [segment.latStart, segment.lonStart];
  const segmentEnd = [segment.latEnd, segment.lonEnd];

  let best = null;

  candidates.forEach((candidate) => {
    const points = candidate.geometry;
    const first = points[0];
    const last = points[points.length - 1];

    const forward = haversineMeters(segmentStart, first) + haversineMeters(segmentEnd, last);
    const backward = haversineMeters(segmentStart, last) + haversineMeters(segmentEnd, first);

    const score = Math.min(forward, backward);
    const orientedGeometry = backward < forward ? [...points].reverse() : points;

    if (!best || score < best.score) {
      best = {
        score,
        geometry: orientedGeometry,
      };
    }
  });

  if (!best) {
    return null;
  }

  // Skip bad matches when street names collide but endpoints are far away.
  if (best.score > 1200) {
    return null;
  }

  return best.geometry;
}

function run() {
  if (!fs.existsSync(csvPath)) {
    throw new Error(`Không tìm thấy file dữ liệu: ${csvPath}`);
  }

  const geometryLookup = readGeometryLookup();

  const raw = fs.readFileSync(csvPath, 'utf8');
  const lines = raw.split(/\r?\n/).filter(Boolean);

  if (lines.length < 2) {
    throw new Error('File CSV không có dữ liệu');
  }

  const headers = parseCsvLine(lines[0]);
  const records = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });
    return row;
  });

  const latestTimeStamp = records[records.length - 1].weather_date || records[records.length - 1].timeStamp;
  const latest = records.filter((row) => (row.weather_date || row.timeStamp) === latestTimeStamp);

  const baseRows = latest.length > 0 ? latest : records.slice(-MAX_SEGMENTS);

  const segments = baseRows.slice(0, MAX_SEGMENTS).map((row) => {
    const score = computeCongestionScore(row);
    const level = classify(score);

    const segment = {
      id: safeText(row.segmentId, randomId()),
      name: safeText(row.name_vn, 'Đường chưa đặt tên'),
      latStart: toNumber(row.lat_start),
      lonStart: toNumber(row.lon_start),
      latEnd: toNumber(row.lat_end),
      lonEnd: toNumber(row.lon_end),
      currentSpeed: toNumber(row.currentSpeed),
      freeFlowSpeed: toNumber(row.freeFlowSpeed),
      trafficVolume: toNumber(row.trafficVolume),
      score,
      level,
      weatherDescription: safeText(row.weather_description, 'Không rõ'),
      temperatureMax: toNumber(row.temperature_2m_max),
      precipitation: toNumber(row.precipitation_sum),
      dayType: safeText(row.dayType),
      hourOfDay: toNumber(row.hourOfDay),
    };

    const geometry = pickGeometryForSegment(segment, geometryLookup);
    if (geometry?.length >= 2) {
      segment.geometry = geometry;
    }

    return segment;
  }).filter((segment) => segment.latStart && segment.lonStart && segment.latEnd && segment.lonEnd);

  const summaryByLevel = {
    smooth: 0,
    slow: 0,
    heavy: 0,
    smoothTotalScore: 0,
    slowTotalScore: 0,
    heavyTotalScore: 0,
  };

  let totalScore = 0;
  let totalTemp = 0;
  let totalPrecipitation = 0;

  segments.forEach((segment) => {
    summaryByLevel[segment.level] += 1;
    summaryByLevel[`${segment.level}TotalScore`] += segment.score;
    totalScore += segment.score;
    totalTemp += segment.temperatureMax;
    totalPrecipitation += segment.precipitation;
  });

  const count = segments.length || 1;
  const output = {
    generatedAt: new Date().toISOString(),
    sourceFile: 'asset/traffic_weather_latest.csv',
    timeStamp: latestTimeStamp,
    totalSegments: segments.length,
    matchedGeometrySegments: segments.filter((segment) => Array.isArray(segment.geometry) && segment.geometry.length >= 2).length,
    avgScore: totalScore / count,
    avgMaxTemperature: totalTemp / count,
    avgPrecipitation: totalPrecipitation / count,
    summaryByLevel: {
      smooth: summaryByLevel.smooth,
      slow: summaryByLevel.slow,
      heavy: summaryByLevel.heavy,
      smoothAvgScore: summaryByLevel.smooth ? summaryByLevel.smoothTotalScore / summaryByLevel.smooth : 0,
      slowAvgScore: summaryByLevel.slow ? summaryByLevel.slowTotalScore / summaryByLevel.slow : 0,
      heavyAvgScore: summaryByLevel.heavy ? summaryByLevel.heavyTotalScore / summaryByLevel.heavy : 0,
    },
    hotspots: [...segments]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10),
    segments,
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  process.stdout.write(`Da tao: ${outputPath}\n`);
}

run();
