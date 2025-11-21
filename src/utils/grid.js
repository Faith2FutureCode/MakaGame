export function buildCoarseBlocks(mask, width, height, cellSize) {
  const size = Math.max(1, Math.floor(cellSize) || 1);
  const cols = Math.ceil(width / size);
  const rows = Math.ceil(height / size);
  const coarseMask = new Uint8Array(cols * rows);
  for(let y = 0; y < height; y++){
    const rowIndex = y * width;
    const cy = Math.floor(y / size);
    for(let x = 0; x < width; x++){
      if(mask[rowIndex + x]){
        const cx = Math.floor(x / size);
        coarseMask[cy * cols + cx] = 1;
      }
    }
  }
  return { cellSize: size, cols, rows, mask: coarseMask };
}

export function buildNavGrid(coarse, width, height, cellSize) {
  const size = Math.max(1, Math.floor(cellSize) || 1);
  const cols = Math.ceil(width / size);
  const rows = Math.ceil(height / size);
  const grid = new Uint8Array(cols * rows);
  for(let cy = 0; cy < rows; cy++){
    for(let cx = 0; cx < cols; cx++){
      const worldX = cx * size + size * 0.5;
      const worldY = cy * size + size * 0.5;
      const coarseCx = Math.floor(worldX / coarse.cellSize);
      const coarseCy = Math.floor(worldY / coarse.cellSize);
      const coarseIdx = coarseCy * coarse.cols + coarseCx;
      grid[cy * cols + cx] = coarse.mask[coarseIdx] ? 1 : 0;
    }
  }
  return { cellSize: size, cols, rows, mask: grid };
}
