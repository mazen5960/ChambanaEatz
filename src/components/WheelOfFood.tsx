import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  items: string[];
  onPick: (name: string) => void;
}

const WheelOfFood = ({ items, onPick }: Props) => {
  const [spinning, setSpinning] = useState(false);
  const [angle, setAngle] = useState(0);
  const wheelRef = useRef<HTMLDivElement | null>(null);

  // User-added choices for the spinner
  const [customItems, setCustomItems] = useState<string[]>([]);
  const [newItem, setNewItem] = useState("");

  const allItems = useMemo(() => {
    const merged = [...items, ...customItems].map((s) => s.trim()).filter(Boolean);
    return merged;
  }, [items, customItems]);

  const colors = [
    "hsl(var(--accent))",
    "hsl(var(--secondary))",
    "hsl(var(--accent))",
    "hsl(var(--secondary))",
  ];

  const gradient = useMemo(() => {
    const n = Math.max(allItems.length, 1);
    const step = 360 / n;
    let parts: string[] = [];
    for (let i = 0; i < n; i++) {
      const c = colors[i % colors.length];
      parts.push(`${c} ${i * step}deg ${(i + 1) * step}deg`);
    }
    return `conic-gradient(${parts.join(", ")})`;
  }, [allItems]);

  const spin = () => {
    if (!allItems.length) return;
    setSpinning(true);
    // spin 3–5 turns + random end
    const end = angle + 360 * (3 + Math.floor(Math.random() * 3)) + Math.floor(Math.random() * 360);
    setAngle(end);
    setTimeout(() => {
      setSpinning(false);
      const normalized = ((end % 360) + 360) % 360;
      const idx = Math.floor(((360 - normalized) % 360) / (360 / allItems.length));
      const pick = allItems[idx];
      onPick(pick);
    }, 2500);
  };

  return (
    <section aria-label="Wheel of Food" className="w-full">
      <div className="rounded-xl border bg-card p-6 shadow-elevated">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Wheel of Food</h2>
          <Button variant="wheel" onClick={spin} disabled={spinning}>
            {spinning ? "Spinning..." : "Spin"}
          </Button>
        </div>
        <div className="mx-auto grid place-items-center">
          <div
            ref={wheelRef}
            className="relative size-60 sm:size-72 rounded-full border"
            style={{
              background: gradient,
              transform: `rotate(${angle}deg)`,
              transition: spinning ? "transform 2.5s cubic-bezier(0.22, 1, 0.36, 1)" : undefined,
              boxShadow: "var(--shadow-elevated)",
            }}
          >
            <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/3">
              <div className="size-0 border-l-8 border-r-8 border-b-[14px] border-l-transparent border-r-transparent" style={{ borderBottomColor: "hsl(var(--primary))" }} />
            </div>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Spin to break the tie!</p>
          <div className="mt-4 flex w-full max-w-sm items-center gap-2">
            <Input
              placeholder="Add a choice (e.g., Tacos)"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              aria-label="Add spinner choice"
            />
            <Button
              variant="outline"
              onClick={() => {
                const v = newItem.trim();
                if (!v) return;
                setCustomItems((prev) => [...prev, v]);
                setNewItem("");
              }}
              disabled={spinning}
            >
              Add
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WheelOfFood;
