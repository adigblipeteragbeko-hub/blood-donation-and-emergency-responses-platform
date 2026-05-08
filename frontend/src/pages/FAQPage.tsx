import { useEffect, useState } from 'react';
import { faqItems } from '../data/publicContent';
import { FaqItem, getPublicWebsiteContent } from '../services/website-management';

export default function FAQPage() {
  const [items, setItems] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const loadFaqs = async () => {
      try {
        setLoading(true);
        const content = await getPublicWebsiteContent();
        if (!active) return;
        setItems(content.faqs);
        setError('');
      } catch {
        if (!active) return;
        setItems([]);
        setError('We could not load the latest FAQ entries right now, so the saved help guide is shown below.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadFaqs();
    return () => {
      active = false;
    };
  }, []);

  const displayItems =
    items.length > 0
      ? items
      : faqItems.map((item, index) => ({
          id: `fallback-faq-${index}`,
          question: item.question,
          answer: item.answer,
          isPublished: true,
          createdAt: '',
          updatedAt: '',
        }));

  return (
    <section className="mx-auto max-w-5xl space-y-8">
      <div className="section-heading-wrap">
        <p className="section-kicker">FAQ</p>
        <h1 className="section-title">Helpful answers for donors, families, and hospital partners</h1>
      </div>

      {error ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-800">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, index) => (
              <article key={`faq-skeleton-${index}`} className="public-card">
                <div className="skeleton-line h-6 w-2/3" />
                <div className="mt-4 skeleton-line h-4 w-full" />
                <div className="mt-2 skeleton-line h-4 w-5/6" />
              </article>
            ))
          : displayItems.map((item) => (
              <article key={item.id} className="public-card">
                <h2 className="text-xl font-bold text-primary">{item.question}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.answer}</p>
              </article>
            ))}
      </div>
    </section>
  );
}
