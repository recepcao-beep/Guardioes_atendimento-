import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, Bot, Calendar, Check, ClipboardList, MessageCircle,
  Phone, RefreshCw, Search, UserCheck, X
} from 'lucide-react';
import { BookingContactStatus, BookingLead, Profile, ReviewInvite, Sector } from '../../types';
import { ApiService } from '../../lib/api';

interface BookingListViewProps {
  user: Profile;
  profiles: Profile[];
  sectors: Sector[];
  invites: ReviewInvite[];
  weights: Record<string, number>;
  onRefresh: () => void;
}

const toISODate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const raw = String(value);
  const date = new Date(raw.includes('T') ? raw : `${raw}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('pt-BR');
};

const normalizeContactStatus = (value: unknown): BookingContactStatus => {
  return value === 'contacted' || value === 'not_contacted' || value === 'pending' ? value : 'pending';
};

const normalizeLead = (lead: any, index: number): BookingLead => ({
  id: String(lead?.id || lead?.folio_identifier || `booking-lead-${index}`),
  folio_identifier: String(lead?.folio_identifier || `booking-lead-${index}`),
  global_code: lead?.global_code ? String(lead.global_code) : null,
  guest_name: String(lead?.guest_name || 'Hospede Booking'),
  room_number: lead?.room_number ? String(lead.room_number) : null,
  stay_start: lead?.stay_start ? String(lead.stay_start) : null,
  stay_end: lead?.stay_end ? String(lead.stay_end) : null,
  phone: lead?.phone ? String(lead.phone) : null,
  company: String(lead?.company || 'BOOKING.COM'),
  status: String(lead?.status || 'Fechado'),
  contact_status: normalizeContactStatus(lead?.contact_status),
  contact_notes: lead?.contact_notes ? String(lead.contact_notes) : null,
  review_converted: !!lead?.review_converted,
  complaint_generated: !!lead?.complaint_generated,
  contacted_at: lead?.contacted_at ? String(lead.contacted_at) : null,
  contacted_by: lead?.contacted_by ? String(lead.contacted_by) : null,
  created_at: lead?.created_at ? String(lead.created_at) : new Date().toISOString(),
  updated_at: lead?.updated_at ? String(lead.updated_at) : new Date().toISOString()
});

const getPhoneOptions = (phone?: string | null): string[] => {
  if (!phone) return [];
  const seen = new Set<string>();
  return String(phone)
    .split(/[\/,;|\n]+/)
    .map(value => value.replace(/\D+/g, ''))
    .filter(value => value.length >= 8)
    .filter(value => {
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });
};

const formatPhone = (phone: string) => {
  const digits = phone.replace(/\D+/g, '');
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return digits;
};

const toWhatsAppPhone = (phone: string) => {
  const digits = phone.replace(/\D+/g, '');
  if (digits.startsWith('55')) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
};

const openWhatsAppForLead = (lead: BookingLead, phone: string) => {
  const guestFirstName = (lead.guest_name || 'hospede').split(' ')[0];
  const message = `Olá ${guestFirstName}, tudo bem? Aqui é da equipe do Hotel Vilage Inn. Foi um prazer receber você! Podemos te enviar o link para deixar sua avaliação sobre a hospedagem?`;
  const url = `https://api.whatsapp.com/send?phone=${toWhatsAppPhone(phone)}&text=${encodeURIComponent(message)}&type=phone_number&app_absent=0`;
  window.open(url, '_blank', 'noopener,noreferrer');
};

