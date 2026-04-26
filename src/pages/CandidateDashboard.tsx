import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { validateDocumentOCR } from '../lib/gemini';
import { motion } from 'motion/react';
import { Candidate, DocumentEntry, CandidateStatus, DocumentStatus, DocumentType, SystemSettings, ServiceRequest, RequestStatus } from '../types';
import { 
  FileText, Upload, CheckCircle2, AlertTriangle, Clock, 
  ChevronRight, RefreshCw, HelpCircle, Loader2, Info, MessageCircle,
  FileSearch, Plus, X
} from 'lucide-react';

export default function CandidateDashboard() {
  const navigate = useNavigate();
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [documents, setDocuments] = useState<DocumentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [newRequest, setNewRequest] = useState({ type: '', description: '' });
  const [requestLoading, setRequestLoading] = useState(false);

  useEffect(() => {
    const initDashboard = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      // 1. Carregar Perfil do Candidato
      const { data: profile } = await supabase
        .from('candidates')
        .select('*')
        .eq('uid', user.id)
        .single();

      if (profile) {
        setCandidate({
          uid: profile.uid,
          name: profile.name,
          socialName: profile.social_name,
          fatherName: profile.father_name,
          motherName: profile.mother_name,
          guardianName: profile.guardian_name,
          photoUrl: profile.photo_url,
          cpf: profile.cpf,
          birthDate: profile.birth_date,
          gender: profile.gender,
          civilStatus: profile.civil_status,
          race: profile.race,
          isPcd: profile.is_pcd,
          pcdType: profile.pcd_type,
          lastSchool: profile.last_school,
          email: profile.email_contact,
          phone: profile.phone,
          address: profile.address,
          selectedCourseId: profile.selected_course_id,
          isLegacyStudent: profile.is_legacy_student,
          status: profile.status as CandidateStatus
        });
      }

      // 2. Carregar Documentos
      const { data: docs } = await supabase
        .from('documents')
        .select('*')
        .eq('candidate_id', user.id);
      
      if (docs) {
        setDocuments(docs.map(d => ({
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

      // 3. Carregar Configurações
      const { data: config } = await supabase.from('system_config').select('*').single();
      if (config) {
        setSettings(config as unknown as SystemSettings);
      }

      // 4. Carregar Solicitações
      const { data: reqs } = await supabase
        .from('requests')
        .select('*')
        .eq('candidate_id', user.id)
        .order('created_at', { ascending: false });

      if (reqs) {
        setRequests(reqs.map(r => ({
          id: r.id,
          candidateId: r.candidate_id,
          type: r.type,
          description: r.description,
          status: r.status as RequestStatus,
          createdAt: r.created_at
        })));
      }

      setLoading(false);
    };

    initDashboard();
  }, [navigate]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: DocumentType) => {
    const file = e.target.files?.[0];
    if (!file || !candidate) return;

    setUploading(type);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      if (!isSupabaseConfigured) {
        throw new Error("Supabase Storage não configurado.");
      }

      const fileName = `${type}_${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
      const storagePath = `${user.id}/${fileName}`;
      const bucketName = 'documentos-temporarios';

      // 1. Upload para o Storage
      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(storagePath, file);

      if (uploadError) throw uploadError;
      
      // 2. Obter URL pública
      const { data: urlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(storagePath);

      // 3. Gravar registro na tabela de documentos
      const { data: newDoc, error: dbError } = await supabase.from('documents').insert([{
        candidate_id: user.id,
        type,
        storage_url: urlData.publicUrl,
        storage_path: storagePath,
        status: DocumentStatus.PENDING
      }]).select().single();

      if (dbError) throw dbError;

      const entry: DocumentEntry = {
        id: newDoc.id,
        candidateId: user.id,
        type,
        storageUrl: urlData.publicUrl,
        storagePath,
        status: DocumentStatus.PENDING,
        createdAt: new Date().toISOString()
      };
      setDocuments(prev => [...prev, entry]);

      alert('Documento enviado com sucesso! Aguarde a validação.');
    } catch (error: any) {
      console.error("[Upload] Erro:", error);
      alert(`Erro: ${error.message}`);
    } finally {
      setUploading(null);
    }
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidate) return;
    setRequestLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { data: req, error } = await supabase.from('requests').insert([{
        candidate_id: user.id,
        candidate_name: candidate.name,
        candidate_phone: candidate.phone,
        type: newRequest.type,
        description: newRequest.description,
        status: RequestStatus.PENDING
      }]).select().single();

      if (error) throw error;

      setRequests(prev => [({
        id: req.id,
        candidateId: user.id,
        type: req.type,
        description: req.description,
        status: RequestStatus.PENDING,
        createdAt: new Date().toISOString()
      }), ...prev]);

      setIsRequestModalOpen(false);
      setNewRequest({ type: '', description: '' });
    } catch (err: any) {
      console.error(err);
      alert(`Erro: ${err.message}`);
    } finally {
      setRequestLoading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-sesi-gray">
      <Loader2 className="animate-spin text-sesi-blue" size={48} />
    </div>
  );

  if (!candidate) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sesi-gray px-4">
        <div className="bg-white p-10 rounded-[40px] shadow-xl text-center max-w-md">
          <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <X size={40} />
          </div>
          <h2 className="text-2xl font-black mb-4">Perfil não encontrado</h2>
          <p className="text-slate-500 mb-8 font-medium">Houve um problema ao carregar seus dados. Por favor, tente realizar sua inscrição novamente ou entre em contato com o suporte.</p>
          <button 
            onClick={() => {
              supabase.auth.signOut();
              navigate('/register');
            }}
            className="btn-sesi-primary w-full py-4 uppercase tracking-widest text-sm"
          >
            Fazer Nova Inscrição
          </button>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: CandidateStatus) => {
    switch (status) {
      case CandidateStatus.APPROVED: return 'bg-green-100 text-green-700';
      case CandidateStatus.REJECTED: return 'bg-red-100 text-red-700';
      case CandidateStatus.ACTION_REQUIRED: return 'bg-orange-100 text-orange-700';
      default: return 'bg-blue-100 text-sesi-blue';
    }
  };

  const getStatusLabel = (status: CandidateStatus) => {
    switch (status) {
      case CandidateStatus.APPROVED: return 'Inscrição Aprovada';
      case CandidateStatus.REJECTED: return 'Inscrição Recusada';
      case CandidateStatus.ACTION_REQUIRED: return 'Ação Necessária';
      default: return 'Em Análise';
    }
  };

  const allPossibleDocs = [
    { type: DocumentType.RG, label: 'Identidade (RG)' },
    { type: DocumentType.CPF, label: 'CPF' },
    { type: DocumentType.SCHOOL_RECORD, label: 'Histórico Escolar' },
    { type: DocumentType.ADDRESS_PROOF, label: 'Comprovante de Residência' }
  ];

  // Filter required docs based on system settings
  const requiredDocs = settings 
    ? allPossibleDocs.filter(d => settings.mandatoryDocuments[d.type])
    : allPossibleDocs;

  return (
    <>
      <div className="bg-sesi-gray min-h-screen py-8 px-4">
        <div className="max-w-4xl mx-auto space-y-6">
          
          {/* Status Banner */}
          <div className="status-banner">
            <h2 className="text-sesi-orange font-black text-xs uppercase tracking-widest mb-2">Situação da sua Inscrição</h2>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <p className="text-3xl md:text-4xl font-bold text-slate-800">
                {candidate?.status === CandidateStatus.PENDING ? 'Documentação em Análise' : getStatusLabel(candidate?.status || CandidateStatus.PENDING)}
              </p>
              <span className={`px-6 py-2 rounded-full font-black text-xs uppercase tracking-widest ${getStatusColor(candidate?.status || CandidateStatus.PENDING)}`}>
                {candidate?.status === CandidateStatus.APPROVED ? 'Confirmado' : 'Aguarde'}
              </span>
            </div>
            <p className="mt-4 text-slate-500 text-lg leading-relaxed max-w-2xl">
              Sua inscrição para o curso de <strong className="text-slate-800">{candidate?.selectedCourseId === 'ensino-fundamental' ? 'Ensino Fundamental II' : 'Ensino Médio'}</strong> está sendo verificada pela nossa equipe.
            </p>
          </div>

          {/* Enrollment Step Guide */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-sesi-green text-white p-6 rounded-[32px] flex flex-col items-center text-center shadow-lg shadow-green-100">
              <div className="w-10 h-10 rounded-full bg-white text-sesi-green flex items-center justify-center font-black mb-3 text-lg">✓</div>
              <span className="text-xs uppercase font-black tracking-widest">Cadastro</span>
            </div>
            <div className={`${documents.length > 0 ? 'bg-sesi-blue' : 'bg-slate-200 text-slate-400'} text-white p-6 rounded-[32px] flex flex-col items-center text-center transition-all`}>
              <div className={`w-10 h-10 rounded-full ${documents.length > 0 ? 'bg-white text-sesi-blue' : 'bg-slate-300 text-white'} flex items-center justify-center font-black mb-3 text-lg`}>
                {documents.length >= requiredDocs.length ? '✓' : '2'}
              </div>
              <span className="text-xs uppercase font-black tracking-widest">Documentos</span>
            </div>
            <div className="bg-slate-100 text-slate-400 p-6 rounded-[32px] flex flex-col items-center text-center border-2 border-dashed border-slate-200">
              <div className="w-10 h-10 rounded-full bg-slate-300 text-white flex items-center justify-center font-black mb-3 text-lg">3</div>
              <span className="text-xs uppercase font-black tracking-widest">Entrevista</span>
            </div>
            <div className="bg-slate-100 text-slate-400 p-6 rounded-[32px] flex flex-col items-center text-center border-2 border-dashed border-slate-200">
              <div className="w-10 h-10 rounded-full bg-slate-300 text-white flex items-center justify-center font-black mb-3 text-lg">4</div>
              <span className="text-xs uppercase font-black tracking-widest">Matrícula</span>
            </div>
          </div>

          {/* Dashboard Grid */}
          <div className="grid md:grid-cols-3 gap-8">
            
            {/* Main Info */}
            <div className="md:col-span-2 space-y-8">
              <div className="card-sesi">
                <div className="flex justify-between items-end mb-8">
                  <div>
                    <h3 className="font-black text-2xl flex items-center gap-2">
                      Meus Documentos
                    </h3>
                    <p className="text-slate-400 text-sm">Acompanhe o status da sua documentação abaixo</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  {requiredDocs.map((docReq) => {
                    const uploaded = documents.find(d => d.type === docReq.type);
                    return (
                      <div 
                        key={docReq.type} 
                        className={`flex items-center justify-between p-6 rounded-[24px] border-2 transition-all ${
                          uploaded?.status === DocumentStatus.VALID ? 'border-green-100 bg-green-50' : 
                          uploaded?.status === DocumentStatus.INVALID ? 'border-red-100 bg-red-50' : 
                          uploaded?.status === DocumentStatus.PENDING ? 'border-blue-100 bg-blue-50/30' :
                          'border-slate-100 bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-5">
                          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black uppercase text-xs ${
                            uploaded?.status === DocumentStatus.VALID ? 'bg-white text-sesi-green border border-green-200' : 
                            uploaded?.status === DocumentStatus.INVALID ? 'bg-white text-red-500 border border-red-200' : 
                            uploaded?.status === DocumentStatus.PENDING ? 'bg-white text-blue-500 border border-blue-200 animate-pulse' :
                            'bg-white text-slate-400 border border-slate-200'
                          }`}>
                            {uploaded?.status === DocumentStatus.PROCESSING ? <Loader2 className="animate-spin" /> : (uploaded?.type || docReq.type)}
                          </div>
                          <div>
                            <p className="font-black text-slate-800">{docReq.label}</p>
                            <p className={`text-[10px] font-black leading-tight mt-1 uppercase tracking-widest ${
                              uploaded?.status === DocumentStatus.VALID ? 'text-green-700' : 
                              uploaded?.status === DocumentStatus.INVALID ? 'text-red-700' : 
                              uploaded?.status === DocumentStatus.PENDING ? 'text-blue-700' :
                              'text-slate-400'
                            }`}>
                              {uploaded ? (
                                <>{
                                  uploaded.status === DocumentStatus.VALID ? 'Documento Validado' : 
                                  uploaded.status === DocumentStatus.INVALID ? (uploaded.feedback || 'Documento Inválido') : 
                                  'Aguardando Validação Manual'
                                }</>
                              ) : 'Aguardando envio'}
                            </p>
                          </div>
                        </div>

                        {uploaded ? (
                          <div className="flex items-center gap-3">
                            {uploaded.status === DocumentStatus.INVALID && (
                               <label className="cursor-pointer bg-red-500 text-white px-5 py-2 rounded-full text-xs font-black shadow-lg shadow-red-100 active:scale-95 transition-all">
                                 REENVIAR
                                 <input type="file" className="hidden" accept="image/*,.pdf" onChange={(e) => handleFileUpload(e, docReq.type)} />
                               </label>
                            )}
                            {uploaded.status === DocumentStatus.VALID && (
                              <div className="w-8 h-8 bg-sesi-green rounded-full flex items-center justify-center text-white shadow-lg shadow-green-100">
                                <CheckCircle2 size={18} />
                              </div>
                            )}
                            {uploaded.status === DocumentStatus.PENDING && (
                              <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-50">
                                <Clock size={16} />
                              </div>
                            )}
                          </div>
                        ) : (
                          <label className="cursor-pointer relative overflow-hidden group">
                             <div className={`bg-sesi-blue text-white px-6 py-2 rounded-full text-xs font-black shadow-lg shadow-blue-100 hover:bg-blue-800 transition-all active:scale-95 flex items-center gap-2 ${uploading === docReq.type ? 'opacity-50' : ''}`}>
                               {uploading === docReq.type ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
                               ENVIAR
                             </div>
                             <input 
                                 type="file" 
                                 className="hidden" 
                                 disabled={!!uploading}
                                 accept="image/*,.pdf"
                                 onChange={(e) => handleFileUpload(e, docReq.type)} 
                             />
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Secretaria Digital */}
              <div className="card-sesi">
                 <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="font-black text-2xl flex items-center gap-2">
                         Secretaria Digital
                      </h3>
                      <p className="text-slate-400 text-sm">Solicite declarações e outros documentos à secretaria</p>
                    </div>
                    <button 
                      onClick={() => setIsRequestModalOpen(true)}
                      className="p-3 bg-sesi-blue text-white rounded-full shadow-lg hover:rotate-90 transition-all active:scale-90"
                    >
                      <Plus size={24} />
                    </button>
                 </div>

                 <div className="space-y-4">
                    {requests.map(req => (
                      <div key={req.id} className="p-5 bg-white border border-slate-100 rounded-3xl flex justify-between items-center group hover:border-sesi-blue transition-all">
                         <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                               req.status === RequestStatus.RESOLVED ? 'bg-green-100 text-green-600' : 
                               req.status === RequestStatus.REJECTED ? 'bg-red-100 text-red-600' : 'bg-blue-50 text-sesi-blue'
                            }`}>
                              <FileSearch size={22} />
                            </div>
                            <div>
                               <p className="font-bold text-slate-800">{req.type}</p>
                               <p className="text-xs text-slate-400 truncate max-w-[200px]">{req.description}</p>
                            </div>
                         </div>
                         <div className="text-right">
                            <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full ${
                               req.status === RequestStatus.RESOLVED ? 'bg-green-100 text-green-700' : 
                               req.status === RequestStatus.REJECTED ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                               {req.status}
                            </span>
                         </div>
                      </div>
                    ))}
                    {requests.length === 0 && (
                      <div className="text-center py-10 text-slate-400 border-2 border-dashed border-slate-50 rounded-3xl">
                         Nenhuma solicitação aberta.
                      </div>
                    )}
                 </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-8">
               <div className="card-sesi bg-sesi-blue-dark text-white shadow-xl shadow-blue-100">
                  <h4 className="text-blue-300 font-black uppercase text-[10px] tracking-widest mb-4">Seu Curso Escolhido</h4>
                  <p className="text-2xl font-black mb-6 leading-tight">{candidate?.selectedCourseId === 'ensino-fundamental' ? 'Ensino Fundamental II' : 'Ensino Médio'}</p>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between text-xs border-b border-white/10 pb-3">
                      <span className="opacity-60 font-bold uppercase tracking-widest">Turno:</span>
                      <span className="font-black">Noturno</span>
                    </div>
                    <div className="flex justify-between text-xs border-b border-white/10 pb-3">
                      <span className="opacity-60 font-bold uppercase tracking-widest">Local:</span>
                      <span className="font-black">SESI Regional</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="opacity-60 font-bold uppercase tracking-widest">Vaga:</span>
                      <span className="font-black text-sesi-orange">Reservada</span>
                    </div>
                  </div>
               </div>

               <div className="bg-white rounded-[32px] p-8 shadow-sm flex flex-col justify-center items-center text-center gap-5 border-2 border-blue-50">
                  <div className="w-16 h-16 bg-blue-50 text-sesi-blue rounded-full flex items-center justify-center">
                    <HelpCircle size={32} />
                  </div>
                  <div>
                    <p className="font-black text-xl">Dúvidas?</p>
                    <p className="text-slate-500 text-sm font-medium">Fale agora com um orientador do SESI</p>
                  </div>
                  <button 
                    onClick={() => window.open('https://wa.me/5511999999999', '_blank')}
                    className="w-full btn-sesi-green"
                  >
                    <MessageCircle size={24} />
                    WhatsApp
                  </button>
               </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Request Modal */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
             initial={{ opacity: 0 }} 
             animate={{ opacity: 1 }} 
             exit={{ opacity: 0 }} 
             onClick={() => setIsRequestModalOpen(false)}
             className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl relative z-10 overflow-hidden"
          >
            <div className="p-8 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-2xl font-black">Nova Solicitação</h3>
              <button onClick={() => setIsRequestModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateRequest} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Tipo de Documento</label>
                <select 
                  required
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 ring-sesi-blue/20 appearance-none font-bold text-slate-700"
                  value={newRequest.type}
                  onChange={e => setNewRequest({ ...newRequest, type: e.target.value })}
                >
                  <option value="">Selecione um tipo...</option>
                  <option value="Declaração de Matrícula">Declaração de Matrícula</option>
                  <option value="Declaração de Frequência">Declaração de Frequência</option>
                  <option value="Histórico Parcial">Histórico Parcial</option>
                  <option value="Passe Escolar">Passe Escolar (Formulário)</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Observações / Motivo</label>
                <textarea 
                  required
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 ring-sesi-blue/20 min-h-[120px]"
                  placeholder="Descreva brevemente sua necessidade..."
                  value={newRequest.description}
                  onChange={e => setNewRequest({ ...newRequest, description: e.target.value })}
                />
              </div>
              <button 
                type="submit" 
                disabled={requestLoading}
                className="btn-sesi-primary w-full py-5 text-sm uppercase tracking-widest shadow-xl shadow-blue-100"
              >
                {requestLoading ? <Loader2 className="animate-spin" /> : 'Enviar Solicitação'}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </>
  );
}
