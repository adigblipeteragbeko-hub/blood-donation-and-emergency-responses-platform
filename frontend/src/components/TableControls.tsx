type FilterBoxProps = {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  withCard?: boolean;
};

type PagerProps = {
  page: number;
  hasMore: boolean;
  onPrev: () => void;
  onNext: () => void;
};

export function FilterBox({ label, placeholder, value, onChange, withCard = true }: FilterBoxProps) {
  const content = (
    <label className="text-sm font-semibold">
      {label}
      <input
        className="legacy-input mt-1"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );

  if (withCard) {
    return <div className="card">{content}</div>;
  }

  return (
    <div>
      {content}
    </div>
  );
}

export function Pager({ page, hasMore, onPrev, onNext }: PagerProps) {
  return (
    <div className="mt-3 flex items-center gap-2">
      <button
        className="rounded border px-3 py-1 text-sm disabled:opacity-50"
        type="button"
        disabled={page === 0}
        onClick={onPrev}
      >
        Previous
      </button>
      <span className="text-sm text-muted">Page {page + 1}</span>
      <button
        className="rounded border px-3 py-1 text-sm disabled:opacity-50"
        type="button"
        disabled={!hasMore}
        onClick={onNext}
      >
        Next
      </button>
    </div>
  );
}
