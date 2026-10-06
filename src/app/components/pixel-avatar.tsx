interface PixelAvatarProps {
  address: string;
  size?: number;
  className?: string;
}

// Ethereum Blockies-style seeded PRNG
function createBlockiesData(address: string) {
  const seed = address.toLowerCase();

  // xorshift-based PRNG seeded from address
  const seedArr = new Array(4).fill(0);
  for (let i = 0; i < seed.length; i++) {
    seedArr[i % 4] = (seedArr[i % 4] << 5) - seedArr[i % 4] + seed.charCodeAt(i);
  }

  const rand = () => {
    const t = seedArr[0] ^ (seedArr[0] << 11);
    seedArr[0] = seedArr[1];
    seedArr[1] = seedArr[2];
    seedArr[2] = seedArr[3];
    seedArr[3] = seedArr[3] ^ (seedArr[3] >> 19) ^ t ^ (t >> 8);
    return (seedArr[3] >>> 0) / ((1 << 31) >>> 0);
  };

  const createColor = () => {
    const h = Math.floor(rand() * 360);
    const s = 40 + Math.floor(rand() * 60);
    const l = (rand() > 0.5 ? 35 : 55) + Math.floor(rand() * 10);
    return `hsl(${h}, ${s}%, ${l}%)`;
  };

  const bgColor = createColor();
  const mainColor = createColor();
  const spotColor = createColor();

  const grid = 8;
  const half = Math.ceil(grid / 2);
  const data: number[] = [];

  for (let row = 0; row < grid; row++) {
    const rowData: number[] = [];
    for (let col = 0; col < half; col++) {
      const val = Math.floor(rand() * 2.3);
      rowData.push(val);
    }
    // Mirror to create symmetric pattern
    const fullRow = [...rowData];
    for (let col = half - 1; col >= 0; col--) {
      fullRow.push(rowData[col]);
    }
    data.push(...fullRow);
  }

  return { bgColor, mainColor, spotColor, data, grid };
}

export function PixelAvatar({ address, size = 32, className = "" }: PixelAvatarProps) {
  const { bgColor, mainColor, spotColor, data, grid } = createBlockiesData(address || "0x0000");
  const pixelSize = size / grid;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ borderRadius: "50%" }}
    >
      {/* Background */}
      <rect width={size} height={size} fill={bgColor} />
      {/* Pixels */}
      {data.map((val, i) => {
        if (val === 0) return null;
        const row = Math.floor(i / grid);
        const col = i % grid;
        return (
          <rect
            key={`${col}-${row}`}
            x={col * pixelSize}
            y={row * pixelSize}
            width={pixelSize}
            height={pixelSize}
            fill={val === 1 ? mainColor : spotColor}
          />
        );
      })}
    </svg>
  );
}
