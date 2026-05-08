import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AwarenessPostItem,
  createAwarenessPost,
  createFaq,
  createPartnerHospital,
  createTestimonial,
  createWebsiteAlert,
  deleteAwarenessPost,
  deleteFaq,
  deletePartnerHospital,
  deleteTestimonial,
  deleteWebsiteAlert,
  FaqItem,
  getWebsiteManagementDashboard,
  PartnerHospitalItem,
  TestimonialItem,
  updateAwarenessPost,
  updateFaq,
  updateFooterSettings,
  updatePartnerHospital,
  updateTestimonial,
  updateWebsiteAlert,
  updateWebsiteStatistic,
  WebsiteAlertItem,
  WebsiteFooterSettingsItem,
  WebsiteStatisticItem,
} from '../services/website-management';

const inputClass =
  'mt-2 w-full rounded-xl border border-red-100 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm outline-none transition placeholder:text-slate-500 focus:border-red-300 focus:ring-2 focus:ring-red-100';
const textareaClass = `${inputClass} min-h-28 resize-y`;
const bloodGroups = ['O_NEG', 'O_POS', 'A_NEG', 'A_POS', 'B_NEG', 'B_POS', 'AB_NEG', 'AB_POS'];
const urgencyLevels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

type SectionKey = 'alerts' | 'statistics' | 'faqs' | 'testimonials' | 'awareness' | 'hospitals' | 'footer';
type Toast = { id: number; type: 'success' | 'error'; message: string };

const sectionOptions: { key: SectionKey; label: string }[] = [
  { key: 'alerts', label: 'Emergency Banner' },
  { key: 'statistics', label: 'Homepage Statistics' },
  { key: 'faqs', label: 'FAQ Management' },
  { key: 'testimonials', label: 'Testimonials' },
  { key: 'awareness', label: 'News & Awareness' },
  { key: 'hospitals', label: 'Partner Hospitals' },
  { key: 'footer', label: 'Footer Settings' },
];

const emptyAlertForm = {
  title: '',
  message: '',
  bloodType: '',
  hospitalName: '',
  urgencyLevel: 'HIGH' as WebsiteAlertItem['urgencyLevel'],
  isActive: true,
  isSticky: true,
  isScrolling: false,
  expiresAt: '',
};

const emptyFaqForm = { question: '', answer: '', isPublished: true };
const emptyTestimonialForm = { name: '', role: '', message: '', location: '', isApproved: true, isPublished: true };
const emptyAwarenessForm = { title: '', content: '', image: '', category: '', isPublished: true };
const emptyPartnerHospitalForm = {
  hospitalName: '',
  location: '',
  phone: '',
  email: '',
  description: '',
  latitude: '',
  longitude: '',
};

