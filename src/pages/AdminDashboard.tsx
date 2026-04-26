import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { Candidate, DocumentEntry, CandidateStatus, DocumentStatus, SystemSettings, DocumentType, Course, ServiceRequest, RequestStatus, AdminUser } from '../types';
import { 
  Users, Search, Filter, MessageCircle, CheckCircle2, XCircle, 
  Eye, FileText, ChevronRight, ArrowLeft, Loader2, Send,
  LayoutDashboard, BookOpen, Settings, Plus, Shield, X,
  Download, Briefcase, UserPlus, Trash2, PieChart
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'candidates' | 'courses' | 'requests' | 'admins' | 'settings'>('candidates');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [candidateDocs, setCandidateDocs] = useState<DocumentEntry[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [isAddingCourse, setIsAddingCourse] = useState(false);
  const [newCourse, setNewCourse] = useState({ name: '', total: 0 });
  const [storageUsage, setStorageUsage] = useState({ used: 0, total: 1024 * 1024 * 1024 }); // 1GB default free limit
  const [isCleaningStorage, setIsCleaningStorage] = useState(false);

  useEffect(() => {
    // Fetch storage usage
    const fetchStorageUsage = async () => {
      if (!isSupabaseConfigured) return;
      try {
        const { data, error } = await supabase.storage.from('documentos-temporarios').list('', { limit: 1000 });
        if (data) {
          // Note: This is an estimation by listing root files. 
          // For nested folders like candidate_id/, we'd need a recursive approach or a metadata table.
          // For simplicity in this architectural demo:
          const totalSize = data.reduce((acc, file) => acc + (file.metadata?.size || 0), 0);
          setStorageUsage(prev => ({ ...prev, used: totalSize }));
        }
      } catch (err) {
        console.error("Error fetching storage usage:", err);
      }
    };
    fetchStorageUsage();
  }, []);

  const handleDeleteFromStorage = async (docEntry: DocumentEntry) => {
    if (!isSupabaseConfigured) {
      alert("Supabase não está configurado.");
      return;
    }
    if (!docEntry.storagePath) {
      alert("Este documento não possui caminho de armazenamento no Supabase.");
      return;
    }

    if (!confirm("Tem certeza que deseja remover este arquivo do Supabase? Isso liberará espaço, mas o arquivo não poderá mais ser visualizado no portal.")) {
      return;
    }

    try {
      const { error } = await supabase.storage
        .from('documentos-temporarios')
        .remove([docEntry.storagePath]);

      if (error) throw error;

      // Update Database
      await supabase
        .from('documents')
        .update({ storage_url: '', storage_deleted: true })
        .eq('id', docEntry.id);

      setCandidateDocs(prev => prev.map(d => d.id === docEntry.id ? { ...d, storageUrl: '', storageDeleted: true } : d));
      alert("Arquivo removido do Supabase com sucesso!");
    } catch (err: any) {
      alert("Erro ao remover do storage: " + err.message);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // 1. Candidatos
        const { data: candidatesData } = await supabase.from('candidates').select('*');
        if (candidatesData) {
          setCandidates(candidatesData.map(c => ({
            uid: c.uid,
            name: c.name,
            socialName: c.social_name,
            cpf: c.cpf,
            birthDate: c.birth_date,
            status: c.status as CandidateStatus,
            phone: c.phone,
            email: c.email_contact,
            createdAt: c.created_at
          } as Candidate)));
        }

        // 2. Cursos
        const { data: coursesData } = await supabase.from('courses').select('*');
        if (coursesData) setCourses(coursesData.map(c => ({ id: c.id, ...c } as Course)));

        // 3. Solicitações
        const { data: requestsData } = await supabase.from('requests').select('*').order('created_at', { ascending: false });
        if (requestsData) {
          setRequests(requestsData.map(r => ({
            id: r.id,
            candidateId: r.candidate_id,
            candidateName: r.candidate_name,
            candidatePhone: r.candidate_phone,
            type: r.type,
            description: r.description,
            status: r.status as RequestStatus,
            createdAt: r.created_at
          } as ServiceRequest)));
        }

        // 4. Configurações
        const { data: settingsData } = await supabase.from('system_config').select('*').single();
        if (settingsData) {
          setSystemSettings(settingsData as unknown as SystemSettings);
        } else {
          const defaultConfig: SystemSettings = {
            formFields: {
              socialName: { enabled: true, required: false, label: 'Nome Social' },
              fatherName: { enabled: true, required: false, label: 'Nome do Pai' },
              motherName: { enabled: true, required: false, label: 'Nome da Mãe' },
              guardianName: { enabled: true, required: true, label: 'Responsável Legal' },
              address: { enabled: true, required: true, label: 'Endereço' },
              phone: { enabled: true, required: true, label: 'Telefone' },
              email: { enabled: true, required: true, label: 'E-mail' },
              photo: { enabled: true, required: true, label: 'Foto de Perfil' },
              gender: { enabled: true, required: false, label: 'Gênero' },
              civilStatus: { enabled: true, required: false, label: 'Estado Civil' },
              race: { enabled: true, required: false, label: 'Raça/Etnia' },
              isPcd: { enabled: true, required: false, label: 'Pessoa com Deficiência (PCD)' },
              lastSchool: { enabled: true, required: false, label: 'Última Escola Frequentada' }
            },
            mandatoryDocuments: { [DocumentType.RG]: true, [DocumentType.CPF]: true },
            useAIValidation: false
          };
          setSystemSettings(defaultConfig);
        }

        // 5. Admins
        const { data: adminsData } = await supabase.from('admins').select('*');
        if (adminsData) setAdmins(adminsData.map(a => ({ uid: a.uid, ...a } as AdminUser)));

      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const selectCandidate = async (c: Candidate) => {
    setSelectedCandidate(c);
    try {
      const { data: docs } = await supabase
        .from('documents')
        .select('*')
        .eq('candidate_id', c.uid);
      
      if (docs) {
        setCandidateDocs(docs.map(d => ({
          id: d.id,
          candidateId: d.candidate_id,
          type: d.type as DocumentType,
          storageUrl: d.storage_url,
          storagePath: d.storage_path,
          status: d.status as DocumentStatus,
          feedback: d.feedback,
          createdAt: d.created_at
        })));
      }
    } catch (err) {
      console.error("Error fetching candidate docs:", err);
    }
  };

  const updateStatus = async (uid: string, status: CandidateStatus) => {
    await supabase.from('candidates').update({ status }).eq('uid', uid);
    if (selectedCandidate?.uid === uid) {
      setSelectedCandidate({ ...selectedCandidate, status });
    }
    setCandidates(prev => prev.map(c => c.uid === uid ? { ...c, status } : c));
  };

  const updateDocStatus = async (docId: string, status: DocumentStatus) => {
    if (!selectedCandidate) return;
    await supabase.from('documents').update({ status }).eq('id', docId);
    setCandidateDocs(candidateDocs.map(d => d.id === docId ? { ...d, status } : d));
  };

  const saveSettings = async (newSettings: SystemSettings) => {
    const { data: existing } = await supabase.from('system_config').select('*').single();
    if (existing) {
      await supabase.from('system_config').update(newSettings).eq('id', existing.id);
    } else {
      await supabase.from('system_config').insert([newSettings]);
    }
    setSystemSettings(newSettings);
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.from('courses').insert([{
        name: newCourse.name,
        total: Number(newCourse.total),
        vacancies: Number(newCourse.total),
        created_at: new Date().toISOString()
      }]);
      
      if (error) throw error;

      setIsAddingCourse(false);
      setNewCourse({ name: '', total: 0 });
      alert("Curso criado com sucesso!");
      
      // Refresh
      const { data } = await supabase.from('courses').select('*');
      if (data) setCourses(data.map(c => ({ id: c.id, ...c } as Course)));
    } catch (err: any) {
      alert("Erro ao criar curso: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRequestStatus = async (id: string, status: RequestStatus) => {
    await supabase.from('requests').update({ 
      status,
      updated_at: new Date().toISOString()
    }).eq('id', id);
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const email = (form.elements.namedItem('email') as HTMLInputElement).value?.toLowerCase().trim();
    
    if (!email) return;
    
    setLoading(true);
    try {
      const { error } = await supabase.from('admins').insert([{
        email,
        role: 'admin',
        created_at: new Date().toISOString()
      }]);

      if (error) throw error;

      form.reset();
      alert("Acesso administrativo concedido com sucesso para: " + email);
      
      // Refresh list
      const { data } = await supabase.from('admins').select('*');
      if (data) setAdmins(data.map(a => ({ uid: a.uid, ...a } as AdminUser)));
    } catch (err: any) {
      console.error("Error adding admin:", err);
      alert("Erro ao conceder acesso: " + (err.message || "Erro desconhecido"));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAdmin = async (admin: AdminUser) => {
    if (admin.email === 'maykon.euro@hotmail.com' || admin.email === 'maykon.euro@gmail.com') {
      alert("Este administrador mestre não pode ser removido.");
      return;
    }

    if (!confirm(`Deseja realmente remover o acesso de ${admin.email}?`)) return;

    setLoading(true);
    try {
      // Use logic to delete - if we have uid use it, otherwise email
      const { error } = await supabase
        .from('admins')
        .delete()
        .eq('email', admin.email);

      if (error) throw error;

      alert("Acesso removido com sucesso.");
      setAdmins(prev => prev.filter(a => a.email !== admin.email));
    } catch (err: any) {
      alert("Erro ao remover acesso: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = async () => {
    if (!selectedCandidate) return;
    
    const element = document.getElementById('candidate-profile');
    if (!element) return;

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
    });
    
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`ficha_${selectedCandidate.cpf}.pdf`);
  };

  const filteredCandidates = candidates.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || 
                          c.cpf.includes(search);
    const matchesFilter = filter === 'all' || c.status === filter;
    return matchesSearch && matchesFilter;
  });

  if (loading) return null;

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-80px)] flex flex-col">
      
      {/* Admin Sub-Nav */}
      <div className="bg-white border-b border-slate-200 px-6 overflow-x-auto no-scrollbar">
        <div className="max-w-7xl mx-auto flex gap-8">
          <button 
            onClick={() => setActiveTab('candidates')}
            className={`py-4 px-2 text-sm font-black uppercase tracking-[0.2em] border-b-2 transition-all whitespace-nowrap ${activeTab === 'candidates' ? 'border-sesi-blue text-sesi-blue' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            Matrículas
          </button>
          <button 
            onClick={() => setActiveTab('courses')}
            className={`py-4 px-2 text-sm font-black uppercase tracking-[0.2em] border-b-2 transition-all whitespace-nowrap ${activeTab === 'courses' ? 'border-sesi-blue text-sesi-blue' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            Cursos & Vagas
          </button>
          <button 
            onClick={() => setActiveTab('requests')}
            className={`py-4 px-2 text-sm font-black uppercase tracking-[0.2em] border-b-2 transition-all whitespace-nowrap ${activeTab === 'requests' ? 'border-sesi-blue text-sesi-blue' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            Secretaria Digital
          </button>
          <button 
            onClick={() => setActiveTab('admins')}
            className={`py-4 px-2 text-sm font-black uppercase tracking-[0.2em] border-b-2 transition-all whitespace-nowrap ${activeTab === 'admins' ? 'border-sesi-blue text-sesi-blue' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            Equipe
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`py-4 px-2 text-sm font-black uppercase tracking-[0.2em] border-b-2 transition-all whitespace-nowrap ${activeTab === 'settings' ? 'border-sesi-blue text-sesi-blue' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            Configurações
          </button>
        </div>
      </div>

      <div className="flex-1 py-8 px-4 flex flex-col md:flex-row gap-8 max-w-[1600px] mx-auto w-full">
        {activeTab === 'candidates' ? (
          <>
            {/* List Sidebar */}
            <div className={`w-full md:w-[400px] flex flex-col gap-6 ${selectedCandidate ? 'hidden md:flex' : 'flex'}`}>
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <h2 className="text-2xl font-black mb-6 flex items-center gap-2">
                  <Users size={24} className="text-sesi-blue" />
                  Candidaturas
                </h2>
                
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text" 
                      placeholder="Buscar por nome ou CPF..." 
                      className="w-full pl-12 pr-4 py-3 bg-slate-100 rounded-xl outline-none focus:ring-2 ring-sesi-blue/20 text-sm"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  
                  <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                    {['all', 'pending', 'approved', 'rejected'].map(f => (
                      <button 
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${filter === f ? 'bg-sesi-blue text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                      >
                        {f === 'all' ? 'Todos' : f === 'pending' ? 'Pendentes' : f === 'approved' ? 'Aprovados' : 'Recusados'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                {filteredCandidates.map(c => (
                  <button 
                    key={c.uid}
                    onClick={() => selectCandidate(c)}
                    className={`w-full p-4 rounded-3xl border text-left transition-all group ${selectedCandidate?.uid === c.uid ? 'bg-sesi-blue border-sesi-blue text-white shadow-xl shadow-blue-100 scale-[1.02]' : 'bg-white border-slate-200 hover:border-sesi-blue'}`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${selectedCandidate?.uid === c.uid ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                         {c.status}
                      </span>
                      <span className="text-[9px] opacity-60">24/04/2026</span>
                    </div>
                    <h4 className="font-bold truncate">{c.name}</h4>
                    <p className={`text-xs ${selectedCandidate?.uid === c.uid ? 'text-blue-100' : 'text-slate-500'}`}>{c.cpf}</p>
                  </button>
                ))}
                {filteredCandidates.length === 0 && (
                  <div className="text-center py-20 text-slate-400">
                     Nenhum candidato encontrado.
                  </div>
                )}
              </div>
            </div>

            {/* Candidate Detail Area */}
            <div className="flex-1">
              <AnimatePresence mode="wait">
                {selectedCandidate ? (
                  <motion.div 
                    key={selectedCandidate.uid}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-6"
                  >
                    {/* Header */}
                    <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                      <div className="flex items-center gap-6">
                        <button 
                          onClick={() => setSelectedCandidate(null)}
                          className="md:hidden p-3 bg-slate-100 rounded-2xl"
                        >
                          <ArrowLeft size={20} />
                        </button>
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            {selectedCandidate.photoUrl && (
                              <img src={selectedCandidate.photoUrl} alt="Perfil" className="w-16 h-16 rounded-full object-cover border-2 border-sesi-blue p-0.5" />
                            )}
                            <div>
                               <h2 className="text-3xl font-black">{selectedCandidate.name}</h2>
                               {selectedCandidate.socialName && <p className="text-sm font-bold text-slate-400">Nome Social: {selectedCandidate.socialName}</p>}
                               {selectedCandidate.isLegacyStudent && (
                                 <span className="bg-orange-100 text-orange-700 text-[10px] font-black px-2 py-1 rounded-lg uppercase mt-1 inline-block">Ex-Aluno</span>
                               )}
                            </div>
                          </div>
                          <p className="text-slate-500 font-medium">{selectedCandidate.cpf} • {selectedCandidate.email} • {selectedCandidate.phone}</p>
                        </div>
                      </div>

                      <div className="flex gap-2 w-full md:w-auto">
                        <button 
                          onClick={exportToPDF}
                          className="flex-1 md:flex-none p-4 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 font-bold"
                        >
                          <Download size={20} />
                          Ficha PDF
                        </button>
                        <button 
                          onClick={() => window.open(`https://wa.me/${selectedCandidate.phone.replace(/\D/g, '')}`, '_blank')}
                          className="flex-1 md:flex-none p-4 bg-green-50 text-green-600 rounded-2xl hover:bg-green-100 transition-colors flex items-center justify-center gap-2 font-bold"
                        >
                          <MessageCircle size={20} />
                          WhatsApp
                        </button>
                        {selectedCandidate.status !== CandidateStatus.APPROVED && (
                          <button 
                            onClick={() => updateStatus(selectedCandidate.uid, CandidateStatus.APPROVED)}
                            className="flex-1 md:flex-none p-4 bg-sesi-blue text-white rounded-2xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-bold"
                          >
                            <CheckCircle2 size={20} />
                            Aprovar
                          </button>
                        )}
                        {selectedCandidate.status !== CandidateStatus.REJECTED && (
                          <button 
                            onClick={() => updateStatus(selectedCandidate.uid, CandidateStatus.REJECTED)}
                            className="flex-1 md:flex-none p-4 bg-white border-2 border-red-100 text-red-500 rounded-2xl hover:bg-red-50 transition-colors flex items-center justify-center gap-2 font-bold"
                          >
                            <XCircle size={20} />
                            Recusar
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Data & Docs */}
                    <div id="candidate-profile" className="grid lg:grid-cols-2 gap-6 bg-white p-8 rounded-[40px]">
                      <div className="space-y-8">
                        <h3 className="font-black text-xl flex items-center gap-2">
                          <FileText size={20} className="text-sesi-blue" />
                          Documentos Enviados
                        </h3>
                        
                        <div className="space-y-4">
                          {candidateDocs.map(docEntry => (
                            <div key={docEntry.id} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex flex-col gap-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${docEntry.status === DocumentStatus.VALID ? 'bg-green-100 text-green-600' : 'bg-white text-slate-400'}`}>
                                    <FileText size={24} />
                                  </div>
                                  <div>
                                    <p className="font-bold text-slate-800 text-sm">{docEntry.type}</p>
                                    <p className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full inline-block ${
                                      docEntry.status === DocumentStatus.VALID ? 'bg-green-100 text-green-700' : 
                                      docEntry.status === DocumentStatus.INVALID ? 'bg-red-100 text-red-700' : 
                                      'bg-blue-100 text-blue-700'
                                    }`}>
                                      {docEntry.status}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {docEntry.storageUrl ? (
                                    <>
                                      <a 
                                        href={docEntry.storageUrl} 
                                        target="_blank" 
                                        rel="noreferrer"
                                        className="p-3 bg-white text-sesi-blue rounded-2xl hover:bg-blue-50 transition-colors border border-slate-200"
                                      >
                                        <Eye size={18} />
                                      </a>
                                      {docEntry.storageProvider === 'supabase' && (
                                        <button 
                                          onClick={() => handleDeleteFromStorage(docEntry)}
                                          className="p-3 bg-white text-red-500 rounded-2xl hover:bg-red-50 transition-colors border border-slate-200"
                                          title="Mover para Arquivo Morto (Libera Espaço no Supabase)"
                                        >
                                          <Trash2 size={18} />
                                        </button>
                                      )}
                                    </>
                                  ) : (
                                    <span className="text-[10px] font-black text-slate-300 uppercase">Arquivo Removido</span>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex gap-2 border-t border-slate-200 pt-3">
                                <button 
                                  onClick={() => updateDocStatus(docEntry.id, DocumentStatus.VALID)}
                                  className="flex-1 py-2 bg-white text-green-600 border border-green-100 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-green-50"
                                >
                                  Validar
                                </button>
                                <button 
                                  onClick={() => updateDocStatus(docEntry.id, DocumentStatus.INVALID)}
                                  className="flex-1 py-2 bg-white text-red-600 border border-red-100 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-red-50"
                                >
                                  Recusar
                                </button>
                              </div>
                            </div>
                          ))}
                          {candidateDocs.length === 0 && (
                            <div className="text-center py-12 text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl">
                              Nenhum documento enviado ainda.
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="card-sesi">
                         <h3 className="font-black text-xl mb-6">Informações do Candidato</h3>
                         <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                               <div>
                                  <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider mb-1">Curso Selecionado</p>
                                  <p className="font-bold text-sesi-blue">{courses.find(c => c.id === selectedCandidate.selectedCourseId)?.name || 'Não selecionado'}</p>
                               </div>
                               <div>
                                  <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider mb-1">Nascimento</p>
                                  <p className="font-bold">{selectedCandidate.birthDate.split('-').reverse().join('/')}</p>
                               </div>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-6 pt-4 border-t border-slate-50">
                               <div>
                                  <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider mb-1">Pai</p>
                                  <p className="font-bold text-sm">{selectedCandidate.fatherName || '-'}</p>
                               </div>
                               <div>
                                  <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider mb-1">Mãe</p>
                                  <p className="font-bold text-sm">{selectedCandidate.motherName || '-'}</p>
                                </div>
                                <div>
                                   <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider mb-1">Responsável</p>
                                   <p className="font-bold text-sm">{selectedCandidate.guardianName || '-'}</p>
                                </div>
                             </div>

                             <div>
                                <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider mb-1">Endereço</p>
                                <p className="text-sm font-medium text-slate-600 leading-relaxed">{selectedCandidate.address || 'Não informado'}</p>
                             </div>

                             <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-50">
                                <div>
                                  <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider mb-1">Gênero</p>
                                  <p className="font-bold text-sm">{selectedCandidate.gender || '-'}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider mb-1">Estado Civil</p>
                                  <p className="font-bold text-sm">{selectedCandidate.civilStatus || '-'}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider mb-1">Raça/Etnia</p>
                                  <p className="font-bold text-sm">{selectedCandidate.race || '-'}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider mb-1">PCD</p>
                                  <p className="font-bold text-sm text-sesi-orange">{selectedCandidate.isPcd ? `Sim (${selectedCandidate.pcdType})` : 'Não'}</p>
                                </div>
                             </div>

                             <div>
                                <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider mb-1">Última Escola</p>
                                <p className="text-sm font-bold">{selectedCandidate.lastSchool || '-'}</p>
                             </div>
                          </div>
                       </div>
                    </div>
                  </motion.div>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 border-4 border-dashed border-slate-100 rounded-[60px] p-20 text-center">
                    <div>
                      <Users size={64} className="mx-auto mb-6 opacity-20" />
                      <h3 className="text-2xl font-black mb-2">Gestão de Matrículas</h3>
                      <p className="max-w-xs mx-auto text-sm">Selecione um candidato para conferir documentos e aprovar a inscrição.</p>
                    </div>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </>
        ) : activeTab === 'courses' ? (
          <div className="w-full space-y-8">
            <div className="flex justify-between items-center bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm transition-all hover:shadow-md">
               <div>
                  <h2 className="text-3xl font-black text-slate-800">Gerenciar Cursos</h2>
                  <p className="text-slate-400 font-medium">Personalize a oferta de cursos e controle as vagas disponíveis.</p>
               </div>
               <button 
                 onClick={() => setIsAddingCourse(true)}
                 className="btn-sesi-primary shadow-xl shadow-blue-100"
               >
                  <Plus size={20} />
                  Novo Curso
               </button>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
               {courses.map(c => (
                 <motion.div 
                   layout 
                   initial={{ opacity: 0, scale: 0.9 }}
                   animate={{ opacity: 1, scale: 1 }}
                   key={c.id} 
                   className="card-sesi group relative overflow-hidden"
                 >
                    <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                       <button className="p-2 text-slate-300 hover:text-sesi-blue"><Settings size={18} /></button>
                    </div>
                    <div className="w-12 h-12 bg-blue-100 text-sesi-blue rounded-2xl flex items-center justify-center mb-6">
                       <BookOpen size={24} />
                    </div>
                    <h4 className="text-xl font-black mb-2 text-slate-800">{c.name}</h4>
                    <div className="space-y-4 pt-4 border-t border-slate-50">
                       <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-slate-400 uppercase tracking-widest">Matriculados:</span>
                          <span className="font-black text-sesi-blue">{c.total - c.vacancies} / {c.total}</span>
                       </div>
                       <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <motion.div 
                             initial={{ width: 0 }}
                             animate={{ width: `${((c.total - c.vacancies) / c.total) * 100}%` }}
                             className="h-full bg-sesi-blue" 
                          />
                       </div>
                       <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400">
                          <span>Vagas Disponíveis:</span>
                          <span className={`${c.vacancies > 0 ? 'text-green-500' : 'text-red-500'}`}>{c.vacancies}</span>
                       </div>
                    </div>
                 </motion.div>
               ))}
               {courses.length === 0 && (
                 <div className="col-span-full py-20 text-center border-4 border-dashed border-slate-100 rounded-[40px]">
                    <BookOpen size={48} className="mx-auto text-slate-200 mb-4" />
                    <p className="text-slate-400 font-bold">Nenhum curso cadastrado ainda.</p>
                 </div>
               )}
            </div>

            {/* Add Course Modal */}
            <AnimatePresence>
              {isAddingCourse && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsAddingCourse(false)}
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                  />
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl relative z-10 overflow-hidden"
                  >
                    <div className="p-8 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="text-2xl font-black">Adicionar Novo Curso</h3>
                      <button onClick={() => setIsAddingCourse(false)} className="p-2 hover:bg-slate-100 rounded-full">
                        <X size={20} />
                      </button>
                    </div>
                    <form onSubmit={handleCreateCourse} className="p-8 space-y-6">
                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-slate-400">Nome do Curso</label>
                        <input 
                          required
                          type="text" 
                          className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 ring-sesi-blue/20"
                          placeholder="Ex: Ensino Médio - Matutino"
                          value={newCourse.name}
                          onChange={e => setNewCourse({ ...newCourse, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-slate-400">Total de Vagas</label>
                        <input 
                          required
                          type="number" 
                          className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 ring-sesi-blue/20"
                          placeholder="100"
                          value={newCourse.total || ''}
                          onChange={e => setNewCourse({ ...newCourse, total: parseInt(e.target.value) })}
                        />
                      </div>
                      <button type="submit" className="btn-sesi-primary w-full py-5 text-sm uppercase tracking-widest">
                        Criar Curso
                      </button>
                    </form>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </div>
        ) : activeTab === 'requests' ? (
          <div className="w-full space-y-8">
             <div className="grid md:grid-cols-4 gap-6">
                {[
                  { label: 'Pendentes', count: requests.filter(r => r.status === RequestStatus.PENDING).length, color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: 'Resolvidas', count: requests.filter(r => r.status === RequestStatus.RESOLVED).length, color: 'text-green-600', bg: 'bg-green-50' },
                  { label: 'Indeferidas', count: requests.filter(r => r.status === RequestStatus.REJECTED).length, color: 'text-red-600', bg: 'bg-red-50' },
                  { label: 'Total', count: requests.length, color: 'text-slate-600', bg: 'bg-white' }
                ].map((stat, i) => (
                  <div key={i} className={`p-8 rounded-[40px] border border-slate-200 shadow-sm ${stat.bg}`}>
                     <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{stat.label}</p>
                     <p className={`text-4xl font-black ${stat.color}`}>{stat.count}</p>
                  </div>
                ))}
             </div>

             <div className="bg-white rounded-[40px] border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                   <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                         <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Candidato</th>
                         <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Solicitação</th>
                         <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                         <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Contato</th>
                         <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Ações</th>
                      </tr>
                   </thead>
                   <tbody>
                      {requests.map(req => (
                        <tr key={req.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                           <td className="p-6">
                              <p className="font-bold text-slate-800">{req.candidateName}</p>
                           </td>
                           <td className="p-6">
                              <p className="font-bold text-sesi-blue">{req.type}</p>
                              <p className="text-xs text-slate-500">{req.description}</p>
                           </td>
                           <td className="p-6">
                              <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${
                                 req.status === RequestStatus.RESOLVED ? 'bg-green-100 text-green-700' : 
                                 req.status === RequestStatus.REJECTED ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                              }`}>
                                 {req.status}
                              </span>
                           </td>
                           <td className="p-6">
                              {req.candidatePhone ? (
                                 <button 
                                   onClick={() => window.open(`https://wa.me/${req.candidatePhone?.replace(/\D/g, '')}`, '_blank')}
                                   className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 font-bold text-xs"
                                 >
                                   <MessageCircle size={14} />
                                   WhatsApp
                                 </button>
                              ) : (
                                 <span className="text-[10px] text-slate-300 uppercase font-black">Sem Telefone</span>
                              )}
                           </td>
                           <td className="p-6">
                              <div className="flex gap-2">
                                 <button 
                                   onClick={() => handleUpdateRequestStatus(req.id, RequestStatus.RESOLVED)}
                                   className="p-2 bg-green-50 text-green-600 rounded-xl hover:bg-green-100"
                                 >
                                    <CheckCircle2 size={18} />
                                 </button>
                                 <button 
                                    onClick={() => handleUpdateRequestStatus(req.id, RequestStatus.REJECTED)}
                                    className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100"
                                 >
                                    <XCircle size={18} />
                                 </button>
                              </div>
                           </td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>
        ) : activeTab === 'admins' ? (
          <div className="w-full space-y-8">
             <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm flex justify-between items-center">
                <div>
                  <h2 className="text-3xl font-black">Usuários Administrativos</h2>
                  <p className="text-slate-400 font-medium">Gerencie quem tem acesso ao painel de controle.</p>
                </div>
                <div className="bg-sesi-blue/10 p-4 rounded-3xl">
                   <Shield size={32} className="text-sesi-blue" />
                </div>
             </div>

             <div className="grid md:grid-cols-2 gap-8">
                <div className="card-sesi space-y-6">
                   <h3 className="font-black text-xl flex items-center gap-2">
                      <UserPlus size={20} className="text-sesi-blue" />
                      Adicionar Administrador
                   </h3>
                   <form onSubmit={handleAddAdmin} className="space-y-4">
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">E-mail do Usuário</label>
                         <input 
                           name="email"
                           type="email" 
                           placeholder="exemplo@email.com"
                           className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl" 
                         />
                      </div>
                      <button type="submit" className="btn-sesi-primary w-full py-4 uppercase tracking-widest">
                         Conceder Acesso
                      </button>
                   </form>
                </div>

                <div className="space-y-4">
                   <h3 className="font-black text-xl px-4">Equipe Atual</h3>
                   {admins.map(admin => (
                     <div key={admin.uid} className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex justify-between items-center transition-all hover:border-sesi-blue">
                        <div className="flex items-center gap-4">
                           <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400">
                             <Briefcase size={24} />
                           </div>
                           <div>
                              <p className="font-bold text-slate-800">{admin.email}</p>
                              <span className="text-[10px] font-black text-sesi-blue uppercase tracking-widest">{admin.role}</span>
                           </div>
                        </div>
                        <button 
                          onClick={() => handleDeleteAdmin(admin)}
                          className="p-3 text-slate-300 hover:text-red-500 transition-colors"
                        >
                           <Trash2 size={20} />
                        </button>
                     </div>
                   ))}
                </div>
             </div>
          </div>
        ) : (
          <div className="w-full max-w-4xl mx-auto space-y-8">
            <div className="flex justify-between items-center bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
               <div>
                  <h2 className="text-3xl font-black">Configurações do Sistema</h2>
                  <p className="text-slate-400 font-medium">Personalize formulários e regras de negócio.</p>
               </div>
               <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[10px] uppercase font-black text-slate-400 mb-1">Uso do Supabase Storage</p>
                    <div className="flex items-center gap-3">
                       <div 
                          className={`w-2 h-2 rounded-full ${isSupabaseConfigured ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`} 
                          title={isSupabaseConfigured ? 'Conectado ao Supabase' : 'Supabase Não Configurado'}
                       />
                       <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                             className={`h-full ${storageUsage.used / storageUsage.total > 0.8 ? 'bg-red-500' : 'bg-sesi-blue'}`}
                             style={{ width: `${Math.min((storageUsage.used / storageUsage.total) * 100, 100)}%` }}
                          />
                       </div>
                       <span className="text-xs font-black text-slate-700">
                          {isSupabaseConfigured ? `${(storageUsage.used / (1024 * 1024)).toFixed(1)}MB / 1GB` : 'N/A'}
                       </span>
                    </div>
                    {storageUsage.used / storageUsage.total > 0.8 && isSupabaseConfigured && (
                      <p className="text-[10px] text-red-500 font-black uppercase mt-1 animate-pulse">⚠️ Espaço Crítico</p>
                    )}
                    {!isSupabaseConfigured && (
                      <p className="text-[10px] text-red-500 font-black uppercase mt-1">⚠️ Supabase Não Configurado</p>
                    )}
                  </div>
                  <Shield size={40} className="text-sesi-blue/20 ml-4" />
               </div>
            </div>

            {!systemSettings ? (
              <div className="h-64 flex items-center justify-center bg-white rounded-[40px] border border-slate-200">
                <Loader2 className="animate-spin text-sesi-blue" size={32} />
              </div>
            ) : (
              <div className="space-y-8">
                <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm transition-all hover:shadow-md">
                   <h3 className="text-2xl font-black mb-6 flex items-center gap-2">
                      Personalização do Formulário
                   </h3>
                   <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {Object.entries(systemSettings.formFields || {}).map(([key, config]: [string, any]) => (
                        <div key={key} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex flex-col gap-4">
                           <div className="flex justify-between items-center underline-offset-4 mb-2">
                              <span className="font-black text-xs uppercase tracking-widest text-slate-700">{config.label}</span>
                           </div>
                           
                           <div className="space-y-3">
                              <label className="flex items-center justify-between cursor-pointer group">
                                 <span className="text-xs font-bold text-slate-500">Exibir Campo</span>
                                 <input 
                                   type="checkbox" 
                                   className="w-5 h-5 rounded-lg text-sesi-blue focus:ring-0"
                                   checked={config.enabled}
                                   onChange={(e) => saveSettings({
                                     ...systemSettings,
                                     formFields: {
                                        ...systemSettings.formFields,
                                        [key]: { ...config, enabled: e.target.checked }
                                     }
                                   })}
                                 />
                              </label>

                              <label className={`flex items-center justify-between cursor-pointer group ${!config.enabled ? 'opacity-20 pointer-events-none' : ''}`}>
                                 <span className="text-xs font-bold text-slate-500">Obrigatório</span>
                                 <input 
                                   type="checkbox" 
                                   className="w-5 h-5 rounded-lg text-sesi-blue focus:ring-0"
                                   checked={config.required}
                                   onChange={(e) => saveSettings({
                                     ...systemSettings,
                                     formFields: {
                                        ...systemSettings.formFields,
                                        [key]: { ...config, required: e.target.checked }
                                     }
                                   })}
                                 />
                              </label>
                           </div>
                        </div>
                      ))}
                   </div>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  <div className="card-sesi space-y-6">
                     <h3 className="font-black text-xl border-b border-slate-50 pb-4">Documentos Necessários</h3>
                     <div className="space-y-4">
                        {Object.values(DocumentType).map((type) => (
                          <label key={type} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl cursor-pointer group">
                             <span className="font-bold text-slate-700">{type}</span>
                             <input 
                               type="checkbox" 
                               className="w-6 h-6 rounded-lg text-sesi-blue focus:ring-0"
                               checked={systemSettings.mandatoryDocuments?.[type] || false}
                               onChange={(e) => saveSettings({
                                 ...systemSettings,
                                 mandatoryDocuments: {
                                    ...(systemSettings.mandatoryDocuments || {}),
                                    [type]: e.target.checked
                                 }
                               })}
                             />
                          </label>
                        ))}
                     </div>
                  </div>

                  <div className="card-sesi flex flex-col justify-between">
                     <div>
                        <h3 className="font-black text-xl border-b border-slate-50 pb-4 mb-6">Automação de IA</h3>
                        <div className="flex items-center justify-between">
                           <div>
                              <h4 className="font-bold text-slate-700">Validação por IA</h4>
                              <p className="text-slate-400 text-xs mt-1">Analisar documentos automaticamente usando Google Gemini.</p>
                           </div>
                           <button 
                             onClick={() => saveSettings({ ...systemSettings, useAIValidation: !systemSettings.useAIValidation })}
                             className={`w-16 h-8 rounded-full transition-all relative ${systemSettings.useAIValidation ? 'bg-sesi-blue' : 'bg-slate-200'}`}
                           >
                             <div className={`w-6 h-6 bg-white rounded-full absolute top-1 transition-all ${systemSettings.useAIValidation ? 'left-9' : 'left-1'}`}></div>
                           </button>
                        </div>
                     </div>
                     
                     <div className="mt-8 p-6 bg-blue-50 rounded-[32px] border border-blue-100">
                        <p className="text-xs text-blue-700 font-bold leading-relaxed italic">
                           "Dica: Ativar a validação por IA ajuda a agilizar o processo de revisão manual, mas lembre-se que a decisão final de aprovação é sempre humana."
                        </p>
                     </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
