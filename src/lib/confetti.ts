import confetti from "canvas-confetti";

export const triggerMilestoneConfetti = () => {
  // First burst from center
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors: ["#FFD700", "#FFA500", "#FF6347", "#32CD32", "#4169E1"],
  });

  // Delayed side bursts
  setTimeout(() => {
    confetti({
      particleCount: 50,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.6 },
      colors: ["#FFD700", "#FFA500", "#FF6347"],
    });
  }, 150);

  setTimeout(() => {
    confetti({
      particleCount: 50,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.6 },
      colors: ["#32CD32", "#4169E1", "#FFD700"],
    });
  }, 300);
};

export const triggerHafizConfetti = () => {
  const duration = 2000;
  const end = Date.now() + duration;

  const colors = ["#22c55e", "#16a34a", "#FFD700", "#FFA500"];

  (function frame() {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.7 },
      colors: colors,
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.7 },
      colors: colors,
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  })();

  // Big center burst
  setTimeout(() => {
    confetti({
      particleCount: 150,
      spread: 100,
      origin: { y: 0.5 },
      colors: colors,
      scalar: 1.2,
    });
  }, 200);
};

// High attendance (90-99%) - green themed celebration
export const triggerHighAttendanceConfetti = () => {
  const colors = ["#22c55e", "#16a34a", "#4ade80", "#86efac"];

  confetti({
    particleCount: 80,
    spread: 60,
    origin: { y: 0.6 },
    colors: colors,
  });

  setTimeout(() => {
    confetti({
      particleCount: 40,
      angle: 60,
      spread: 50,
      origin: { x: 0, y: 0.65 },
      colors: colors,
    });
    confetti({
      particleCount: 40,
      angle: 120,
      spread: 50,
      origin: { x: 1, y: 0.65 },
      colors: colors,
    });
  }, 200);
};

// Perfect attendance (100%) - gold and rainbow spectacular
export const triggerPerfectAttendanceConfetti = () => {
  const duration = 3000;
  const end = Date.now() + duration;

  // Gold and rainbow colors for perfection
  const goldColors = ["#FFD700", "#FFC107", "#FFEB3B", "#FFE082"];
  const rainbowColors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD"];

  // Initial golden burst
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.5 },
    colors: goldColors,
    scalar: 1.3,
  });

  // Stars effect
  confetti({
    particleCount: 30,
    spread: 360,
    origin: { y: 0.5, x: 0.5 },
    colors: goldColors,
    shapes: ["star"],
    scalar: 1.5,
  });

  // Continuous rainbow streams from sides
  (function frame() {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 45,
      origin: { x: 0, y: 0.6 },
      colors: rainbowColors,
      scalar: 1.1,
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 45,
      origin: { x: 1, y: 0.6 },
      colors: rainbowColors,
      scalar: 1.1,
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  })();

  // Second golden burst
  setTimeout(() => {
    confetti({
      particleCount: 80,
      spread: 100,
      origin: { y: 0.4 },
      colors: goldColors,
      shapes: ["star", "circle"],
      scalar: 1.4,
    });
  }, 500);

  // Final celebration burst
  setTimeout(() => {
    confetti({
      particleCount: 120,
      spread: 120,
      origin: { y: 0.55 },
      colors: [...goldColors, ...rainbowColors],
      scalar: 1.2,
    });
  }, 1200);
};