export default function WebsiteManagementPage() {
  const [activeSection, setActiveSection] = useState<SectionKey>('alerts');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alerts, setAlerts] = useState<WebsiteAlertItem[]>([]);
  const [statistics, setStatistics] = useState<WebsiteStatisticItem[]>([]);
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [testimonials, setTestimonials] = useState<TestimonialItem[]>([]);
  const [awarenessPosts, setAwarenessPosts] = useState<AwarenessPostItem[]>([]);
  const [partnerHospitals, setPartnerHospitals] = useState<PartnerHospitalItem[]>([]);
  const [footerSettings, setFooterSettings] = useState<WebsiteFooterSettingsItem | null>(null);

  const [alertForm, setAlertForm] = useState(emptyAlertForm);
  const [faqForm, setFaqForm] = useState(emptyFaqForm);
  const [testimonialForm, setTestimonialForm] = useState(emptyTestimonialForm);
  const [awarenessForm, setAwarenessForm] = useState(emptyAwarenessForm);
  const [partnerHospitalForm, setPartnerHospitalForm] = useState(emptyPartnerHospitalForm);
  const [footerForm, setFooterForm] = useState({
    emergencyPhonePrimary: '',
    emergencyPhoneSecondary: '',
    supportEmail: '',
    facebookUrl: '',
    instagramUrl: '',
    linkedinUrl: '',
    footerText: '',
  });

  const [editingAlertId, setEditingAlertId] = useState<string | null>(null);
  const [editingFaqId, setEditingFaqId] = useState<string | null>(null);
  const [editingTestimonialId, setEditingTestimonialId] = useState<string | null>(null);
  const [editingAwarenessId, setEditingAwarenessId] = useState<string | null>(null);
  const [editingPartnerHospitalId, setEditingPartnerHospitalId] = useState<string | null>(null);

  const [modal, setModal] = useState<null | { title: string; message: string; action: () => Promise<void> }>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = (type: Toast['type'], message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((current) => [...current, { id, type, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3500);
  };

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const data = await getWebsiteManagementDashboard();
      setAlerts(data.alerts ?? []);
      setStatistics(data.statistics ?? []);
      setFaqs(data.faqs ?? []);
      setTestimonials(data.testimonials ?? []);
      setAwarenessPosts(data.awarenessPosts ?? []);
      setPartnerHospitals(data.partnerHospitals ?? []);
      setFooterSettings(data.footerSettings);
      setFooterForm({
        emergencyPhonePrimary: data.footerSettings?.emergencyPhonePrimary ?? '',
        emergencyPhoneSecondary: data.footerSettings?.emergencyPhoneSecondary ?? '',
        supportEmail: data.footerSettings?.supportEmail ?? '',
        facebookUrl: data.footerSettings?.facebookUrl ?? '',
        instagramUrl: data.footerSettings?.instagramUrl ?? '',
        linkedinUrl: data.footerSettings?.linkedinUrl ?? '',
        footerText: data.footerSettings?.footerText ?? '',
      });
    } catch (error: any) {
      pushToast('error', error?.response?.data?.error?.message ?? 'Could not load website management content.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const statsByKey = useMemo(
    () =>
      Object.fromEntries(
        statistics.map((item) => [
          item.key,
          { ...item, draftOverride: item.overrideValue ?? item.liveValue, draftEnabled: item.isOverrideEnabled },
        ]),
      ) as Record<string, WebsiteStatisticItem & { draftOverride: number; draftEnabled: boolean }>,
    [statistics],
  );

  const resetAlertEditor = () => {
    setEditingAlertId(null);
    setAlertForm(emptyAlertForm);
  };

  const resetFaqEditor = () => {
    setEditingFaqId(null);
    setFaqForm(emptyFaqForm);
  };

  const resetTestimonialEditor = () => {
    setEditingTestimonialId(null);
    setTestimonialForm(emptyTestimonialForm);
  };

  const resetAwarenessEditor = () => {
    setEditingAwarenessId(null);
    setAwarenessForm(emptyAwarenessForm);
  };

  const resetPartnerHospitalEditor = () => {
    setEditingPartnerHospitalId(null);
    setPartnerHospitalForm(emptyPartnerHospitalForm);
  };

  const handleAlertSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...alertForm,
        bloodType: alertForm.bloodType || null,
        expiresAt: alertForm.expiresAt || null,
      };
      if (editingAlertId) {
        const updated = await updateWebsiteAlert(editingAlertId, payload);
        setAlerts((current) => current.map((item) => (item.id === editingAlertId ? updated : item)));
        pushToast('success', 'Emergency banner updated successfully.');
      } else {
        const created = await createWebsiteAlert(payload);
        setAlerts((current) => [created, ...current]);
        pushToast('success', 'Emergency banner created successfully.');
      }
      resetAlertEditor();
    } catch (error: any) {
      pushToast('error', error?.response?.data?.error?.message ?? 'Could not save emergency banner.');
    } finally {
      setSaving(false);
    }
  };

  const handleFaqSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (editingFaqId) {
        const updated = await updateFaq(editingFaqId, faqForm);
        setFaqs((current) => current.map((item) => (item.id === editingFaqId ? updated : item)));
        pushToast('success', 'FAQ updated successfully.');
      } else {
        const created = await createFaq(faqForm);
        setFaqs((current) => [...current, created]);
        pushToast('success', 'FAQ created successfully.');
      }
      resetFaqEditor();
    } catch (error: any) {
      pushToast('error', error?.response?.data?.error?.message ?? 'Could not save FAQ.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestimonialSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (editingTestimonialId) {
        const updated = await updateTestimonial(editingTestimonialId, testimonialForm);
        setTestimonials((current) => current.map((item) => (item.id === editingTestimonialId ? updated : item)));
        pushToast('success', 'Testimonial updated successfully.');
      } else {
        const created = await createTestimonial(testimonialForm);
        setTestimonials((current) => [created, ...current]);
        pushToast('success', 'Testimonial created successfully.');
      }
      resetTestimonialEditor();
    } catch (error: any) {
      pushToast('error', error?.response?.data?.error?.message ?? 'Could not save testimonial.');
    } finally {
      setSaving(false);
    }
  };

  const handleAwarenessSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...awarenessForm,
        image: awarenessForm.image || null,
      };
      if (editingAwarenessId) {
        const updated = await updateAwarenessPost(editingAwarenessId, payload);
        setAwarenessPosts((current) => current.map((item) => (item.id === editingAwarenessId ? updated : item)));
        pushToast('success', 'Awareness post updated successfully.');
      } else {
        const created = await createAwarenessPost(payload);
        setAwarenessPosts((current) => [created, ...current]);
        pushToast('success', 'Awareness post created successfully.');
      }
      resetAwarenessEditor();
    } catch (error: any) {
      pushToast('error', error?.response?.data?.error?.message ?? 'Could not save awareness post.');
    } finally {
      setSaving(false);
    }
  };

  const handlePartnerHospitalSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...partnerHospitalForm,
        description: partnerHospitalForm.description || null,
        latitude: partnerHospitalForm.latitude ? Number(partnerHospitalForm.latitude) : null,
        longitude: partnerHospitalForm.longitude ? Number(partnerHospitalForm.longitude) : null,
      };
      if (editingPartnerHospitalId) {
        const updated = await updatePartnerHospital(editingPartnerHospitalId, payload);
        setPartnerHospitals((current) =>
          current.map((item) => (item.id === editingPartnerHospitalId ? updated : item)),
        );
        pushToast('success', 'Partner hospital updated successfully.');
      } else {
        const created = await createPartnerHospital(payload);
        setPartnerHospitals((current) => [...current, created].sort((a, b) => a.hospitalName.localeCompare(b.hospitalName)));
        pushToast('success', 'Partner hospital created successfully.');
      }
      resetPartnerHospitalEditor();
    } catch (error: any) {
      pushToast('error', error?.response?.data?.error?.message ?? 'Could not save partner hospital.');
    } finally {
      setSaving(false);
    }
  };

  const handleFooterSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const updated = await updateFooterSettings(footerForm);
      setFooterSettings(updated);
      pushToast('success', 'Footer settings updated successfully.');
    } catch (error: any) {
      pushToast('error', error?.response?.data?.error?.message ?? 'Could not update footer settings.');
    } finally {
      setSaving(false);
    }
  };

  const prepareAlertEditor = (item: WebsiteAlertItem) => {
    setEditingAlertId(item.id);
    setAlertForm({
      title: item.title,
      message: item.message,
      bloodType: item.bloodType ?? '',
      hospitalName: item.hospitalName,
      urgencyLevel: item.urgencyLevel,
      isActive: item.isActive,
      isSticky: item.isSticky,
      isScrolling: item.isScrolling,
      expiresAt: item.expiresAt ? item.expiresAt.slice(0, 16) : '',
    });
    setActiveSection('alerts');
  };

  const prepareFaqEditor = (item: FaqItem) => {
    setEditingFaqId(item.id);
    setFaqForm({ question: item.question, answer: item.answer, isPublished: item.isPublished });
    setActiveSection('faqs');
  };

  const prepareTestimonialEditor = (item: TestimonialItem) => {
    setEditingTestimonialId(item.id);
    setTestimonialForm({
      name: item.name,
      role: item.role,
      message: item.message,
      location: item.location ?? '',
      isApproved: item.isApproved,
      isPublished: item.isPublished,
    });
    setActiveSection('testimonials');
  };

  const prepareAwarenessEditor = (item: AwarenessPostItem) => {
    setEditingAwarenessId(item.id);
    setAwarenessForm({
      title: item.title,
      content: item.content,
      image: item.image ?? '',
      category: item.category,
      isPublished: item.isPublished,
    });
    setActiveSection('awareness');
  };

  const preparePartnerHospitalEditor = (item: PartnerHospitalItem) => {
    setEditingPartnerHospitalId(item.id);
    setPartnerHospitalForm({
      hospitalName: item.hospitalName,
      location: item.location,
      phone: item.phone,
      email: item.email,
      description: item.description ?? '',
      latitude: item.latitude?.toString() ?? '',
      longitude: item.longitude?.toString() ?? '',
    });
    setActiveSection('hospitals');
  };

  const openDeleteModal = (title: string, message: string, action: () => Promise<void>) => {
    setModal({ title, message, action });
  };

  const confirmDelete = async () => {
    if (!modal) return;
    setSaving(true);
    try {
      await modal.action();
      setModal(null);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="space-y-5">
        <div className="card space-y-3">
          <div className="skeleton-line h-8 w-56" />
          <div className="skeleton-line h-4 w-96 max-w-full" />
        </div>
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <div className="card space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="skeleton-line h-11 w-full" />
            ))}
          </div>
          <div className="card space-y-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="skeleton-line h-20 w-full" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <div className="card">
        <h1 className="text-2xl font-bold text-primary">Website Management</h1>
        <p className="mt-2 text-sm text-slate-600">
          Manage public website content safely through structured forms. Admin-only access, audit logging, and
          publish controls are built in.
        </p>
      </div>

      <div className="fixed right-5 top-24 z-50 space-y-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`min-w-[280px] rounded-2xl border px-4 py-3 text-sm font-semibold shadow-lg ${
              toast.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-red-200 bg-red-50 text-primary'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[280px_1fr]">
        <aside className="card h-fit space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-[0.22em] text-slate-500">Sections</h2>
          {sectionOptions.map((section) => (
            <button
              key={section.key}
              className={`w-full rounded-xl px-4 py-3 text-left text-sm font-semibold transition ${
                activeSection === section.key ? 'bg-primary text-white' : 'bg-red-50 text-primary hover:bg-red-100'
              }`}
              onClick={() => setActiveSection(section.key)}
              type="button"
            >
              {section.label}
            </button>
          ))}
        </aside>

        <div className="space-y-5">
          {activeSection === 'alerts' ? (
            <>
              <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
                <form className="card space-y-4" onSubmit={handleAlertSubmit}>
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-xl font-bold text-primary">{editingAlertId ? 'Edit Alert' : 'Create Alert'}</h2>
                    {editingAlertId ? (
                      <button className="btn-secondary" onClick={resetAlertEditor} type="button">
                        Cancel
                      </button>
                    ) : null}
                  </div>
                  <label className="block text-sm font-semibold text-slate-700">
                    Title
                    <input className={inputClass} value={alertForm.title} onChange={(e) => setAlertForm((v) => ({ ...v, title: e.target.value }))} placeholder="URGENT: O- blood needed" />
                  </label>
                  <label className="block text-sm font-semibold text-slate-700">
                    Message
                    <textarea className={textareaClass} value={alertForm.message} onChange={(e) => setAlertForm((v) => ({ ...v, message: e.target.value }))} placeholder="Short public-facing emergency message" />
                  </label>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block text-sm font-semibold text-slate-700">
                      Blood Type
                      <select className={inputClass} value={alertForm.bloodType} onChange={(e) => setAlertForm((v) => ({ ...v, bloodType: e.target.value }))}>
                        <option value="">Select blood type</option>
                        {bloodGroups.map((group) => (
                          <option key={group} value={group}>
                            {group}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-sm font-semibold text-slate-700">
                      Urgency
                      <select className={inputClass} value={alertForm.urgencyLevel} onChange={(e) => setAlertForm((v) => ({ ...v, urgencyLevel: e.target.value as WebsiteAlertItem['urgencyLevel'] }))}>
                        {urgencyLevels.map((level) => (
                          <option key={level} value={level}>
                            {level}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="block text-sm font-semibold text-slate-700">
                    Hospital Name
                    <input className={inputClass} value={alertForm.hospitalName} onChange={(e) => setAlertForm((v) => ({ ...v, hospitalName: e.target.value }))} placeholder="Tema General Hospital" />
                  </label>
                  <label className="block text-sm font-semibold text-slate-700">
                    Expiry Date / Time
                    <input className={inputClass} type="datetime-local" value={alertForm.expiresAt} onChange={(e) => setAlertForm((v) => ({ ...v, expiresAt: e.target.value }))} />
                  </label>
                  <div className="grid gap-3 md:grid-cols-3">
                    <ToggleTile label="Active" value={alertForm.isActive} onChange={(value) => setAlertForm((v) => ({ ...v, isActive: value }))} />
                    <ToggleTile label="Sticky" value={alertForm.isSticky} onChange={(value) => setAlertForm((v) => ({ ...v, isSticky: value }))} />
                    <ToggleTile label="Scrolling" value={alertForm.isScrolling} onChange={(value) => setAlertForm((v) => ({ ...v, isScrolling: value }))} />
                  </div>
                  <button className="btn-primary w-full" disabled={saving} type="submit">
                    {saving ? 'Saving...' : editingAlertId ? 'Update Alert' : 'Create Alert'}
                  </button>
                </form>

                <div className="space-y-4">
                  {alerts.length === 0 ? <EmptyState title="No alerts yet" body="Create the first emergency banner for the public website." /> : null}
                  {alerts.map((alert) => (
                    <article key={alert.id} className="card">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div className="flex flex-wrap gap-2">
                            <Badge tone={alert.isActive ? 'red' : 'slate'}>{alert.isActive ? 'Active' : 'Inactive'}</Badge>
                            <Badge tone="navy">{alert.urgencyLevel}</Badge>
                            {alert.isSticky ? <Badge tone="slate">Sticky</Badge> : null}
                            {alert.isScrolling ? <Badge tone="slate">Scrolling</Badge> : null}
                          </div>
                          <h3 className="mt-3 text-xl font-bold text-slate-900">{alert.title}</h3>
                          <p className="mt-2 text-sm text-slate-500">
                            {alert.hospitalName} {alert.bloodType ? `• ${alert.bloodType}` : ''}
                          </p>
                          <p className="mt-3 text-sm leading-7 text-slate-600">{alert.message}</p>
                          <p className="mt-3 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                            Expires {alert.expiresAt ? new Date(alert.expiresAt).toLocaleString() : 'Not set'}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button className="btn-secondary" onClick={() => prepareAlertEditor(alert)} type="button">
                            Edit
                          </button>
                          <button
                            className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-red-50"
                            onClick={() =>
                              openDeleteModal('Delete alert', 'This alert will be removed from website management.', async () => {
                                await deleteWebsiteAlert(alert.id);
                                setAlerts((current) => current.filter((item) => item.id !== alert.id));
                                pushToast('success', 'Alert deleted successfully.');
                                if (editingAlertId === alert.id) resetAlertEditor();
                              })
                            }
                            type="button"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </>
          ) : null}

          {activeSection === 'statistics' ? (
            <div className="grid gap-4 md:grid-cols-2">
              {statistics.map((item) => (
                <StatisticCard
                  key={item.key}
                  item={statsByKey[item.key]}
                  onSave={async (payload) => {
                    setSaving(true);
                    try {
                      const updated = await updateWebsiteStatistic(item.key, payload);
                      setStatistics((current) => current.map((stat) => (stat.key === item.key ? { ...stat, ...updated } : stat)));
                      pushToast('success', `${item.label} updated successfully.`);
                    } catch (error: any) {
                      pushToast('error', error?.response?.data?.error?.message ?? 'Could not update statistic.');
                    } finally {
                      setSaving(false);
                    }
                  }}
                />
              ))}
            </div>
          ) : null}

          {activeSection === 'faqs' ? (
            <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
              <form className="card space-y-4" onSubmit={handleFaqSubmit}>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xl font-bold text-primary">{editingFaqId ? 'Edit FAQ' : 'Add FAQ'}</h2>
                  {editingFaqId ? (
                    <button className="btn-secondary" onClick={resetFaqEditor} type="button">
                      Cancel
                    </button>
                  ) : null}
                </div>
                <label className="block text-sm font-semibold text-slate-700">
                  Question
                  <input className={inputClass} value={faqForm.question} onChange={(e) => setFaqForm((v) => ({ ...v, question: e.target.value }))} placeholder="Who can donate blood?" />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Answer
                  <textarea className={textareaClass} value={faqForm.answer} onChange={(e) => setFaqForm((v) => ({ ...v, answer: e.target.value }))} placeholder="Provide a clear public answer." />
                </label>
                <ToggleTile label="Published" value={faqForm.isPublished} onChange={(value) => setFaqForm((v) => ({ ...v, isPublished: value }))} />
                <button className="btn-primary w-full" disabled={saving} type="submit">
                  {saving ? 'Saving...' : editingFaqId ? 'Update FAQ' : 'Add FAQ'}
                </button>
              </form>
              <div className="space-y-4">
                {faqs.length === 0 ? <EmptyState title="No FAQs yet" body="Add public answers to common donor and hospital questions." /> : null}
                {faqs.map((item) => (
                  <article key={item.id} className="card">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex gap-2">
                          <Badge tone={item.isPublished ? 'red' : 'slate'}>{item.isPublished ? 'Published' : 'Draft'}</Badge>
                        </div>
                        <h3 className="mt-3 text-lg font-bold text-slate-900">{item.question}</h3>
                        <p className="mt-3 text-sm leading-7 text-slate-600">{item.answer}</p>
                      </div>
                      <div className="flex gap-2">
                        <button className="btn-secondary" onClick={() => prepareFaqEditor(item)} type="button">
                          Edit
                        </button>
                        <button
                          className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-red-50"
                          onClick={() =>
                            openDeleteModal('Delete FAQ', 'This FAQ entry will be removed from the public website module.', async () => {
                              await deleteFaq(item.id);
                              setFaqs((current) => current.filter((faq) => faq.id !== item.id));
                              pushToast('success', 'FAQ deleted successfully.');
                              if (editingFaqId === item.id) resetFaqEditor();
                            })
                          }
                          type="button"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {activeSection === 'testimonials' ? (
            <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
              <form className="card space-y-4" onSubmit={handleTestimonialSubmit}>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xl font-bold text-primary">{editingTestimonialId ? 'Edit Testimonial' : 'Add Testimonial'}</h2>
                  {editingTestimonialId ? (
                    <button className="btn-secondary" onClick={resetTestimonialEditor} type="button">
                      Cancel
                    </button>
                  ) : null}
                </div>
                <label className="block text-sm font-semibold text-slate-700">
                  Name
                  <input className={inputClass} value={testimonialForm.name} onChange={(e) => setTestimonialForm((v) => ({ ...v, name: e.target.value }))} placeholder="Ama Owusu" />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Role
                  <input className={inputClass} value={testimonialForm.role} onChange={(e) => setTestimonialForm((v) => ({ ...v, role: e.target.value }))} placeholder="Volunteer Donor" />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Location
                  <input className={inputClass} value={testimonialForm.location} onChange={(e) => setTestimonialForm((v) => ({ ...v, location: e.target.value }))} placeholder="Accra" />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Message
                  <textarea className={textareaClass} value={testimonialForm.message} onChange={(e) => setTestimonialForm((v) => ({ ...v, message: e.target.value }))} placeholder="A donor or hospital success story." />
                </label>
                <div className="grid gap-3 md:grid-cols-2">
                  <ToggleTile label="Approved" value={testimonialForm.isApproved} onChange={(value) => setTestimonialForm((v) => ({ ...v, isApproved: value }))} />
                  <ToggleTile label="Published" value={testimonialForm.isPublished} onChange={(value) => setTestimonialForm((v) => ({ ...v, isPublished: value }))} />
                </div>
                <button className="btn-primary w-full" disabled={saving} type="submit">
                  {saving ? 'Saving...' : editingTestimonialId ? 'Update Testimonial' : 'Add Testimonial'}
                </button>
              </form>
              <div className="space-y-4">
                {testimonials.length === 0 ? <EmptyState title="No testimonials yet" body="Add trusted donor and hospital feedback for the public website." /> : null}
                {testimonials.map((item) => (
                  <article key={item.id} className="card">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex gap-2">
                          <Badge tone={item.isApproved ? 'red' : 'slate'}>{item.isApproved ? 'Approved' : 'Pending Approval'}</Badge>
                          <Badge tone={item.isPublished ? 'navy' : 'slate'}>{item.isPublished ? 'Published' : 'Draft'}</Badge>
                        </div>
                        <h3 className="mt-3 text-lg font-bold text-slate-900">{item.name}</h3>
                        <p className="text-sm font-medium text-slate-500">{item.role}{item.location ? ` • ${item.location}` : ''}</p>
                        <p className="mt-3 text-sm leading-7 text-slate-600">{item.message}</p>
                      </div>
                      <div className="flex gap-2">
                        <button className="btn-secondary" onClick={() => prepareTestimonialEditor(item)} type="button">
                          Edit
                        </button>
                        <button
                          className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-red-50"
                          onClick={() =>
                            openDeleteModal('Delete testimonial', 'This testimonial will be removed from the website module.', async () => {
                              await deleteTestimonial(item.id);
                              setTestimonials((current) => current.filter((testimonial) => testimonial.id !== item.id));
                              pushToast('success', 'Testimonial deleted successfully.');
                              if (editingTestimonialId === item.id) resetTestimonialEditor();
                            })
                          }
                          type="button"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {activeSection === 'awareness' ? (
            <div className="grid gap-5 xl:grid-cols-[400px_1fr]">
              <form className="card space-y-4" onSubmit={handleAwarenessSubmit}>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xl font-bold text-primary">{editingAwarenessId ? 'Edit Awareness Post' : 'Create Awareness Post'}</h2>
                  {editingAwarenessId ? (
                    <button className="btn-secondary" onClick={resetAwarenessEditor} type="button">
                      Cancel
                    </button>
                  ) : null}
                </div>
                <label className="block text-sm font-semibold text-slate-700">
                  Title
                  <input className={inputClass} value={awarenessForm.title} onChange={(e) => setAwarenessForm((v) => ({ ...v, title: e.target.value }))} placeholder="Blood shortage awareness week" />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Category
                  <input className={inputClass} value={awarenessForm.category} onChange={(e) => setAwarenessForm((v) => ({ ...v, category: e.target.value }))} placeholder="Awareness" />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Image URL
                  <input className={inputClass} value={awarenessForm.image} onChange={(e) => setAwarenessForm((v) => ({ ...v, image: e.target.value }))} placeholder="https://..." />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Content
                  <textarea className={`${textareaClass} min-h-40`} value={awarenessForm.content} onChange={(e) => setAwarenessForm((v) => ({ ...v, content: e.target.value }))} placeholder="Structured awareness content for the public website." />
                </label>
                <ToggleTile label="Published" value={awarenessForm.isPublished} onChange={(value) => setAwarenessForm((v) => ({ ...v, isPublished: value }))} />
                <button className="btn-primary w-full" disabled={saving} type="submit">
                  {saving ? 'Saving...' : editingAwarenessId ? 'Update Post' : 'Create Post'}
                </button>
              </form>
              <div className="space-y-4">
                {awarenessPosts.length === 0 ? <EmptyState title="No awareness posts yet" body="Create articles and awareness pieces for the homepage." /> : null}
                {awarenessPosts.map((item) => (
                  <article key={item.id} className="card">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex gap-2">
                          <Badge tone={item.isPublished ? 'red' : 'slate'}>{item.isPublished ? 'Published' : 'Draft'}</Badge>
                          <Badge tone="navy">{item.category}</Badge>
                        </div>
                        <h3 className="mt-3 text-lg font-bold text-slate-900">{item.title}</h3>
                        {item.image ? (
                          <img alt={item.title} className="mt-4 h-40 w-full rounded-2xl object-cover" src={item.image} />
                        ) : null}
                        <p className="mt-4 text-sm leading-7 text-slate-600">{item.content}</p>
                      </div>
                      <div className="flex gap-2">
                        <button className="btn-secondary" onClick={() => prepareAwarenessEditor(item)} type="button">
                          Edit
                        </button>
                        <button
                          className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-red-50"
                          onClick={() =>
                            openDeleteModal('Delete awareness post', 'This post will be removed from the website module.', async () => {
                              await deleteAwarenessPost(item.id);
                              setAwarenessPosts((current) => current.filter((post) => post.id !== item.id));
                              pushToast('success', 'Awareness post deleted successfully.');
                              if (editingAwarenessId === item.id) resetAwarenessEditor();
                            })
                          }
                          type="button"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {activeSection === 'hospitals' ? (
            <div className="grid gap-5 xl:grid-cols-[400px_1fr]">
              <form className="card space-y-4" onSubmit={handlePartnerHospitalSubmit}>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xl font-bold text-primary">{editingPartnerHospitalId ? 'Edit Partner Hospital' : 'Add Partner Hospital'}</h2>
                  {editingPartnerHospitalId ? (
                    <button className="btn-secondary" onClick={resetPartnerHospitalEditor} type="button">
                      Cancel
                    </button>
                  ) : null}
                </div>
                <label className="block text-sm font-semibold text-slate-700">Hospital Name
                  <input className={inputClass} value={partnerHospitalForm.hospitalName} onChange={(e) => setPartnerHospitalForm((v) => ({ ...v, hospitalName: e.target.value }))} placeholder="Tema General Hospital" />
                </label>
                <label className="block text-sm font-semibold text-slate-700">Location
                  <input className={inputClass} value={partnerHospitalForm.location} onChange={(e) => setPartnerHospitalForm((v) => ({ ...v, location: e.target.value }))} placeholder="Tema, Greater Accra" />
                </label>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block text-sm font-semibold text-slate-700">Phone
                    <input className={inputClass} value={partnerHospitalForm.phone} onChange={(e) => setPartnerHospitalForm((v) => ({ ...v, phone: e.target.value }))} placeholder="+233..." />
                  </label>
                  <label className="block text-sm font-semibold text-slate-700">Email
                    <input className={inputClass} type="email" value={partnerHospitalForm.email} onChange={(e) => setPartnerHospitalForm((v) => ({ ...v, email: e.target.value }))} placeholder="hospital@example.com" />
                  </label>
                </div>
                <label className="block text-sm font-semibold text-slate-700">Description
                  <textarea className={textareaClass} value={partnerHospitalForm.description} onChange={(e) => setPartnerHospitalForm((v) => ({ ...v, description: e.target.value }))} placeholder="Short public description of the partner hospital." />
                </label>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block text-sm font-semibold text-slate-700">Latitude
                    <input className={inputClass} value={partnerHospitalForm.latitude} onChange={(e) => setPartnerHospitalForm((v) => ({ ...v, latitude: e.target.value }))} placeholder="5.6698" />
                  </label>
                  <label className="block text-sm font-semibold text-slate-700">Longitude
                    <input className={inputClass} value={partnerHospitalForm.longitude} onChange={(e) => setPartnerHospitalForm((v) => ({ ...v, longitude: e.target.value }))} placeholder="-0.0166" />
                  </label>
                </div>
                <button className="btn-primary w-full" disabled={saving} type="submit">
                  {saving ? 'Saving...' : editingPartnerHospitalId ? 'Update Hospital' : 'Add Hospital'}
                </button>
              </form>
              <div className="space-y-4">
                {partnerHospitals.length === 0 ? <EmptyState title="No partner hospitals yet" body="Add public-facing partner hospitals and blood centers." /> : null}
                {partnerHospitals.map((item) => (
                  <article key={item.id} className="card">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">{item.hospitalName}</h3>
                        <p className="mt-2 text-sm font-medium text-slate-500">{item.location}</p>
                        <p className="mt-2 text-sm text-slate-600">{item.phone} • {item.email}</p>
                        {item.description ? <p className="mt-3 text-sm leading-7 text-slate-600">{item.description}</p> : null}
                        {(item.latitude !== null || item.longitude !== null) ? (
                          <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">
                            Coordinates: {item.latitude ?? '-'}, {item.longitude ?? '-'}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex gap-2">
                        <button className="btn-secondary" onClick={() => preparePartnerHospitalEditor(item)} type="button">
                          Edit
                        </button>
                        <button
                          className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-red-50"
                          onClick={() =>
                            openDeleteModal('Delete hospital listing', 'This public partner hospital entry will be removed.', async () => {
                              await deletePartnerHospital(item.id);
                              setPartnerHospitals((current) => current.filter((hospital) => hospital.id !== item.id));
                              pushToast('success', 'Partner hospital removed successfully.');
                              if (editingPartnerHospitalId === item.id) resetPartnerHospitalEditor();
                            })
                          }
                          type="button"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {activeSection === 'footer' ? (
            <form className="card space-y-4" onSubmit={handleFooterSubmit}>
              <h2 className="text-xl font-bold text-primary">Footer Management</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm font-semibold text-slate-700">Primary Emergency Contact
                  <input className={inputClass} value={footerForm.emergencyPhonePrimary} onChange={(e) => setFooterForm((v) => ({ ...v, emergencyPhonePrimary: e.target.value }))} placeholder="+233 544515775" />
                </label>
                <label className="block text-sm font-semibold text-slate-700">Secondary Emergency Contact
                  <input className={inputClass} value={footerForm.emergencyPhoneSecondary} onChange={(e) => setFooterForm((v) => ({ ...v, emergencyPhoneSecondary: e.target.value }))} placeholder="+233 554287342" />
                </label>
              </div>
              <label className="block text-sm font-semibold text-slate-700">Support Email
                <input className={inputClass} type="email" value={footerForm.supportEmail} onChange={(e) => setFooterForm((v) => ({ ...v, supportEmail: e.target.value }))} placeholder="support@bloodresponse.local" />
              </label>
              <div className="grid gap-4 md:grid-cols-3">
                <label className="block text-sm font-semibold text-slate-700">Facebook URL
                  <input className={inputClass} value={footerForm.facebookUrl} onChange={(e) => setFooterForm((v) => ({ ...v, facebookUrl: e.target.value }))} placeholder="https://facebook.com/..." />
                </label>
                <label className="block text-sm font-semibold text-slate-700">Instagram URL
                  <input className={inputClass} value={footerForm.instagramUrl} onChange={(e) => setFooterForm((v) => ({ ...v, instagramUrl: e.target.value }))} placeholder="https://instagram.com/..." />
                </label>
                <label className="block text-sm font-semibold text-slate-700">LinkedIn URL
                  <input className={inputClass} value={footerForm.linkedinUrl} onChange={(e) => setFooterForm((v) => ({ ...v, linkedinUrl: e.target.value }))} placeholder="https://linkedin.com/..." />
                </label>
              </div>
              <label className="block text-sm font-semibold text-slate-700">Footer Text
                <textarea className={textareaClass} value={footerForm.footerText} onChange={(e) => setFooterForm((v) => ({ ...v, footerText: e.target.value }))} placeholder="Footer text visible across the public website." />
              </label>
              <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-slate-600">
                Current footer record: <span className="font-semibold text-slate-900">{footerSettings?.singletonKey ?? 'default'}</span>
              </div>
              <button className="btn-primary w-full md:w-auto" disabled={saving} type="submit">
                {saving ? 'Saving...' : 'Update Footer'}
              </button>
            </form>
          ) : null}
        </div>
      </div>

      {modal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
          <div className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-slate-900">{modal.title}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">{modal.message}</p>
            <div className="mt-6 flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => setModal(null)} type="button">
                Cancel
              </button>
              <button className="btn-primary" disabled={saving} onClick={confirmDelete} type="button">
                {saving ? 'Working...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ToggleTile({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      className={`rounded-2xl border px-4 py-4 text-left transition ${value ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'}`}
      onClick={() => onChange(!value)}
      type="button"
    >
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className={`mt-2 text-base font-bold ${value ? 'text-primary' : 'text-slate-600'}`}>{value ? 'Enabled' : 'Disabled'}</p>
    </button>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: 'red' | 'slate' | 'navy' }) {
  const toneClass =
    tone === 'red'
      ? 'bg-red-100 text-red-700'
      : tone === 'navy'
        ? 'bg-slate-900 text-white'
        : 'bg-slate-100 text-slate-600';

  return <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] ${toneClass}`}>{children}</span>;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="card text-center">
      <h3 className="text-lg font-bold text-slate-900">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-slate-600">{body}</p>
    </div>
  );
}

function StatisticCard({
  item,
  onSave,
}: {
  item: WebsiteStatisticItem & { draftOverride: number; draftEnabled: boolean };
  onSave: (payload: { label: string; description: string; overrideValue: number; isOverrideEnabled: boolean }) => Promise<void>;
}) {
  const [label, setLabel] = useState(item.label);
  const [description, setDescription] = useState(item.description ?? '');
  const [overrideValue, setOverrideValue] = useState(item.overrideValue ?? item.liveValue);
  const [isOverrideEnabled, setIsOverrideEnabled] = useState(item.isOverrideEnabled);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLabel(item.label);
    setDescription(item.description ?? '');
    setOverrideValue(item.overrideValue ?? item.liveValue);
    setIsOverrideEnabled(item.isOverrideEnabled);
  }, [item.id, item.label, item.description, item.overrideValue, item.liveValue, item.isOverrideEnabled]);

  return (
    <form
      className="card space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        try {
          await onSave({ label, description, overrideValue, isOverrideEnabled });
        } finally {
          setSaving(false);
        }
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{item.key.replace(/_/g, ' ')}</p>
          <h3 className="mt-2 text-2xl font-black text-primary">
            {isOverrideEnabled ? overrideValue.toLocaleString() : item.liveValue.toLocaleString()}
          </h3>
        </div>
        <Badge tone={isOverrideEnabled ? 'red' : 'navy'}>{isOverrideEnabled ? 'Override On' : 'Live Data'}</Badge>
      </div>
      <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-slate-700">
        Live database value: <span className="font-bold text-slate-900">{item.liveValue.toLocaleString()}</span>
      </div>
      <label className="block text-sm font-semibold text-slate-700">
        Card Label
        <input className={inputClass} value={label} onChange={(e) => setLabel(e.target.value)} />
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        Card Description
        <textarea className={textareaClass} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        Override Value
        <input className={inputClass} min={0} type="number" value={overrideValue} onChange={(e) => setOverrideValue(Number(e.target.value || 0))} />
      </label>
      <ToggleTile label="Enable Override" value={isOverrideEnabled} onChange={setIsOverrideEnabled} />
      <button className="btn-primary w-full" disabled={saving} type="submit">
        {saving ? 'Saving...' : 'Save Statistic'}
      </button>
    </form>
  );
}
