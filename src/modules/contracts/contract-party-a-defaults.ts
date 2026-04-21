export const DEFAULT_CONTRACT_PARTY_A = {
  landlordName: 'Hoang Kim Long',
  landlordIdNumber: '060204000351',
  landlordIdIssueDate: '19/04/2021',
  landlordAddress: 'Chung cu Vinhomes Grand Park, phuong Long Binh, TP Thu Duc',
  landlordPhone: '0388969964',
} as const;

export type ContractPartyAFields = {
  landlordName?: string | null;
  landlordIdNumber?: string | null;
  landlordIdIssueDate?: string | null;
  landlordAddress?: string | null;
  landlordPhone?: string | null;
};

export type ResolvedContractPartyAFields = {
  landlordName: string;
  landlordIdNumber: string;
  landlordIdIssueDate: string;
  landlordAddress: string;
  landlordPhone: string;
};

const isBlank = (value: string | null | undefined): boolean =>
  typeof value !== 'string' || value.trim().length === 0;

export const resolveContractPartyAFields = (
  fields?: ContractPartyAFields,
): ResolvedContractPartyAFields => ({
  landlordName: isBlank(fields?.landlordName)
    ? DEFAULT_CONTRACT_PARTY_A.landlordName
    : fields!.landlordName!.trim(),
  landlordIdNumber: isBlank(fields?.landlordIdNumber)
    ? DEFAULT_CONTRACT_PARTY_A.landlordIdNumber
    : fields!.landlordIdNumber!.trim(),
  landlordIdIssueDate: isBlank(fields?.landlordIdIssueDate)
    ? DEFAULT_CONTRACT_PARTY_A.landlordIdIssueDate
    : fields!.landlordIdIssueDate!.trim(),
  landlordAddress: isBlank(fields?.landlordAddress)
    ? DEFAULT_CONTRACT_PARTY_A.landlordAddress
    : fields!.landlordAddress!.trim(),
  landlordPhone: isBlank(fields?.landlordPhone)
    ? DEFAULT_CONTRACT_PARTY_A.landlordPhone
    : fields!.landlordPhone!.trim(),
});

export const isMissingContractPartyAField = (
  value: string | null | undefined,
): boolean => isBlank(value);
