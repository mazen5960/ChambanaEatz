import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MapPin, Check } from "lucide-react";
import { Preferences, Diet, Vibe } from "@/types/restaurant";

interface Props {
  onComplete: (prefs: Preferences) => void;
  onRequestLocation: () => void;
}

const QuickPreferences = ({ onComplete, onRequestLocation }: Props) => {
  const [step, setStep] = useState(0);
  const [prefs, setPrefs] = useState<Preferences>({
    cuisinePref: [],
    diet: [],
    vibes: [],
  });

  const cuisineOptions = [
    { key: "asian", label: "Asian" },
    { key: "mexican", label: "Mexican" },
    { key: "italian", label: "Italian" },
    { key: "greek", label: "Greek" },
    { key: "middle-eastern", label: "Middle Eastern" },
    { key: "chinese", label: "Chinese" },
    { key: "japanese", label: "Japanese" },
    { key: "latin", label: "Latin" },
    { key: "indian", label: "Indian" },
    { key: "american", label: "American" },
    { key: "fast-food", label: "Fast Food" },
    { key: "cafe", label: "Cafe" },
    { key: "surprise", label: "Surprise me" },
  ];

  const dietOptions: { key: Diet; label: string }[] = [
    { key: "vegetarian", label: "Vegetarian" },
    { key: "vegan", label: "Vegan" },
    { key: "halal", label: "Halal" },
    { key: "gluten-free", label: "Gluten-Free" },
  ];

  const vibeOptions: { key: Vibe; label: string }[] = [
    { key: "quiet", label: "Quiet" },
    { key: "group-friendly", label: "Group-Friendly" },
    { key: "date-night", label: "Date Night" },
    { key: "lively", label: "Lively" },
    { key: "casual", label: "Casual" },
  ];

  const toggleCuisine = (cuisine: string) => {
    setPrefs(p => ({
      ...p,
      cuisinePref: p.cuisinePref?.includes(cuisine)
        ? p.cuisinePref.filter(c => c !== cuisine)
        : [...(p.cuisinePref || []), cuisine]
    }));
  };

  const toggleDiet = (diet: Diet) => {
    setPrefs(p => ({
      ...p,
      diet: p.diet?.includes(diet)
        ? p.diet.filter(d => d !== diet)
        : [...(p.diet || []), diet]
    }));
  };

  const toggleVibe = (vibe: Vibe) => {
    setPrefs(p => ({
      ...p,
      vibes: p.vibes?.includes(vibe)
        ? p.vibes.filter(v => v !== vibe)
        : [...(p.vibes || []), vibe]
    }));
  };

  const handleLocationRequest = () => {
    setPrefs(p => ({ ...p, locationRequested: true }));
    onRequestLocation();
    setStep(1);
  };

  const steps = [
    {
      title: "Where are you dining?",
      subtitle: "We'll find restaurants near you",
      content: (
        <div className="space-y-4">
          <Button
            variant="default"
            size="lg"
            className="w-full"
            onClick={handleLocationRequest}
          >
            <MapPin className="mr-2 h-4 w-4" />
            Use My Location
          </Button>
          <div className="text-center">
            <Button
              variant="outline"
              onClick={() => setStep(1)}
            >
              Skip Location
            </Button>
          </div>
        </div>
      ),
    },
    {
      title: "What cuisine are you craving?",
      subtitle: "Select as many as you like",
      content: (
        <div className="flex flex-wrap gap-2">
          {cuisineOptions.map((opt) => {
            const isSelected = prefs.cuisinePref?.includes(opt.key) || false;
            return (
              <Button
                key={opt.key}
                variant={isSelected ? "secondary" : "outline"}
                onClick={() => toggleCuisine(opt.key)}
                className="relative"
              >
                {isSelected && <Check className="mr-1 h-3 w-3" />}
                {opt.label}
              </Button>
            );
          })}
        </div>
      ),
    },
    {
      title: "Any dietary preferences?",
      subtitle: "We'll filter restaurants accordingly",
      content: (
        <div className="flex flex-wrap gap-2">
          {dietOptions.map((opt) => {
            const isSelected = prefs.diet?.includes(opt.key) || false;
            return (
              <Button
                key={opt.key}
                variant={isSelected ? "secondary" : "outline"}
                onClick={() => toggleDiet(opt.key)}
                className="relative"
              >
                {isSelected && <Check className="mr-1 h-3 w-3" />}
                {opt.label}
              </Button>
            );
          })}
          <Button
            variant="outline"
            onClick={() => setStep(3)}
            className="text-muted-foreground"
          >
            No dietary restrictions
          </Button>
        </div>
      ),
    },
    {
      title: "What's the vibe?",
      subtitle: "Choose the atmosphere you want",
      content: (
        <div className="flex flex-wrap gap-2">
          {vibeOptions.map((opt) => {
            const isSelected = prefs.vibes?.includes(opt.key) || false;
            return (
              <Button
                key={opt.key}
                variant={isSelected ? "secondary" : "outline"}
                onClick={() => toggleVibe(opt.key)}
                className="relative"
              >
                {isSelected && <Check className="mr-1 h-3 w-3" />}
                {opt.label}
              </Button>
            );
          })}
          <Button
            variant="outline"
            onClick={() => onComplete(prefs)}
            className="text-muted-foreground"
          >
            No preference
          </Button>
        </div>
      ),
    },
  ];

  const currentStep = steps[step];

  return (
    <section aria-label="Quick Preferences" className="w-full">
      <div className="rounded-xl border bg-card p-6 shadow-elevated">
        <h2 className="text-xl font-semibold mb-2">{currentStep.title}</h2>
        <p className="text-sm text-muted-foreground mb-6">{currentStep.subtitle}</p>
        
        {currentStep.content}

        <div className="mt-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="text-sm text-muted-foreground">Step {step + 1} of {steps.length}</div>
            {step > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep(s => s - 1)}
              >
                Back
              </Button>
            )}
          </div>
          
          {step < steps.length - 1 && step > 0 ? (
            <Button
              variant="default"
              onClick={() => setStep(s => s + 1)}
            >
              Next
            </Button>
          ) : step === steps.length - 1 ? (
            <Button 
              variant="hero" 
              size="lg" 
              onClick={() => onComplete(prefs)}
            >
              Find Restaurants
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
};

export default QuickPreferences;