export default function BookingListView({
  user,
  profiles,
  sectors,
  onRefresh
}: BookingListViewProps) {
  const [leads, setLeads] = useState<BookingLead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [robotLoading, setRobotLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLead, setSelectedLead] = useState<BookingLead | null>(null);
  const [selectedPhone, setSelectedPhone] = useState('');
  const [contactStatus, setContactStatus] = useState<BookingContactStatus>('contacted');
  const [contactNotes, setContactNotes] = useState('');
  const [reviewConverted, setReviewConverted] = useState(false);
  const [complaintGenerated, setComplaintGenerated] = useState(false);
  const [savingContact, setSavingContact] = useState(false);

  const defaultTo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return toISODate(d);
  }, []);

  const defaultFrom = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return toISODate(d);
  }, []);

  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);

  const isAdmin = user.role === 'admin';

  const loadLeads = async () => {
    setLoadingLeads(true);
    try {
      const rows = await ApiService.getBookingLeads();
      setLeads((Array.isArray(rows) ? rows : []).map(normalizeLead));
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Falha ao carregar listagem Booking.' });
      setLeads([]);
    } finally {
      setLoadingLeads(false);
    }
  };

  useEffect(() => {
    loadLeads();
  }, []);

  const stats = useMemo(() => {
    const pending = leads.filter(lead => lead.contact_status === 'pending').length;
    const contacted = leads.filter(lead => lead.contact_status === 'contacted').length;
    const converted = leads.filter(lead => lead.review_converted).length;
    const complaints = leads.filter(lead => lead.complaint_generated).length;
    return { total: leads.length, pending, contacted, converted, complaints };
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return leads.filter(lead => {
      if (!search) return true;
      return [
        lead.guest_name,
        lead.room_number,
        lead.phone,
        lead.folio_identifier,
        lead.global_code,
        lead.contact_notes
      ].some(value => String(value || '').toLowerCase().includes(search));
    });
  }, [leads, searchTerm]);

  const openContactModal = (lead: BookingLead) => {
    const phones = getPhoneOptions(lead.phone);
    const firstPhone = phones[0] || '';
    setSelectedLead(lead);
    setSelectedPhone(firstPhone);
    const currentStatus = normalizeContactStatus(lead.contact_status);
    setContactStatus(currentStatus === 'pending' ? 'contacted' : currentStatus);
    setContactNotes(lead.contact_notes || '');
    setReviewConverted(!!lead.review_converted);
    setComplaintGenerated(!!lead.complaint_generated);
    if (firstPhone) {
      openWhatsAppForLead(lead, firstPhone);
    }
  };

  const saveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;
    setSavingContact(true);
    setFeedback(null);

    const res = await ApiService.updateBookingLeadContact(selectedLead.id, {
      contact_status: contactStatus,
      contact_notes: contactNotes.trim(),
      review_converted: reviewConverted,
      complaint_generated: complaintGenerated
    });

    if (res.error) {
      setFeedback({ type: 'error', message: res.error });
    } else if (res.lead) {
      const normalizedLead = normalizeLead(res.lead, 0);
      setLeads(prev => prev.map(lead => lead.id === normalizedLead.id ? normalizedLead : lead));
      setFeedback({ type: 'success', message: 'Contato registrado com sucesso.' });
      setSelectedLead(null);
      onRefresh();
    }
    setSavingContact(false);
  };

  const triggerRobot = async () => {
    setRobotLoading(true);
    setFeedback(null);
    const res = await ApiService.triggerBookingRobotWorkflow(dateFrom, dateTo);
    if (res.error) {
      setFeedback({ type: 'error', message: res.error });
    } else {
      setFeedback({ type: 'success', message: 'Robo Booking/HITS disparado. Aguarde a conclusao no GitHub Actions e atualize a listagem.' });
    }
    setRobotLoading(false);
  };

  return (
    <div id="booking-list-root" className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
        <div>
          <h2 className="font-sans font-bold text-2xl text-slate-900 dark:text-slate-50 tracking-tight flex items-center gap-2">
            <span className="p-1 px-1.5 bg-sky-500/10 text-sky-600 rounded">Booking.com</span>
            <span>Fila de contatos pos-checkout</span>
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 max-w-3xl">
            Hóspedes que já saíram do hotel, capturados no HITS com telefone, período de hospedagem e apartamento para abordagem ativa.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          {isAdmin && (
            <>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2">
                <Calendar className="h-4 w-4 text-slate-400" />
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="bg-transparent text-xs outline-none dark:text-white" />
                <span className="text-slate-400 text-xs">ate</span>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="bg-transparent text-xs outline-none dark:text-white" />
              </div>
              <button
                type="button"
                onClick={triggerRobot}
                disabled={robotLoading}
                className="rounded-xl bg-slate-900 px-4 py-3 text-xs font-bold text-white hover:bg-slate-800 flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {robotLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
                <span>{robotLoading ? 'Disparando...' : 'Buscar no HITS'}</span>
              </button>
            </>
          )}
          <button
            type="button"
            onClick={loadLeads}
            disabled={loadingLeads}
            className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-3 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 flex items-center justify-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loadingLeads ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className={`p-4 rounded-2xl text-xs flex items-start gap-3 border ${
          feedback.type === 'success'
            ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
            : 'bg-rose-50 border-rose-100 text-rose-800'
        }`}>
          {feedback.type === 'success' ? <Check className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          ['Total na lista', stats.total],
          ['Pendentes', stats.pending],
          ['Contatados', stats.contacted],
          ['Converteram', stats.converted],
          ['Geraram reclamação', stats.complaints]
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{label}</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="font-sans font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-sky-500" />
            <span>Hóspedes Booking extraídos do HITS</span>
          </h3>
          <div className="relative max-w-sm w-full md:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar hóspede, telefone, quarto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-xl text-xs outline-none focus:border-amber-500 dark:text-white"
            />
          </div>
        </div>

        {loadingLeads ? (
          <div className="py-16 text-center text-xs text-slate-400">
            <RefreshCw className="h-7 w-7 animate-spin mx-auto mb-3 text-amber-500" />
            Carregando listagem Booking...
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-16 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-950/20">
            <ClipboardList className="w-12 h-12 text-slate-300 dark:text-slate-700 stroke-1 mb-3" />
            <p className="text-xs font-sans font-bold text-slate-600 dark:text-slate-400">Nenhum hóspede Booking na fila</p>
            <p className="text-[10.5px] text-slate-400 dark:text-slate-500 max-w-xs mt-1 leading-relaxed">
              Escolha o período e clique em Buscar no HITS para o robô importar a listagem sem duplicar registros.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] uppercase tracking-wider font-bold text-slate-400">
                  <th className="pb-3 pt-1">Hóspede</th>
                  <th className="pb-3 pt-1">Apartamento</th>
                  <th className="pb-3 pt-1">Período</th>
                  <th className="pb-3 pt-1">Telefone</th>
                  <th className="pb-3 pt-1">Contato</th>
                  <th className="pb-3 pt-1 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 pr-3">
                      <div className="font-semibold text-slate-900 dark:text-white">{lead.guest_name}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{lead.folio_identifier}</div>
                    </td>
                    <td className="py-3.5 pr-3 font-mono text-slate-600 dark:text-slate-300">{lead.room_number || '-'}</td>
                    <td className="py-3.5 pr-3 text-slate-500">
                      {formatDate(lead.stay_start)} - {formatDate(lead.stay_end)}
                    </td>
                    <td className="py-3.5 pr-3">
                      <span className="font-mono text-slate-800 dark:text-slate-200">
                        {getPhoneOptions(lead.phone).map(formatPhone).join(' / ') || 'Sem telefone'}
                      </span>
                    </td>
                    <td className="py-3.5 pr-3">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                        lead.contact_status === 'contacted'
                          ? 'bg-emerald-50 text-emerald-700'
                          : lead.contact_status === 'not_contacted'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-amber-50 text-amber-700'
                      }`}>
                        {lead.contact_status === 'contacted' ? 'Realizado' : lead.contact_status === 'not_contacted' ? 'Não realizado' : 'Pendente'}
                      </span>
                    </td>
                    <td className="py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => openContactModal(lead)}
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-3 py-2 text-[11px] font-bold text-white hover:bg-emerald-600"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        <span>Contato</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-150 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-sans font-bold text-slate-950 dark:text-white text-base">Registrar contato</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Atualize o andamento do contato Booking.</p>
              </div>
              <button type="button" onClick={() => setSelectedLead(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={saveContact} className="space-y-4 text-xs">
              <div className="rounded-xl border border-slate-150 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Hóspede</p>
                <p className="mt-1 text-base font-sans font-black leading-tight text-slate-950 dark:text-white">
                  {selectedLead.guest_name}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Apto. {selectedLead.room_number || '-'} · {selectedLead.phone || 'sem telefone'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setContactStatus('contacted')}
                  className={`rounded-xl border px-3 py-3 font-bold ${contactStatus === 'contacted' ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'border-slate-200 text-slate-500'}`}
                >
                  Contato realizado
                </button>
                <button
                  type="button"
                  onClick={() => setContactStatus('not_contacted')}
                  className={`rounded-xl border px-3 py-3 font-bold ${contactStatus === 'not_contacted' ? 'bg-rose-50 border-rose-300 text-rose-800' : 'border-slate-200 text-slate-500'}`}
                >
                  Contato não realizado
                </button>
              </div>

              {getPhoneOptions(selectedLead.phone).length > 0 ? (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-emerald-900">WhatsApp do hóspede</span>
                    <MessageCircle className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {getPhoneOptions(selectedLead.phone).map(phone => (
                      <button
                        key={phone}
                        type="button"
                        onClick={() => {
                          setSelectedPhone(phone);
                          openWhatsAppForLead(selectedLead, phone);
                        }}
                        className={`rounded-lg border px-3 py-2 text-left font-mono font-bold transition-colors ${
                          selectedPhone === phone
                            ? 'border-emerald-400 bg-white text-emerald-800'
                            : 'border-emerald-100 bg-white/70 text-slate-600 hover:border-emerald-300'
                        }`}
                      >
                        {formatPhone(phone)}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-amber-800">
                  Nenhum telefone foi encontrado para este hóspede.
                </div>
              )}

              <textarea
                rows={4}
                value={contactNotes}
                onChange={(e) => setContactNotes(e.target.value)}
                placeholder="Observação: atendeu? pediu link? converteu em avaliação? gerou reclamação?"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-xs outline-none focus:border-amber-500 dark:text-white"
              />

              <label className="flex items-center gap-2 rounded-xl border border-slate-150 dark:border-slate-800 p-3 text-slate-700 dark:text-slate-200">
                <input type="checkbox" checked={reviewConverted} onChange={(e) => setReviewConverted(e.target.checked)} className="h-4 w-4 accent-emerald-500" />
                <span>Converteu em avaliação</span>
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-slate-150 dark:border-slate-800 p-3 text-slate-700 dark:text-slate-200">
                <input type="checkbox" checked={complaintGenerated} onChange={(e) => setComplaintGenerated(e.target.checked)} className="h-4 w-4 accent-rose-500" />
                <span>Gerou reclamação</span>
              </label>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setSelectedLead(null)} className="flex-1 rounded-xl border border-slate-200 py-2.5 font-bold text-slate-600 hover:bg-slate-50">
                  Cancelar
                </button>
                <button type="submit" disabled={savingContact} className="flex-1 rounded-xl bg-amber-500 py-2.5 font-bold text-slate-950 hover:bg-amber-600 flex items-center justify-center gap-2">
                  {savingContact ? <RefreshCw className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
                  <span>Salvar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
