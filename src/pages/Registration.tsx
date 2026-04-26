import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  User, Mail, Phone, Calendar, MapPin, CheckCircle2, ArrowRight, ArrowLeft, 
  ShieldCheck, Upload, Loader2, AlertCircle, Camera, X, Heart
} from 'lucide-react';
import { CandidateStatus, SystemSettings, Course } from '../types';

const registrationSchema = z.object({
  name: z.string().min(3, 'Nome muito curto'),
  socialName: z.string().optional(),
  fatherName: z.string().optional(),
  motherName: z.string().optional(),
  guardianName: z.string().optional(),
  cpf: z.string().min(11, 'CPF inválido'),
  birthDate: z.string().min(10, 'Data inválida'),
  gender: z.string().optional(),
  civilStatus: z.string().optional(),
  race: z.string().optional(),
  isPcd: z.boolean().optional(),
  pcdType: z.string().optional(),
  lastSchool: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  courseId: z.string().min(1, 'Selecione um curso'),
  isLegacyStudent: z.boolean().default(false)
});

type RegistrationData = z.infer<typeof registrationSchema>;

const currentYear = new Date().getFullYear();
const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
const months = [
  { v: '01', l: 'Janeiro' }, { v: '02', l: 'Fevereiro' }, { v: '03', l: 'Março' },
  { v: '04', l: 'Abril' }, { v: '05', l: 'Maio' }, { v: '06', l: 'Junho' },
  { v: '07', l: 'Julho' }, { v: '08', l: 'Agosto' }, { v: '09', l: 'Setembro' },
  { v: '10', l: 'Outubro' }, { v: '11', l: 'Novembro' }, { v: '12', l: 'Dezembro' }
];
const years = Array.from({ length: 90 }, (_, i) => String(currentYear - i));

