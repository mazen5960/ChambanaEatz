import { useState } from "react";
import { Button } from "@/components/ui/button";

import { Preferences } from "@/types/restaurant";

interface Props {
  onComplete: (prefs: Preferences) => void;
}

const QuickPreferences = ({ onComplete }: Props) => {
  const [step, setStep] = useState(0);
  const [prefs, setPrefs] = useState<Preferences>({});

  const steps = [
    {
      title: "Cuisine vibe?",
      options: [
        { key: "asian", label: "Asian" },
        { key: "mexican", label: "Mexican" },
        { key: "italian", label: "Italian" },
        { key: "american", label: "American" },
        { key: "surprise", label: "Surprise me" },
      ] as const,
      onPick: (key: Preferences["cuisinePref"]) =>
        setPrefs((p) => ({ ...p, cuisinePref: key })),
    },
    {
      title: "How are we eating?",
      options: [
        { key: "dine-in", label: "Dine-in" },
        { key: "delivery", label: "Delivery" },
      ] as const,
      onPick: (key: Preferences["mode"]) => setPrefs((p) => ({ ...p, mode: key })),
    },
    {
      title: "Dress code?",
      options: [
        { key: "casual", label: "Casual" },
        { key: "nice", label: "Nice" },
      ] as const,
      onPick: (key: Preferences["dress"]) => setPrefs((p) => ({ ...p, dress: key })),
    },
  ];

  const current = steps[step] as any;

  return (
    <section aria-label="Quick Preferences" className="w-full">
      <div className="rounded-xl border bg-card p-6 shadow-elevated">
        <h2 className="text-xl font-semibold mb-4">Quick Preferences</h2>
        <p className="text-sm text-muted-foreground mb-6">Answer 2–3 quick questions to jumpstart recommendations.</p>
        <div className="flex flex-wrap gap-2">
          {current.options.map((opt: any) => (
            <Button
              key={opt.key}
              variant={step === 0 ? "hero" : "secondary"}
              onClick={() => current.onPick(opt.key)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">Step {step + 1} of {steps.length}</div>
          {step < steps.length - 1 ? (
            <Button
              variant="default"
              onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
            >
              Next
            </Button>
          ) : (
            <Button variant="hero" size="lg" onClick={() => onComplete(prefs)}>
              See Suggestions
            </Button>
          )}
        </div>
      </div>
    </section>
  );
};

export default QuickPreferences;
