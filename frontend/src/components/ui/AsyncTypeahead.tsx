import { KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';

export type TypeaheadSuggestion = {
  id: string;
  label: string;
  value?: string;
  description?: string;
  category?: string;
  meta?: string;
};

type AsyncTypeaheadProps = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  onSelect?: (suggestion: TypeaheadSuggestion) => void;
  loadSuggestions: (query: string) => Promise<TypeaheadSuggestion[]>;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  minLength?: number;
  disabled?: boolean;
  ariaLabel?: string;
};

export function AsyncTypeahead({
  label,
  value,
  onChange,
  onSelect,
  loadSuggestions,
  placeholder = 'Search...',
  className = '',
  inputClassName = 'legacy-input',
  minLength = 2,
  disabled = false,
  ariaLabel,
}: AsyncTypeaheadProps) {
  const [suggestions, setSuggestions] = useState<TypeaheadSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [error, setError] = useState('');
  const requestIdRef = useRef(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listId = useMemo(() => `typeahead-${Math.random().toString(36).slice(2)}`, []);

  useEffect(() => {
    const handleClickAway = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickAway);
    return () => document.removeEventListener('mousedown', handleClickAway);
  }, []);

  useEffect(() => {
    const query = value.trim();
    setActiveIndex(-1);
    setError('');

    if (query.length < minLength || disabled) {
      setSuggestions([]);
      setIsOpen(false);
      setIsLoading(false);
      return;
    }

    const currentRequest = requestIdRef.current + 1;
    requestIdRef.current = currentRequest;
    setIsLoading(true);

    const timer = window.setTimeout(() => {
      loadSuggestions(query)
        .then((items) => {
          if (requestIdRef.current !== currentRequest) return;
          setSuggestions(Array.isArray(items) ? items : []);
          setIsOpen(true);
        })
        .catch(() => {
          if (requestIdRef.current !== currentRequest) return;
          setSuggestions([]);
          setIsOpen(true);
          setError('Suggestions unavailable');
        })
        .finally(() => {
          if (requestIdRef.current === currentRequest) {
            setIsLoading(false);
          }
        });
    }, 220);

    return () => window.clearTimeout(timer);
  }, [disabled, loadSuggestions, minLength, value]);

  const chooseSuggestion = (suggestion: TypeaheadSuggestion) => {
    onChange(suggestion.value ?? suggestion.label);
    onSelect?.(suggestion);
    setIsOpen(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, suggestions.length - 1));
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    }

    if (event.key === 'Enter' && activeIndex >= 0 && suggestions[activeIndex]) {
      event.preventDefault();
      chooseSuggestion(suggestions[activeIndex]);
    }

    if (event.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const showPanel = isOpen && value.trim().length >= minLength;

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      {label ? <label className="mb-1 block text-sm font-semibold text-slate-700">{label}</label> : null}
      <input
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={showPanel}
        aria-label={ariaLabel ?? label ?? placeholder}
        className={inputClassName}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => value.trim().length >= minLength && setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        role="combobox"
        value={value}
      />

      {showPanel ? (
        <div
          className="absolute left-0 right-0 z-40 mt-2 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl"
          id={listId}
          role="listbox"
        >
          {isLoading ? <div className="px-4 py-3 text-sm text-slate-500">Searching...</div> : null}
          {!isLoading && error ? <div className="px-4 py-3 text-sm text-amber-700">{error}</div> : null}
          {!isLoading && !error && suggestions.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-500">No matching records found.</div>
          ) : null}
          {!isLoading && !error
            ? suggestions.map((item, index) => (
                <button
                  aria-selected={activeIndex === index}
                  className={`block w-full px-4 py-3 text-left transition ${
                    activeIndex === index ? 'bg-red-50' : 'hover:bg-slate-50'
                  }`}
                  key={item.id}
                  onClick={() => chooseSuggestion(item)}
                  role="option"
                  type="button"
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-slate-900">{item.label}</span>
                    {item.category ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        {item.category}
                      </span>
                    ) : null}
                  </span>
                  {item.description ? <span className="mt-1 block text-xs text-slate-500">{item.description}</span> : null}
                  {item.meta ? <span className="mt-1 block text-xs text-primary">{item.meta}</span> : null}
                </button>
              ))
            : null}
        </div>
      ) : null}
    </div>
  );
}