export default function Registration() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [photo, setPhoto] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  
  const [birthDay, setBirthDay] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthYear, setBirthYear] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const loadData = async () => {
      // Migração: Busca configurações e cursos do Supabase
      const { data: configData } = await supabase.from('system_config').select('*').single();
      if (configData) {
        setSettings(configData as unknown as SystemSettings);
      }
      
      const { data: coursesData } = await supabase.from('courses').select('*');
      if (coursesData) {
        setCourses(coursesData as Course[]);
      }
    };
    loadData();
  }, []);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<RegistrationData>({
    resolver: zodResolver(registrationSchema) as any,
    defaultValues: {
      courseId: new URLSearchParams(window.location.search).get('course') || '',
      isLegacyStudent: false,
      birthDate: ''
    }
  });

  useEffect(() => {
    if (birthDay && birthMonth && birthYear) {
      setValue('birthDate', `${birthYear}-${birthMonth}-${birthDay}`);
    } else {
      setValue('birthDate', '');
    }
  }, [birthDay, birthMonth, birthYear, setValue]);

  const startCamera = async () => {
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera error:", err);
      setErrorMessage("Não foi possível acessar a câmera. Verifique as permissões.");
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setIsCameraOpen(false);
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        setPhoto(canvas.toDataURL('image/jpeg'));
        stopCamera();
      }
    }
  };

  const onSubmit = async (data: RegistrationData) => {
    if (settings) {
      const fields = settings.formFields;
      if (fields.socialName.enabled && fields.socialName.required && !data.socialName) { setErrorMessage('Nome Social é obrigatório.'); return; }
      if (fields.fatherName.enabled && fields.fatherName.required && !data.fatherName) { setErrorMessage('Nome do Pai é obrigatório.'); return; }
      if (fields.motherName.enabled && fields.motherName.required && !data.motherName) { setErrorMessage('Nome da Mãe é obrigatório.'); return; }
      if (fields.guardianName.enabled && fields.guardianName.required && !data.guardianName) { setErrorMessage('Responsável Legal é obrigatório.'); return; }
      if (fields.email.enabled && fields.email.required && !data.email) { setErrorMessage('E-mail é obrigatório.'); return; }
      if (fields.phone.enabled && fields.phone.required && !data.phone) { setErrorMessage('Telefone é obrigatório.'); return; }
      if (fields.address.enabled && fields.address.required && !data.address) { setErrorMessage('Endereço é obrigatório.'); return; }
      if (fields.photo.enabled && fields.photo.required && !photo) { setErrorMessage('A foto de perfil é obrigatória.'); return; }
    }

    setLoading(true);
    setErrorMessage('');
    try {
      const cleanCpf = data.cpf.replace(/\D/g, '');
      const email = `${cleanCpf}@eja-sesi.com.br`;
      const password = data.birthDate.replace(/\D/g, '');

      // 1. Criar usuário no Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Erro ao criar usuário.");

      // Format birth date for database (from DD/MM/AAAA to YYYY-MM-DD)
      const dateParts = data.birthDate.split('/');
      const formattedBirthDate = dateParts.length === 3 
        ? `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}` 
        : data.birthDate;

      // 2. Criar Perfil do Candidato no Supabase Database
      const { error: dbError } = await supabase.from('candidates').insert([{
        uid: authData.user.id,
        name: data.name,
        social_name: data.socialName || '',
        father_name: data.fatherName || '',
        mother_name: data.motherName || '',
        guardian_name: data.guardianName || '',
        photo_url: photo || '',
        cpf: data.cpf,
        birth_date: formattedBirthDate,
        gender: data.gender || '',
        civil_status: data.civilStatus || '',
        race: data.race || '',
        is_pcd: data.isPcd || false,
        pcd_type: data.pcdType || '',
        last_school: data.lastSchool || '',
        email_contact: data.email || '',
        phone: data.phone || '',
        address: data.address || '',
        selected_course_id: data.courseId,
        is_legacy_student: data.isLegacyStudent,
        status: CandidateStatus.PENDING
      }]);

      if (dbError) throw dbError;

      setStep(6);
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes('already exists') || err.code === '23505') {
        setErrorMessage('Este CPF já possui uma inscrição. Tente fazer login.');
      } else {
        setErrorMessage(`Erro ao processar inscrição: ${err.message || 'Tente novamente.'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    setErrorMessage('');
    setStep(step + 1);
  };
  const prevStep = () => setStep(step - 1);

  const stepsDescriptions = [
    { title: 'Início', icon: <User size={18} /> },
    { title: 'Família', icon: <Heart size={18} /> },
    { title: 'Foto', icon: <Camera size={18} /> },
    { title: 'Curso', icon: <Calendar size={18} /> },
    { title: 'Revisão', icon: <CheckCircle2 size={18} /> }
  ];

  if (step === 6) {
    return (
      <div className="max-w-xl mx-auto py-20 px-4 text-center">
        <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <div className="w-32 h-32 bg-sesi-green text-white rounded-[40px] flex items-center justify-center mx-auto mb-10 shadow-2xl shadow-green-200">
            <CheckCircle2 size={64} />
          </div>
          <h1 className="text-4xl md:text-5xl font-black mb-6 uppercase tracking-tight text-slate-800">Inscrição Realizada!</h1>
          <p className="text-slate-500 mb-12 text-xl leading-relaxed font-medium">
            Parabéns! Sua pré-inscrição foi recebida com sucesso. <br/>Agora você precisa enviar seus documentos para validar sua vaga.
          </p>
          <div className="bg-white p-8 rounded-[32px] mb-12 text-left border-2 border-blue-50 shadow-sm relative overflow-hidden">
            <div className="absolute right-0 top-0 w-2 h-full bg-sesi-blue"></div>
            <h4 className="font-black text-slate-400 text-xs uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <ShieldCheck size={16} />
              Acesso à Área do Aluno
            </h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                <span className="text-sm font-bold text-slate-400">CPF (Login):</span>
                <span className="text-lg font-black text-slate-800">{watch('cpf')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-slate-400">Senha Padrão:</span>
                <span className="text-lg font-black text-slate-800 italic">Sua data de nascimento</span>
              </div>
            </div>
          </div>
          <button onClick={() => navigate('/dashboard')} className="btn-sesi-primary w-full py-6 text-2xl shadow-2xl shadow-blue-200">
            ENVIAR DOCUMENTOS AGORA
            <ArrowRight size={24} />
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="bg-sesi-gray py-12 px-4 min-h-screen">
      <div className="max-w-2xl mx-auto">
        {/* Progress Bar */}
        <div className="flex items-center justify-between mb-12 overflow-x-auto no-scrollbar pb-2">
          {stepsDescriptions.map((s, i) => (
            <div key={i} className="flex flex-col items-center flex-1 min-w-[70px]">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-colors ${step > i + 1 ? 'bg-green-500 text-white' : step === i + 1 ? 'bg-sesi-blue text-white shadow-lg' : 'bg-slate-200 text-slate-400'}`}>
                {step > i + 1 ? <CheckCircle2 size={20} /> : s.icon}
              </div>
              <span className={`text-[9px] uppercase font-black tracking-widest text-center ${step === i + 1 ? 'text-sesi-blue' : 'text-slate-400'}`}>{s.title}</span>
            </div>
          ))}
        </div>

        <motion.div 
          key={step} 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="card-sesi p-8 md:p-12 relative overflow-hidden"
        >
          {errorMessage && (
            <div className="mb-8 p-4 bg-red-50 text-red-600 rounded-xl flex items-center gap-3 font-medium border border-red-100">
              <AlertCircle size={20} />
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)}>
            {step === 1 && (
              <div className="space-y-6">
                <h2 className="text-2xl font-black mb-2 flex items-center gap-2">
                  <User className="text-sesi-blue" size={24} />
                  Dados do Candidato
                </h2>
                <p className="text-slate-500 mb-8">Conte-nos um pouco sobre você para começar.</p>

                <div className="space-y-4">
                  <div>
                    <label className="label-sesi">Nome Completo</label>
                    <input {...register('name')} className="input-sesi" placeholder="Seu nome completo" />
                    {errors.name && <span className="text-red-500 text-xs mt-1 font-bold">{errors.name.message}</span>}
                  </div>

                  {settings?.formFields.socialName.enabled && (
                    <div>
                      <label className="label-sesi">Nome Social (Opcional)</label>
                      <input {...register('socialName')} className="input-sesi" placeholder="Como você prefere ser chamado" />
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="label-sesi">CPF</label>
                      <input {...register('cpf')} className="input-sesi" placeholder="000.000.000-00" />
                      {errors.cpf && <span className="text-red-500 text-xs mt-1 font-bold">{errors.cpf.message}</span>}
                    </div>
                    <div>
                      <label className="label-sesi">Data de Nascimento</label>
                      <input 
                        type="text"
                        placeholder="DD/MM/AAAA"
                        className="input-sesi"
                        maxLength={10}
                        {...register('birthDate', {
                          onChange: (e) => {
                            let val = e.target.value.replace(/\D/g, '');
                            if (val.length > 2) val = val.slice(0, 2) + '/' + val.slice(2);
                            if (val.length > 5) val = val.slice(0, 5) + '/' + val.slice(5, 9);
                            e.target.value = val;
                          }
                        })}
                      />
                      {errors.birthDate && <span className="text-red-500 text-xs mt-1 font-bold">{errors.birthDate.message}</span>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {settings?.formFields.gender.enabled && (
                      <div>
                        <label className="label-sesi">Gênero</label>
                        <select {...register('gender')} className="input-sesi">
                          <option value="">Selecione...</option>
                          <option value="Masculino">Masculino</option>
                          <option value="Feminino">Feminino</option>
                          <option value="Outro">Outro</option>
                          <option value="Prefiro não dizer">Prefiro não dizer</option>
                        </select>
                      </div>
                    )}
                    {settings?.formFields.civilStatus.enabled && (
                      <div>
                        <label className="label-sesi">Estado Civil</label>
                        <select {...register('civilStatus')} className="input-sesi">
                          <option value="">Selecione...</option>
                          <option value="Solteiro(a)">Solteiro(a)</option>
                          <option value="Casado(a)">Casado(a)</option>
                          <option value="Divorciado(a)">Divorciado(a)</option>
                          <option value="Viúvo(a)">Viúvo(a)</option>
                        </select>
                      </div>
                    )}
                    {settings?.formFields.race.enabled && (
                      <div>
                        <label className="label-sesi">Raça/Etnia</label>
                        <select {...register('race')} className="input-sesi">
                          <option value="">Selecione...</option>
                          <option value="Branca">Branca</option>
                          <option value="Preta">Preta</option>
                          <option value="Parda">Parda</option>
                          <option value="Amarela">Amarela</option>
                          <option value="Indígena">Indígena</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-6">
                  <button type="button" onClick={nextStep} className="btn-sesi-primary w-full py-4 text-lg">
                    Próximo Passo
                    <ArrowRight size={20} />
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <h2 className="text-2xl font-black mb-2 flex items-center gap-2">
                  <Heart className="text-sesi-blue" size={24} />
                  Filiação e Responsáveis
                </h2>
                <p className="text-slate-500 mb-8">Preencha os dados dos seus pais ou responsáveis.</p>

                <div className="space-y-4">
                  {settings?.formFields.fatherName.enabled && (
                    <div>
                      <label className="label-sesi">Nome do Pai {settings.formFields.fatherName.required && '*'}</label>
                      <input {...register('fatherName')} className="input-sesi" placeholder="Nome completo do pai" />
                    </div>
                  )}
                  {settings?.formFields.motherName.enabled && (
                    <div>
                      <label className="label-sesi">Nome da Mãe {settings.formFields.motherName.required && '*'}</label>
                      <input {...register('motherName')} className="input-sesi" placeholder="Nome completo da mãe" />
                    </div>
                  )}
                  {settings?.formFields.guardianName.enabled && (
                    <div>
                      <label className="label-sesi">Responsável Legal (Caso seja menor) {settings.formFields.guardianName.required && '*'}</label>
                      <input {...register('guardianName')} className="input-sesi" placeholder="Nome completo do responsável" />
                    </div>
                  )}

                  {settings?.formFields.isPcd.enabled && (
                    <div className="space-y-4 pt-4 border-t border-slate-50">
                       <div className="flex items-center gap-3">
                          <input type="checkbox" {...register('isPcd')} className="w-5 h-5 accent-sesi-blue" />
                          <label className="text-sm font-bold text-slate-700">Sou Pessoa com Deficiência (PCD)</label>
                       </div>
                       {watch('isPcd') && (
                         <input {...register('pcdType')} className="input-sesi" placeholder="Qual a deficiência?" />
                       )}
                    </div>
                  )}

                  {settings?.formFields.lastSchool.enabled && (
                    <div className="pt-4 border-t border-slate-50">
                      <label className="label-sesi">Última Escola Frequentada</label>
                      <input {...register('lastSchool')} className="input-sesi" placeholder="Nome da instituição" />
                    </div>
                  )}
                </div>

                <div className="flex gap-4 pt-6">
                  <button type="button" onClick={prevStep} className="btn-sesi-secondary w-1/3 text-xs">
                    <ArrowLeft size={16} /> Voltar
                  </button>
                  <button type="button" onClick={nextStep} className="btn-sesi-primary w-2/3">
                    Próximo Passo <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <h2 className="text-2xl font-black mb-2 flex items-center gap-2">
                  <Camera className="text-sesi-blue" size={24} />
                  Sua Foto
                </h2>
                <p className="text-slate-500 mb-8">Tire uma foto sua para identificação no sistema.</p>

                <div className="flex flex-col items-center gap-6">
                  {photo ? (
                    <div className="relative group">
                      <img src={photo} alt="Preview" className="w-64 h-64 rounded-[40px] object-cover border-4 border-sesi-blue shadow-2xl" />
                      <button 
                        type="button"
                        onClick={() => setPhoto(null)}
                        className="absolute -top-3 -right-3 bg-red-500 text-white p-2 rounded-full shadow-lg"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  ) : isCameraOpen ? (
                    <div className="relative w-full aspect-square md:aspect-video rounded-[32px] overflow-hidden bg-black shadow-2xl">
                      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                      <button 
                        type="button"
                        onClick={takePhoto}
                        className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white text-sesi-blue p-6 rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all"
                      >
                        <Camera size={32} />
                      </button>
                    </div>
                  ) : (
                    <div className="w-full space-y-4">
                       <button 
                         type="button"
                         onClick={startCamera}
                         className="w-full py-12 border-4 border-dashed border-slate-100 rounded-[40px] flex flex-col items-center justify-center gap-4 hover:border-sesi-blue hover:bg-blue-50 transition-all group"
                       >
                         <Camera size={48} className="text-slate-200 group-hover:text-sesi-blue" />
                         <span className="font-black text-slate-400 group-hover:text-sesi-blue">Abrir Câmera do Celular</span>
                       </button>
                       
                       <div className="relative text-center">
                          <span className="bg-white px-4 text-xs font-bold text-slate-300 relative z-10 uppercase tracking-widest">ou se preferir</span>
                          <div className="absolute top-1/2 w-full h-px bg-slate-100 -z-0"></div>
                       </div>

                       <label className="w-full py-6 border-2 border-slate-100 rounded-2xl flex items-center justify-center gap-3 cursor-pointer hover:bg-slate-50 transition-all">
                          <Upload size={20} className="text-slate-400" />
                          <span className="font-bold text-slate-500">Enviar Foto da Galeria</span>
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => setPhoto(reader.result as string);
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                       </label>
                    </div>
                  )}

                  <canvas ref={canvasRef} className="hidden" />
                </div>

                <div className="flex gap-4 pt-6">
                  <button type="button" onClick={prevStep} className="btn-sesi-secondary w-1/3 text-xs">
                    <ArrowLeft size={16} /> Voltar
                  </button>
                  <button type="button" onClick={nextStep} className="btn-sesi-primary w-2/3">
                    Próximo Passo <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-6">
                <h2 className="text-2xl font-black mb-2 flex items-center gap-2">
                  <Mail className="text-sesi-blue" size={24} />
                  Curso e Contato
                </h2>
                <p className="text-slate-500 mb-8">Escolha seu curso e como podemos falar com você.</p>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {settings?.formFields.email.enabled && (
                      <div>
                        <label className="label-sesi">Seu E-mail {settings.formFields.email.required && '*'}</label>
                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                          <input {...register('email')} className="input-sesi pl-12" placeholder="exemplo@email.com" />
                        </div>
                      </div>
                    )}
                    {settings?.formFields.phone.enabled && (
                      <div>
                        <label className="label-sesi">Telefone / WhatsApp {settings.formFields.phone.required && '*'}</label>
                        <div className="relative">
                          <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                          <input {...register('phone')} className="input-sesi pl-12" placeholder="(00) 00000-0000" />
                        </div>
                      </div>
                    )}
                  </div>

                  {settings?.formFields.address.enabled && (
                    <div>
                      <label className="label-sesi">Endereço Completo {settings.formFields.address.required && '*'}</label>
                      <div className="relative">
                        <MapPin className="absolute left-4 top-4 text-slate-400" size={18} />
                        <textarea {...register('address')} className="input-sesi pl-12 min-h-[100px] pt-3" placeholder="Rua, Número, Bairro, Cidade - Estado"></textarea>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="label-sesi">Selecione o Curso Desejado</label>
                    <div className="relative">
                      <select {...register('courseId')} className="input-sesi appearance-none bg-white">
                        <option value="">Selecione uma opção...</option>
                        {courses.map(c => (
                          <option key={c.id} value={c.id} disabled={c.vacancies <= 0}>
                            {c.name} {c.vacancies <= 0 ? '(Sem vagas)' : `(${c.vacancies} vagas disponíveis)`}
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                         <ArrowRight size={18} className="text-slate-400 rotate-90" />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100">
                    <input type="checkbox" {...register('isLegacyStudent')} className="w-6 h-6 accent-sesi-blue cursor-pointer" />
                    <label className="text-sm font-bold text-sesi-blue cursor-pointer">Já estudei no SESI anteriormente</label>
                  </div>
                </div>

                <div className="flex gap-4 pt-6">
                  <button type="button" onClick={prevStep} className="btn-sesi-secondary w-1/3 text-xs">
                    <ArrowLeft size={16} /> Voltar
                  </button>
                  <button type="button" onClick={nextStep} className="btn-sesi-primary w-2/3">
                    Revisar Inscrição <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-6">
                <h2 className="text-2xl font-black mb-2 flex items-center gap-2">
                  <CheckCircle2 className="text-sesi-blue" size={24} />
                  Revisão Final
                </h2>
                <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100 flex gap-6 items-start">
                  {photo && <img src={photo} alt="Perfil" className="w-20 h-20 rounded-2xl object-cover border-2 border-white shadow-md" />}
                  <div className="space-y-4 flex-1">
                    <div>
                      <h5 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Candidato</h5>
                      <p className="font-bold">{watch('name')}</p>
                      {watch('socialName') && <p className="text-xs text-slate-500 italic">"{watch('socialName')}"</p>}
                      <p className="text-sm text-slate-500">
                        {watch('cpf')} | Nascido em {`${birthDay}/${birthMonth}/${birthYear}`}
                      </p>
                    </div>
                    {(watch('fatherName') || watch('motherName') || watch('guardianName')) && (
                      <div>
                        <h5 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Família</h5>
                        {watch('fatherName') && <p className="text-xs text-slate-600">Pai: {watch('fatherName')}</p>}
                        {watch('motherName') && <p className="text-xs text-slate-600">Mãe: {watch('motherName')}</p>}
                        {watch('guardianName') && <p className="text-xs text-slate-600 font-bold">Responsável: {watch('guardianName')}</p>}
                      </div>
                    )}
                    <div>
                      <h5 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Curso</h5>
                      <p className="font-bold text-sesi-blue">
                        {courses.find(c => c.id === watch('courseId'))?.name || 'Não selecionado'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-orange-50 rounded-xl border border-orange-100">
                  <p className="text-sm text-orange-700 leading-relaxed font-medium">
                    Ao confirmar, você declara que os dados são verdadeiros e está ciente que sua senha inicial será sua <strong>data de nascimento</strong>.
                  </p>
                </div>

                <div className="flex gap-4 pt-6">
                  <button type="button" onClick={prevStep} className="btn-sesi-secondary w-1/3 text-xs">
                    <ArrowLeft size={16} /> Voltar
                  </button>
                  <button type="submit" disabled={loading} className="btn-sesi-primary w-2/3 py-4 text-lg">
                    {loading ? (
                      <>
                        <Loader2 className="animate-spin" size={18} />
                        Processando...
                      </>
                    ) : (
                      'Confirmar e Finalizar'
                    )}
                  </button>
                </div>
              </div>
            )}
          </form>
        </motion.div>
      </div>
    </div>
  );
}
