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
  custom: CustomValues;
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
  is_approver: boolean;
  incentive_percent: number | null;
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
  branch_id: string | null;
  custom: CustomValues;
  approval_status: ApprovalStatus;
  published: boolean;
  published_at: string | null;
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
  custom: CustomValues;
  review_status: ReviewStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  entered_stage_at: string;
  created_at: string;
};

export type ReviewStatus = "none" | "pending" | "approved" | "rejected";

export type DisqualifyReasonRow = {
  id: string;
  label: string;
  active: boolean;
  sort: number;
  created_at: string;
};

export type OrganizationRow = {
  id: boolean;
  name: string;
  tagline: string;
  logo_url: string;
  address: string;
  city: string;
  gst: string;
  phone: string;
  email: string;
  website: string;
  updated_at: string;
};

export type BranchRow = {
  id: string;
  name: string;
  city: string;
  address: string;
  active: boolean;
  sort: number;
  created_at: string;
};

export type EmailTemplateRow = {
  id: string;
  template_key: string;
  name: string;
  subject: string;
  body: string;
  updated_at: string;
};

export type InvoiceSettingsRow = {
  id: boolean;
  prefix: string;
  next_number: number;
  gst_percent: number;
  pan: string;
  gstin: string;
  bank_details: string;
  terms: string;
  updated_at: string;
};

export type ApprovalStatus = "pending" | "approved" | "rejected";

export type CustomFieldModule = "candidate" | "job" | "client";
export type CustomFieldType = "text" | "number" | "select";
export type CustomFieldRow = {
  id: string;
  module: CustomFieldModule;
  label: string;
  field_key: string;
  type: CustomFieldType;
  options: string[];
  sort: number;
  active: boolean;
  created_at: string;
};
export type CustomValues = Record<string, string | number | null>;

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

export type InvoiceStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "partial"
  | "paid"
  | "void"
  | "written_off";
export type InvoiceTaxMode = "cgst_sgst" | "igst" | "none";
export type PaymentMethod =
  | "bank_transfer"
  | "upi"
  | "cheque"
  | "cash"
  | "card"
  | "other";
export type RecurringFrequency =
  | "weekly"
  | "monthly"
  | "quarterly"
  | "half_yearly"
  | "yearly";

