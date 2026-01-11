import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Suggestion {
  id: string;
  address: string;
}

interface AddressLookupProps {
  postCode: string;
  address: string;
  onPostCodeChange: (value: string) => void;
  onAddressChange: (value: string) => void;
}

export function AddressLookup({
  postCode,
  address,
  onPostCodeChange,
  onAddressChange,
}: AddressLookupProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Autocomplete search as user types
  const handleAddressInput = (value: string) => {
    onAddressChange(value);
    setHighlightedIndex(-1);

    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Don't search for very short queries
    if (value.trim().length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Debounce the API call
    debounceRef.current = setTimeout(async () => {
      setIsLoadingSuggestions(true);
      try {
        const { data, error } = await supabase.functions.invoke("address-lookup", {
          body: { query: value.trim() },
        });

        if (error) {
          console.error("Autocomplete error:", error);
          return;
        }

        if (data.suggestions && data.suggestions.length > 0) {
          setSuggestions(data.suggestions);
          setShowSuggestions(true);
        } else {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } catch (err) {
        console.error("Autocomplete exception:", err);
      } finally {
        setIsLoadingSuggestions(false);
      }
    }, 300);
  };

  // Select a suggestion and get full address details
  const handleSelectSuggestion = async (suggestion: Suggestion) => {
    setShowSuggestions(false);
    setSuggestions([]);
    setIsLoadingSuggestions(true);

    try {
      const { data, error } = await supabase.functions.invoke("address-lookup", {
        body: { id: suggestion.id },
      });

      if (error) {
        console.error("Get address error:", error);
        // Fallback to using the suggestion text
        onAddressChange(suggestion.address);
        return;
      }

      if (data.address) {
        onAddressChange(data.address.formatted);
        if (data.address.postcode) {
          onPostCodeChange(data.address.postcode);
        }
      } else {
        onAddressChange(suggestion.address);
      }
    } catch (err) {
      console.error("Get address exception:", err);
      onAddressChange(suggestion.address);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          handleSelectSuggestion(suggestions[highlightedIndex]);
        }
        break;
      case "Escape":
        setShowSuggestions(false);
        break;
    }
  };

  return (
    <div className="space-y-4">
      {/* Address input with autocomplete */}
      <div className="space-y-2 relative">
        <Label htmlFor="address">Address</Label>
        <div className="relative">
          <Input
            ref={inputRef}
            id="address"
            value={address}
            onChange={(e) => handleAddressInput(e.target.value)}
            onFocus={() => {
              if (suggestions.length > 0) {
                setShowSuggestions(true);
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder="Start typing your address..."
            className={cn(isLoadingSuggestions && "pr-10")}
          />
          {isLoadingSuggestions && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            ref={suggestionsRef}
            className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-auto"
          >
            {suggestions.map((suggestion, index) => (
              <button
                key={suggestion.id}
                type="button"
                className={cn(
                  "w-full px-3 py-2 text-left text-sm flex items-start gap-2 hover:bg-accent transition-colors",
                  highlightedIndex === index && "bg-accent"
                )}
                onClick={() => handleSelectSuggestion(suggestion)}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <span className="line-clamp-2">{suggestion.address}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Postcode field (auto-populated from selection) */}
      <div className="space-y-2">
        <Label htmlFor="postCode">Post Code</Label>
        <Input
          id="postCode"
          value={postCode}
          onChange={(e) => onPostCodeChange(e.target.value.toUpperCase())}
          placeholder="Auto-filled when address selected"
          className="sm:max-w-[200px]"
        />
      </div>
    </div>
  );
}