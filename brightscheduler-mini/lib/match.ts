export const TIER_WINDOWS_SEC = { 1:600, 2:600, 3:900 } as const;
export async function rankCandidates(_vacancyId:string,_tier:number){
  return [{ staff_id:'stub-staff', name:'Stub Nurse', score:90 }];
}
