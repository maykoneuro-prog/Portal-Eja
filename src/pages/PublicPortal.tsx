import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { BookOpen, Clock, Users, Globe, ArrowRight } from 'lucide-react';

const COURSES = [
  {
    id: 'ensino-fundamental',
    name: 'Ensino Fundamental II',
    description: 'Para quem deseja concluir do 6º ao 9º ano.',
    workload: '800h',
    shift: 'Noturno / Flexível',
    modality: 'Semipresencial',
    vagas: 45
  },
  {
    id: 'ensino-medio',
    name: 'Ensino Médio',
    description: 'Conclua seus estudos do Ensino Médio com foco profissional.',
    workload: '1200h',
    shift: 'Noturno / Flexível',
    modality: 'EAD com encontros presenciais',
    vagas: 120
  }
];

export default function PublicPortal() {
  return (
    <div className="bg-sesi-gray">
      {/* Hero Section */}
      <section className="bg-sesi-blue-dark text-white py-24 px-6 relative overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[60%] bg-blue-600 rounded-full blur-[120px] opacity-20"></div>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-block px-4 py-1.5 bg-blue-500/20 rounded-full text-blue-200 text-[10px] font-black uppercase tracking-[0.2em] mb-6 border border-blue-500/30"
          >
            Inscrições Abertas 2026
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-7xl font-black mb-8 leading-[1.1]"
          >
            Sua chance de concluir os estudos.
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-xl md:text-2xl opacity-80 mb-12 max-w-2xl mx-auto font-medium"
          >
            Educação de Jovens e Adultos (EJA) do SESI. Flexível, dinâmico e focado no seu futuro profissional.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Link to="/inscricao" className="inline-flex items-center gap-3 bg-sesi-orange text-white px-12 py-6 rounded-[32px] font-black text-2xl shadow-2xl shadow-orange-500/20 hover:bg-orange-600 transition-all active:scale-95 group">
              INSCREVA-SE AGORA
              <ArrowRight size={28} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Courses Section */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-black text-slate-800 mb-4">Cursos Disponíveis</h2>
          <p className="text-slate-500 font-medium">Escolha a melhor opção para sua carreira</p>
        </div>
        <div className="grid md:grid-cols-2 gap-10">
          {COURSES.map((course, idx) => (
            <motion.div 
              key={course.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="card-sesi flex flex-col items-start p-10 hover:border-sesi-blue/30"
            >
              <div className="w-16 h-16 bg-blue-50 text-sesi-blue rounded-3xl flex items-center justify-center mb-8 border border-blue-100">
                <BookOpen size={32} />
              </div>
              <h3 className="text-3xl font-black mb-4">{course.name}</h3>
              <p className="text-slate-500 mb-8 leading-relaxed text-lg">{course.description}</p>
              
              <div className="grid grid-cols-2 gap-6 w-full mb-10">
                <div className="flex items-center gap-3 text-sm font-bold text-slate-500">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                    <Clock size={16} />
                  </div>
                  {course.workload}
                </div>
                <div className="flex items-center gap-3 text-sm font-bold text-slate-500">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                    <Globe size={16} />
                  </div>
                  {course.modality}
                </div>
                <div className="flex items-center gap-3 text-sm font-bold text-slate-500">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                    <Users size={16} />
                  </div>
                  {course.shift}
                </div>
                <div className="flex items-center gap-2 text-sm font-black text-sesi-orange bg-orange-50 px-4 py-2 rounded-full w-fit">
                  {course.vagas} VAGAS
                </div>
              </div>

              <Link 
                to={`/inscricao?course=${course.id}`}
                className="mt-auto w-full btn-sesi-primary py-5 text-xl"
              >
                Escolher este curso
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Why SESI Section */}
      <section className="bg-white py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-3 gap-12 text-center">
            <div>
              <div className="w-16 h-16 bg-orange-100 text-sesi-orange rounded-full flex items-center justify-center mx-auto mb-6">
                <Users size={32} />
              </div>
              <h4 className="font-black text-lg mb-2">Para Adultos</h4>
              <p className="text-slate-500 text-sm">Metodologia pensada para quem trabalha e tem pouco tempo.</p>
            </div>
            <div>
              <div className="w-16 h-16 bg-blue-100 text-sesi-blue rounded-full flex items-center justify-center mx-auto mb-6">
                <Globe size={32} />
              </div>
              <h4 className="font-black text-lg mb-2">Digital e Humano</h4>
              <p className="text-slate-500 text-sm">Estude de onde quiser com suporte de professores reais.</p>
            </div>
            <div>
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <ShieldCheck size={32} strokeWidth={2.5} />
              </div>
              <h4 className="font-black text-lg mb-2">Certificado SESI</h4>
              <p className="text-slate-500 text-sm">O peso de uma instituição reconhecida em todo o Brasil.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ShieldCheck({ size, strokeWidth, className }: any) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth={strokeWidth || 2} 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
