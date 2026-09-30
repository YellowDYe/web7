import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../config/supabase';

declare global {
  interface Window {
    google?: {
      maps: {
        places: {
          AutocompleteService: new () => google.maps.places.AutocompleteService;
          PlacesService: new (el: HTMLElement) => google.maps.places.PlacesService;
          AutocompleteSessionToken: new () => google.maps.places.AutocompleteSessionToken;
        };
      };
    };
    _googleMapsScriptLoading?: boolean;
    _googleMapsScriptLoaded?: boolean;
  }
}

export interface AddressComponents {
  street: string;
  streetNumber: string;
  colonia: string;
  postalCode: string;
  delegacion: string;
}

export interface PlaceSuggestion {
  placeId: string;
  description: string;
}

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (window._googleMapsScriptLoaded && window.google?.maps?.places) {
    return Promise.resolve();
  }

  if (window._googleMapsScriptLoading) {
    return new Promise((resolve, reject) => {
      const check = setInterval(() => {
        if (window._googleMapsScriptLoaded && window.google?.maps?.places) {
          clearInterval(check);
          resolve();
        }
      }, 100);
      setTimeout(() => {
        clearInterval(check);
        reject(new Error('Google Maps script load timed out'));
      }, 15000);
    });
  }

  window._googleMapsScriptLoading = true;

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=es&region=MX`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      window._googleMapsScriptLoaded = true;
      window._googleMapsScriptLoading = false;
      resolve();
    };
    script.onerror = () => {
      window._googleMapsScriptLoading = false;
      reject(new Error('Failed to load Google Maps script'));
    };
    document.head.appendChild(script);
  });
}

function extractAddressComponents(place: google.maps.places.PlaceResult): AddressComponents {
  const components: AddressComponents = {
    street: '',
    streetNumber: '',
    colonia: '',
    postalCode: '',
    delegacion: '',
  };

  if (!place.address_components) return components;

  for (const component of place.address_components) {
    const types = component.types;

    if (types.includes('route')) {
      components.street = component.long_name;
    } else if (types.includes('street_number')) {
      components.streetNumber = component.long_name;
    } else if (types.includes('sublocality_level_1') || types.includes('sublocality')) {
      components.colonia = component.long_name;
    } else if (types.includes('neighborhood')) {
      if (!components.colonia) {
        components.colonia = component.long_name;
      }
    } else if (types.includes('postal_code')) {
      components.postalCode = component.long_name;
    }
    // Delegacion is intentionally left blank so the user picks it manually
  }

  return components;
}

export function useGooglePlacesAutocomplete() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);

  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const attributionDivRef = useRef<HTMLDivElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const { data, error: dbError } = await supabase
          .from('google_maps_config')
          .select('api_key, is_active')
          .eq('is_active', true)
          .maybeSingle();

        if (cancelled) return;

        if (dbError || !data?.api_key) {
          setIsLoading(false);
          return;
        }

        setApiKey(data.api_key);

        await loadGoogleMapsScript(data.api_key);

        if (cancelled) return;

        if (!attributionDivRef.current) {
          const div = document.createElement('div');
          div.style.display = 'none';
          document.body.appendChild(div);
          attributionDivRef.current = div;
        }

        autocompleteServiceRef.current = new window.google!.maps.places.AutocompleteService();
        placesServiceRef.current = new window.google!.maps.places.PlacesService(attributionDivRef.current);
        sessionTokenRef.current = new window.google!.maps.places.AutocompleteSessionToken();

        setIsReady(true);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error loading Google Maps');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    init();

    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const fetchSuggestions = useCallback((input: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!isReady || !autocompleteServiceRef.current || input.length < 3) {
      setSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(() => {
      autocompleteServiceRef.current!.getPlacePredictions(
        {
          input,
          sessionToken: sessionTokenRef.current!,
          componentRestrictions: { country: 'mx' },
          types: ['address'],
        },
        (predictions, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
            setSuggestions(
              predictions.map((p) => ({
                placeId: p.place_id,
                description: p.description,
              }))
            );
          } else {
            setSuggestions([]);
          }
        }
      );
    }, 300);
  }, [isReady]);

  const selectSuggestion = useCallback(
    (placeId: string): Promise<AddressComponents> => {
      return new Promise((resolve, reject) => {
        if (!placesServiceRef.current) {
          reject(new Error('Places service not ready'));
          return;
        }

        placesServiceRef.current.getDetails(
          {
            placeId,
            fields: ['address_components'],
            sessionToken: sessionTokenRef.current!,
          },
          (place, status) => {
            // Start a new session after fetching details
            sessionTokenRef.current = new window.google!.maps.places.AutocompleteSessionToken();
            setSuggestions([]);

            if (status === google.maps.places.PlacesServiceStatus.OK && place) {
              resolve(extractAddressComponents(place));
            } else {
              reject(new Error('Could not retrieve address details'));
            }
          }
        );
      });
    },
    []
  );

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
  }, []);

  return {
    isReady,
    isLoading,
    error,
    suggestions,
    fetchSuggestions,
    selectSuggestion,
    clearSuggestions,
  };
}
