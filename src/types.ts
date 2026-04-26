export enum CandidateStatus {
  PENDING = 'Pendente',
  APPROVED = 'Aprovado',
  REJECTED = 'Rejeitado',
  ACTION_REQUIRED = 'Ação Necessária'
}

export enum RequestStatus {
  PENDING = 'Pendente',
  RESOLVED = 'Resolvido',
  REJECTED = 'Indeferido'
}

export interface ServiceRequest {
  id: string;
  candidateId: string;
  candidateName: string;
  candidatePhone?: string;
  type: string;
  description: string;
  status: RequestStatus;
  response?: string;
  createdAt: any;
  updatedAt: any;
}

export interface AdminUser {
  uid: string;
  email: string;
  role: 'admin' | 'master';
  createdAt: any;
}

export enum DocumentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  VALID = 'valid',
  INVALID = 'invalid',
  UNREADABLE = 'unreadable'
}

export enum DocumentType {
  RG = 'RG',
  CPF = 'CPF',
  CNH = 'CNH',
  ADDRESS_PROOF = 'ADDRESS_PROOF',
  SCHOOL_RECORD = 'SCHOOL_RECORD'
}

export interface Course {
  id: string;
  name: string;
  vacancies: number;
  total: number;
  description?: string;
  workload?: string;
  shift?: string;
  modality?: string;
  createdAt?: string;
}

export interface Candidate {
  uid: string;
  name: string;
  socialName?: string;
  fatherName?: string;
  motherName?: string;
  guardianName?: string;
  photoUrl?: string;
  cpf: string;
  birthDate: string;
  gender?: string;
  civilStatus?: string;
  race?: string;
  isPcd?: boolean;
  pcdType?: string;
  lastSchool?: string;
  email: string;
  phone: string;
  address?: string;
  status: CandidateStatus;
  selectedCourseId?: string;
  isLegacyStudent?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FormFieldConfig {
  enabled: boolean;
  required: boolean;
  label: string;
}

export interface SystemSettings {
  formFields: {
    socialName: FormFieldConfig;
    fatherName: FormFieldConfig;
    motherName: FormFieldConfig;
    guardianName: FormFieldConfig;
    address: FormFieldConfig;
    phone: FormFieldConfig;
    email: FormFieldConfig;
    photo: FormFieldConfig;
    gender: FormFieldConfig;
    civilStatus: FormFieldConfig;
    race: FormFieldConfig;
    isPcd: FormFieldConfig;
    lastSchool: FormFieldConfig;
  };
  mandatoryDocuments: {
    [key: string]: boolean;
  };
  useAIValidation: boolean;
}

export interface DocumentEntry {
  id: string;
  candidateId: string;
  type: DocumentType;
  storageUrl: string;
  storagePath?: string;
  status: DocumentStatus;
  ocrValidation?: any;
  feedback?: string;
  createdAt: string;
}