export type InvoiceRow = {
  id: string;
  invoice_no: string;
  client_id: string | null;
  bill_to_name: string;
  bill_to_email: string;
  bill_to_address: string;
  bill_to_gstin: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string | null;
  payment_terms_days: number;
  tax_mode: InvoiceTaxMode;
  gst_percent: number;
  discount_percent: number;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  amount_paid: number;
  notes: string;
  terms: string;
  public_token: string;
  recurring_id: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  paid_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type InvoiceItemRow = {
  id: string;
  invoice_id: string;
  description: string;
  details: string;
  qty: number;
  rate: number;
  amount: number;
  sort: number;
};

export type InvoicePaymentRow = {
  id: string;
  invoice_id: string;
  amount: number;
  paid_on: string;
  method: PaymentMethod;
  reference: string;
  notes: string;
  created_by: string | null;
  created_at: string;
};

export type InvoiceRecurringRow = {
  id: string;
  name: string;
  client_id: string | null;
  frequency: RecurringFrequency;
  next_date: string;
  end_date: string | null;
  active: boolean;
  items: { description: string; details: string; qty: number; rate: number }[];
  tax_mode: InvoiceTaxMode;
  gst_percent: number;
  discount_percent: number;
  payment_terms_days: number;
  notes: string;
  terms: string;
  last_generated_at: string | null;
  created_at: string;
};

export type InvoiceEventRow = {
  id: string;
  invoice_id: string;
  kind: string;
  body: string;
  by_user_id: string | null;
  created_at: string;
};

export type PlacementStatus =
  | "pending"
  | "invoiced"
  | "partial"
  | "paid"
  | "replaced"
  | "cancelled"
  | "written_off";
export type PlacementFeeMode = "percent" | "flat";
export type PlacementTdsBase = "fee" | "total";

export type PlacementRow = {
  id: string;
  candidate_id: string | null;
  candidate_name: string;
  position: string;
  client_id: string | null;
  client_name: string;
  job_id: string | null;
  recruiter_id: string | null;
  joining_date: string;
  fee_mode: PlacementFeeMode;
  annual_ctc: number;
  fee_percent: number;
  fee_amount: number;
  gst_applicable: boolean;
  gst_percent: number;
  gst_amount: number;
  total_fee: number;
  tds_applicable: boolean;
  tds_percent: number;
  tds_on: PlacementTdsBase;
  tds_amount: number;
  net_payable: number;
  credit_days: number;
  due_date: string | null;
  replacement_days: number;
  replacement_until: string | null;
  status: PlacementStatus;
  amount_received: number;
  invoice_id: string | null;
  notes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PlacementPaymentRow = {
  id: string;
  placement_id: string;
  amount: number;
  paid_on: string;
  method: PaymentMethod;
  reference: string;
  notes: string;
  created_by: string | null;
  created_at: string;
};

export type PlacementEventRow = {
  id: string;
  placement_id: string;
  kind: string;
  body: string;
  by_user_id: string | null;
  created_at: string;
};

export type IncentiveBasis = "booked" | "collected";
export type IncentiveMode = "flat" | "slab" | "closure";
export type IncentiveSlab = { upto: number | null; percent: number };

// Closure-count tiers (per recruiter, per financial-year period).
export type QuarterTier = {
  from: number;
  to: number | null; // null = and above
  per_closure: number;
  bonus: number; // milestone bonus within this band
  bonus_at: number | null; // closures needed to unlock the bonus
};
export type BonusTier = {
  from: number;
  to: number | null;
  bonus: number;
  reward?: string; // non-cash reward, e.g. "Domestic trip for 2"
};

export type IncentiveSettingsRow = {
  id: boolean;
  basis: IncentiveBasis;
  mode: IncentiveMode;
  flat_percent: number;
  slabs: IncentiveSlab[];
  quarterly_tiers: QuarterTier[];
  halfyearly_tiers: BonusTier[];
  annual_tiers: BonusTier[];
  min_tenure_days: number;
  require_collected: boolean;
  quarterly_min_target: number;
  halfyearly_requires_both: boolean;
  updated_at: string;
};

// ---- employee portal (HR & payroll) ----
export type EmploymentStatus = "active" | "exited";
// Employees allow part-time, which the jobs enum doesn't.
export type EmployeeEmploymentType = "full_time" | "part_time" | "intern" | "contract";
export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";
export type PayrollStatus = "draft" | "finalised" | "paid";
export type AttendanceStatus =
  | "present"
  | "absent"
  | "half_day"
  | "leave"
  | "week_off"
  | "holiday";

// A break still in progress has end === null.
export type AttendanceBreak = { start: string; end: string | null };

export type AttendanceRow = {
  id: string;
  employee_id: string;
  on_date: string;
  status: AttendanceStatus;
  check_in_at: string | null;
  check_out_at: string | null;
  breaks: AttendanceBreak[];
  note: string;
  marked_by: string | null;
  created_at: string;
};
export type PayLine = { label: string; amount: number };

export type EmployeeRow = {
  id: string;
  profile_id: string | null;
  employee_code: string;
  name: string;
  email: string;
  phone: string;
  designation: string;
  department: string;
  employment_type: EmployeeEmploymentType;
  joined_on: string | null;
  exit_on: string | null;
  status: EmploymentStatus;
  probation_months: number;
  monthly_gross: number;
  components: Record<string, number>;
  pan: string;
  bank_account: string;
  bank_ifsc: string;
  uan: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type LeaveTypeRow = {
  id: string;
  name: string;
  code: string;
  annual_quota: number;
  paid: boolean;
  active: boolean;
  sort: number;
};

export type LeaveRequestRow = {
  id: string;
  employee_id: string;
  leave_type_id: string;
  from_date: string;
  to_date: string;
  days: number;
  half_day: boolean;
  reason: string;
  status: LeaveStatus;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string;
  created_at: string;
};

export type PayrollRunRow = {
  id: string;
  period_month: string;
  status: PayrollStatus;
  notes: string;
  created_by: string | null;
  finalised_at: string | null;
  paid_at: string | null;
  created_at: string;
};

export type PayrollLineRow = {
  id: string;
  run_id: string;
  employee_id: string;
  monthly_gross: number;
  total_days: number;
  lop_days: number;
  earned_gross: number;
  incentive: number;
  additions: PayLine[];
  deductions: PayLine[];
  net_pay: number;
  notes: string;
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
      organization: Table<OrganizationRow>;
      branches: Table<BranchRow>;
      custom_fields: Table<CustomFieldRow>;
      email_templates: Table<EmailTemplateRow>;
      invoice_settings: Table<InvoiceSettingsRow>;
      invoices: Table<InvoiceRow>;
      invoice_items: Table<InvoiceItemRow>;
      invoice_payments: Table<InvoicePaymentRow>;
      invoice_recurring: Table<InvoiceRecurringRow>;
      invoice_events: Table<InvoiceEventRow>;
      placements: Table<PlacementRow>;
      placement_payments: Table<PlacementPaymentRow>;
      placement_events: Table<PlacementEventRow>;
      incentive_settings: Table<IncentiveSettingsRow>;
      employees: Table<EmployeeRow>;
      leave_types: Table<LeaveTypeRow>;
      leave_requests: Table<LeaveRequestRow>;
      payroll_runs: Table<PayrollRunRow>;
      payroll_lines: Table<PayrollLineRow>;
      attendance: Table<AttendanceRow>;
      app_settings: Table<AppSettingsRow>;
    };
    Views: Record<string, never>;
    Functions: {
      auth_role: { Args: Record<string, never>; Returns: UserRole };
      auth_client_id: { Args: Record<string, never>; Returns: string };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      is_staff: { Args: Record<string, never>; Returns: boolean };
      next_invoice_number: { Args: Record<string, never>; Returns: string };
      my_employee_id: { Args: Record<string, never>; Returns: string };
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
