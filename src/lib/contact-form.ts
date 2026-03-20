export const eventInquiryValues = new Set(["Schedule Event"]);

export const shouldShowEventFields = (inquiryType: string): boolean => {
  return eventInquiryValues.has(inquiryType.trim());
};

export const isInquirySelectionValid = (selectionValue: string): boolean => {
  return selectionValue.trim().length > 0;
};
