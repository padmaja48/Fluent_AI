const ANALYSIS_WIDTH = 160;

const luminance = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

const isSkinPixel = (r, g, b) => {
  if (r < 60 || g < 40 || b < 20) return false;
  if (r > 250 && g > 250 && b > 250) return false;
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  return cr > 133 && cr < 173 && cb > 77 && cb < 127;
};

export function drawVideoFrame(video, canvas) {
  if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
    return null;
  }

  const height = Math.max(90, Math.round((video.videoHeight / video.videoWidth) * ANALYSIS_WIDTH));
  canvas.width = ANALYSIS_WIDTH;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, ANALYSIS_WIDTH, height);
  return ctx.getImageData(0, 0, ANALYSIS_WIDTH, height);
}

const analyzeSkinPeaks = (data, width, height) => {
  const colSkin = new Float32Array(width);
  const rowSkin = new Float32Array(height);
  const yStart = Math.floor(height * 0.06);
  const yEnd = Math.floor(height * 0.94);

  for (let y = yStart; y < yEnd; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      if (!isSkinPixel(data[i], data[i + 1], data[i + 2])) continue;
      colSkin[x] += 1;
      rowSkin[y] += 1;
    }
  }

  const countPeaks = (values, threshold, minWidth) => {
    let peaks = 0;
    let inPeak = false;
    let widthCount = 0;
    const widths = [];

    for (let index = 0; index < values.length; index += 1) {
      if (values[index] >= threshold) {
        widthCount += 1;
        if (!inPeak) {
          peaks += 1;
          inPeak = true;
        }
      } else if (inPeak) {
        widths.push(widthCount);
        widthCount = 0;
        inPeak = false;
      }
    }
    if (inPeak) widths.push(widthCount);

    return widths.filter(value => value >= minWidth).length;
  };

  const colThreshold = Math.max(4, height * 0.07);
  const rowThreshold = Math.max(4, width * 0.08);
  const horizontalPeaks = countPeaks(colSkin, colThreshold, Math.max(5, width * 0.05));
  const verticalPeaks = countPeaks(rowSkin, rowThreshold, Math.max(4, height * 0.08));

  const leftBound = Math.floor(width * 0.38);
  const rightBound = Math.floor(width * 0.62);
  let leftSkin = 0;
  let centerSkin = 0;
  let rightSkin = 0;

  for (let x = 0; x < width; x += 1) {
    if (colSkin[x] <= 0) continue;
    if (x < leftBound) leftSkin += colSkin[x];
    else if (x >= rightBound) rightSkin += colSkin[x];
    else centerSkin += colSkin[x];
  }

  const minSideSkin = Math.max(6, height * 0.08);
  const splitCandidate =
    leftSkin >= minSideSkin &&
    rightSkin >= minSideSkin &&
    centerSkin <= Math.max(leftSkin, rightSkin) * 0.85;

  return {
    horizontalPeaks,
    verticalPeaks,
    estimatedPeople: Math.max(
      horizontalPeaks,
      verticalPeaks >= 2 ? 2 : 0,
      splitCandidate ? 2 : 0,
    ),
  };
};

const floodCluster = (start, cells) => {
  const key = (cell) => `${cell.gx},${cell.gy}`;
  const lookup = new Map(cells.map(cell => [key(cell), cell]));
  const visited = new Set();
  const queue = [start];
  const cluster = [];

  while (queue.length > 0) {
    const cell = queue.pop();
    const cellKey = key(cell);
    if (visited.has(cellKey)) continue;
    visited.add(cellKey);
    cluster.push(cell);

    [
      [cell.gx - 1, cell.gy],
      [cell.gx + 1, cell.gy],
      [cell.gx, cell.gy - 1],
      [cell.gx, cell.gy + 1],
    ].forEach(([gx, gy]) => {
      const neighbor = lookup.get(`${gx},${gy}`);
      if (neighbor) queue.push(neighbor);
    });
  }

  return cluster;
};

