// Hand-written to match supabase/migrations. Regenerate later with:
//   supabase gen types typescript --linked > src/lib/database.types.ts
// NOTE: Row types are `type` aliases (not interfaces) so they satisfy
// supabase-js's `Record<string, unknown>` constraint — interfaces don't.

export type UserRole = "master_admin" | "recruiter" | "client";
export type JobStatus = "open" | "hot" | "closed";
export type EmploymentType = "full_time" | "contract" | "intern";
export type InterviewTypeEnum = "video" | "phone" | "onsite" | "practical";
export type OfferStatus = "pending" | "accepted";
export type CandidateStage =
  | "sourced"
  | "screening"
  | "interview"
  | "practical_interview"
  | "selected"
  | "offered"
  | "offer_accepted"
  | "joined"
  | "not_joined";

export type ClientRow = {
  id: string;
  name: string;
  status: string;
  contact_email: string | null;
  city: string;
  reference_code: string;
  rating: string;
  industry: string;
  contact_number: string;
  key_account_manager_id: string | null;
  transportation: boolean;
  canteen: boolean;
  website: string;
  linkedin_url: string;
  address: string;
  profile: string;
  remarks: string;
  created_at: string;
};

export type ProfileRow = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  color: string;
  client_id: string | null;
  active: boolean;
  api_token: string | null;
  created_at: string;
};

export type JobRow = {
  id: string;
  title: string;
  dept: string;
  location: string;
  type: EmploymentType;
  openings: number;
  status: JobStatus;
  client_id: string | null;
  recruiter_id: string | null;
  posted_at: string;
  applicants_count: number;
  description: string;
  min_ctc_lpa: number;
  max_ctc_lpa: number;
  designation: string;
  target_date: string | null;
  reference_code: string;
  interviewer_hr: string;
  interview_venue: string;
  remote_work: boolean;
  exp_min: number;
  exp_max: number;
  functional_area: string;
  industry: string;
  qualification: string;
  keywords: string;
  profile_criteria: string;
  benefits: string;
  hide_salary: boolean;
  walk_in: boolean;
  telephonic: boolean;
  created_at: string;
};

export type CandidateRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  job_id: string | null;
  stage: CandidateStage;
  rating: number;
  exp_years: number;
  location: string | null;
  source: string | null;
  recruiter_id: string | null;
  salary_lpa: number;
  current_ctc_lpa: number;
  expected_ctc_lpa: number;
  notice_period_days: number;
  tags: string[];
  gender: string;
  current_designation: string;
  current_company: string;
  graduation: string;
  post_graduation: string;
  birth_date: string | null;
  marital_status: string;
  alt_email: string;
  alt_phone: string;
  function: string;
  industry: string;
  resume_url: string;
  reject_reason: string;
  entered_stage_at: string;
  created_at: string;
};

export type DisqualifyReasonRow = {
  id: string;
  label: string;
  active: boolean;
  sort: number;
  created_at: string;
};

export type InterviewRow = {
  id: string;
  candidate_id: string;
  scheduled_at: string;
  type: InterviewTypeEnum;
  interviewer_id: string | null;
  created_by: string | null;
  created_at: string;
};

export type StageEventRow = {
  id: string;
  candidate_id: string;
  from_stage: CandidateStage | null;
  to_stage: CandidateStage;
  by_user_id: string | null;
  created_at: string;
};

export type OfferRow = {
  id: string;
  candidate_id: string;
  salary_lpa: number;
  sent_at: string;
  expires_at: string | null;
  status: OfferStatus;
};

export type FeedbackRecommendation =
  | "strong_yes"
  | "yes"
  | "maybe"
  | "no"
  | "strong_no";

export type InterviewFeedbackRow = {
  id: string;
  candidate_id: string;
  interviewer_id: string | null;
  rating: number;
  recommendation: FeedbackRecommendation;
  notes: string;
  created_at: string;
};

export type CandidateNoteRow = {
  id: string;
  candidate_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
};

export type AppSettingsRow = {
  id: boolean;
  email_notif: boolean;
  auto_reject: boolean;
  client_portal: boolean;
  two_factor: boolean;
};

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      clients: Table<ClientRow>;
      profiles: Table<ProfileRow>;
      jobs: Table<JobRow>;
      candidates: Table<CandidateRow>;
      interviews: Table<InterviewRow>;
      stage_events: Table<StageEventRow>;
      offers: Table<OfferRow>;
      candidate_notes: Table<CandidateNoteRow>;
      interview_feedback: Table<InterviewFeedbackRow>;
      disqualify_reasons: Table<DisqualifyReasonRow>;
      app_settings: Table<AppSettingsRow>;
    };
    Views: Record<string, never>;
    Functions: {
      auth_role: { Args: Record<string, never>; Returns: UserRole };
      auth_client_id: { Args: Record<string, never>; Returns: string };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      is_staff: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: {
      user_role: UserRole;
      job_status: JobStatus;
      employment_type: EmploymentType;
      interview_type: InterviewTypeEnum;
      offer_status: OfferStatus;
      candidate_stage: CandidateStage;
    };
    CompositeTypes: Record<string, never>;
  };
};
