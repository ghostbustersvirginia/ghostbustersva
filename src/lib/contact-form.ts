export const inquiryTypeOptions = [
  "General Inquiry",
  "Plan a Proton Pet Drive",
  "Joining Questions",
  "Media or Press",
  "Other",
] as const;

export const eventInquiryTypeAllowlist = ["Plan a Proton Pet Drive"] as const;

export const eventInquiryValues = new Set<string>(eventInquiryTypeAllowlist);

export const serializeEventInquiryAllowlist = (): string => {
  return JSON.stringify(eventInquiryTypeAllowlist);
};

export const shouldShowEventFields = (inquiryType: string): boolean => {
  return eventInquiryValues.has(inquiryType.trim());
};

export const isInquirySelectionValid = (selectionValue: string): boolean => {
  return selectionValue.trim().length > 0;
};