const detectPhoneScreen = (data, width, height) => {
  const gridCols = 10;
  const gridRows = 8;
  const cellW = width / gridCols;
  const cellH = height / gridRows;
  const cells = [];

  for (let gy = 0; gy < gridRows; gy += 1) {
    for (let gx = 0; gx < gridCols; gx += 1) {
      const x0 = Math.floor(gx * cellW);
      const y0 = Math.floor(gy * cellH);
      const x1 = Math.min(width, Math.floor((gx + 1) * cellW));
      const y1 = Math.min(height, Math.floor((gy + 1) * cellH));

      let sum = 0;
      let sumSquared = 0;
      let count = 0;
      let bright = 0;
      let skin = 0;
      let colorful = 0;

      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const i = (y * width + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const l = luminance(r, g, b);
          sum += l;
          sumSquared += l * l;
          count += 1;
          if (l > 165) bright += 1;
          if (isSkinPixel(r, g, b)) skin += 1;
          if (Math.max(r, g, b) - Math.min(r, g, b) > 28) colorful += 1;
        }
      }

      if (count === 0) continue;
      const mean = sum / count;
      const variance = sumSquared / count - mean * mean;
      cells.push({
        gx,
        gy,
        mean,
        variance,
        brightRatio: bright / count,
        skinRatio: skin / count,
        colorfulRatio: colorful / count,
      });
    }
  }

  const screenCells = cells.filter(cell =>
    cell.mean > 145 &&
    cell.variance < 1800 &&
    cell.brightRatio > 0.35 &&
    cell.skinRatio < 0.3 &&
    cell.colorfulRatio > 0.08,
  );

  if (screenCells.length >= 2) {
    for (const cell of screenCells) {
      const cluster = floodCluster(cell, screenCells);
      const areaRatio = cluster.length / (gridCols * gridRows);
      if (cluster.length >= 2 && areaRatio >= 0.035 && areaRatio <= 0.5) {
        return true;
      }
    }
  }

  const darkFrameCells = cells.filter(cell =>
    cell.mean >= 35 &&
    cell.mean <= 120 &&
    cell.variance < 2400 &&
    cell.skinRatio < 0.2,
  );

  return screenCells.some(screen =>
    darkFrameCells.some(frame =>
      Math.abs(screen.gx - frame.gx) <= 1 && Math.abs(screen.gy - frame.gy) <= 1,
    ),
  ) && screenCells.length >= 2;
};

const detectFaces = async (video) => {
  if (!('FaceDetector' in window)) return null;
  try {
    const detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 5 });
    return await detector.detect(video);
  } catch {
    return null;
  }
};

export async function analyzeProctorFrame(video, canvas) {
  const image = drawVideoFrame(video, canvas);
  if (!image) {
    return {
      ready: false,
      detected: false,
      faceCount: 0,
      multiplePeople: false,
      phoneDetected: false,
      method: 'camera',
      reason: 'Camera feed is not ready.',
    };
  }

  const { data, width, height } = image;
  const faces = await detectFaces(video);
  const faceCount = faces?.length ?? 0;
  const { horizontalPeaks, estimatedPeople } = analyzeSkinPeaks(data, width, height);
  const phoneDetected = detectPhoneScreen(data, width, height);

  let skinSamples = 0;
  let skinHits = 0;
  let luminanceTotal = 0;
  let luminanceSquared = 0;
  let samples = 0;

  for (let i = 0; i < data.length; i += 16) {
    samples += 1;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const l = luminance(r, g, b);
    luminanceTotal += l;
    luminanceSquared += l * l;
    if (isSkinPixel(r, g, b)) {
      skinHits += 1;
      skinSamples += 1;
    }
  }

  const skinRatio = skinHits / Math.max(1, samples);
  const meanL = luminanceTotal / Math.max(1, samples);
  const variance = luminanceSquared / Math.max(1, samples) - meanL * meanL;
  const heuristicPeople = Math.max(estimatedPeople, horizontalPeaks);
  const multiplePeople = faceCount > 1 || heuristicPeople >= 2;
  const detected = faceCount >= 1 || skinRatio > 0.035 || (meanL > 18 && meanL < 242 && variance > 12);

  let reason = '';
  if (multiplePeople) {
    const count = faceCount > 1 ? faceCount : heuristicPeople;
    reason = `${count} people appear to be visible. Only the candidate should be on camera.`;
  } else if (phoneDetected) {
    reason = 'A mobile phone was detected in the camera view. Remove it before continuing.';
  } else if (!detected) {
    reason = 'No person detected in camera view.';
  }

  return {
    ready: true,
    detected,
    faceCount: faceCount > 0 ? faceCount : (detected ? 1 : 0),
    multiplePeople,
    phoneDetected,
    method: faceCount > 0 ? 'face' : 'camera',
    reason,
    skinRatio,
    heuristicPeople,
  };
}

/** @deprecated Use analyzeProctorFrame */
export async function detectPersonPresence(video, canvas) {
  const result = await analyzeProctorFrame(video, canvas);
  return result;
}
