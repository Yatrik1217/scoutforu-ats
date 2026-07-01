"use server";

import { parseResume, type ParsedResume } from "./parse-resume";
import {
  createCandidate,
  findDuplicateCandidate,
  type CandidateForm,
} from "./mutations";

export type BulkResult = {
  status: "created" | "duplicate" | "error";
  name: string;
  message: string;
};

function toForm(d: ParsedResume, resumeUrl = ""): CandidateForm {
  return {
    name: d.name,
    email: d.email,
    phone: d.phone,
    jobId: null,
    recruiterId: null,
    stage: "sourced",
    source: "Career Site",
    location: d.location,
    expYears: d.expYears,
    rating: 0,
    currentCtc: d.currentCtc,
    expectedCtc: d.expectedCtc,
    noticePeriod: d.noticePeriod,
    tags: d.skills,
    gender: d.gender,
    currentDesignation: d.currentDesignation,
    currentCompany: d.currentCompany,
    graduation: d.graduation,
    postGraduation: d.postGraduation,
    birthDate: d.birthDate,
    maritalStatus: d.maritalStatus,
    altEmail: d.altEmail,
    altPhone: d.altPhone,
    function: d.function,
    industry: d.industry,
    resumeUrl,
  };
}

// Parses one resume, skips it if a candidate with the same email/phone already
// exists, otherwise creates the candidate in the Sourced stage.
export async function bulkProcessResume(
  formData: FormData,
): Promise<BulkResult> {
  const res = await parseResume(formData);
  if (!res.ok || !res.data)
    return { status: "error", name: "", message: res.error ?? "Parse failed" };

  const d = res.data;
  if (!d.name.trim())
    return { status: "error", name: "", message: "No name found in resume" };

  const dup = await findDuplicateCandidate(d.email, d.phone);
  if (dup)
    return {
      status: "duplicate",
      name: d.name,
      message: `Already in database as ${dup.name} (by ${dup.via})`,
    };

  const created = await createCandidate(toForm(d, res.resumeUrl));
  if (!created.ok)
    return { status: "error", name: d.name, message: created.error ?? "Create failed" };

  return { status: "created", name: d.name, message: "Added to Sourced" };
}
