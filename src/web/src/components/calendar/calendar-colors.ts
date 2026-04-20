export function agentColor(agentId: string): string {
  const palette = [
    "bg-[oklch(0.78_0.08_60)] text-[oklch(0.25_0.05_60)]",
    "bg-[oklch(0.80_0.07_120)] text-[oklch(0.25_0.05_120)]",
    "bg-[oklch(0.80_0.06_220)] text-[oklch(0.25_0.05_220)]",
    "bg-[oklch(0.80_0.07_30)] text-[oklch(0.25_0.05_30)]",
    "bg-[oklch(0.80_0.06_280)] text-[oklch(0.25_0.05_280)]",
    "bg-[oklch(0.80_0.07_160)] text-[oklch(0.25_0.05_160)]",
  ];
  let h = 0;
  for (let i = 0; i < agentId.length; i++) h = (h * 31 + agentId.charCodeAt(i)) | 0;
  return palette[Math.abs(h) % palette.length]!;
}

export function agentDot(agentId: string): string {
  const palette = [
    "bg-[oklch(0.62_0.13_60)] dark:bg-[oklch(0.72_0.11_60)]",
    "bg-[oklch(0.62_0.12_120)] dark:bg-[oklch(0.72_0.10_120)]",
    "bg-[oklch(0.62_0.12_220)] dark:bg-[oklch(0.72_0.10_220)]",
    "bg-[oklch(0.62_0.13_30)] dark:bg-[oklch(0.72_0.11_30)]",
    "bg-[oklch(0.62_0.12_280)] dark:bg-[oklch(0.72_0.10_280)]",
    "bg-[oklch(0.62_0.12_160)] dark:bg-[oklch(0.72_0.10_160)]",
  ];
  let h = 0;
  for (let i = 0; i < agentId.length; i++) h = (h * 31 + agentId.charCodeAt(i)) | 0;
  return palette[Math.abs(h) % palette.length]!;
}

export function agentInk(agentId: string): string {
  const palette = [
    "text-[oklch(0.52_0.14_60)] dark:text-[oklch(0.78_0.11_60)]",
    "text-[oklch(0.52_0.13_120)] dark:text-[oklch(0.78_0.10_120)]",
    "text-[oklch(0.52_0.13_220)] dark:text-[oklch(0.78_0.10_220)]",
    "text-[oklch(0.52_0.14_30)] dark:text-[oklch(0.78_0.11_30)]",
    "text-[oklch(0.52_0.13_280)] dark:text-[oklch(0.78_0.10_280)]",
    "text-[oklch(0.52_0.13_160)] dark:text-[oklch(0.78_0.10_160)]",
  ];
  let h = 0;
  for (let i = 0; i < agentId.length; i++) h = (h * 31 + agentId.charCodeAt(i)) | 0;
  return palette[Math.abs(h) % palette.length]!;
}
