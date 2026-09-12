export const messages: Record<string,string> = {
  UNAVAILABLE:'Enrollment is being prepared. Please come back soon.',
  CAMPAIGN_PAUSED:'New reservations are paused. Your existing account and credits remain available.',
  CAMPAIGN_CLOSED:'This offer has closed. Please check the latest campaign terms.',
  HANDLE_INVALID:'Use 3–20 letters, numbers, or underscores. This name may be reserved.',
  HANDLE_UNAVAILABLE:'That handle is held or reserved. Please choose another.',
  HOLD_EXPIRED:'Your handle hold expired. You are still signed in; choose an available handle to finish.',
  PENDING_IDENTITY_MISMATCH:'This email does not match the pending reservation. Sign in with the email you used to start.',
  PENDING_EMAIL_MISMATCH:'Use the same email to finish this reservation, or start again in a new browser session.',
  SIGN_IN_REQUIRED:'An account already exists for this email. Use Sign in to return to it.',
  ALREADY_COMPLETED:'Your account is already complete. Open My account.',
  TERMS_CHANGED:'The offer terms changed. Refresh and review the current terms before continuing.',
  RATE_LIMITED:'Please wait before trying again. Verification emails can be requested once per minute.',
  INVALID_CODE:'That code is incorrect or expired. Check your latest email, or request a new code.',
  EMAIL_UNAVAILABLE:'The email provider could not accept your request. Your handle is held; try sending the code again.',
  UNAUTHENTICATED:'Sign in to continue.', ACCOUNT_REQUIRED:'Finish reserving your handle to continue.',
  FORBIDDEN:'You do not have access to this page or action.',
  REAUTH_REQUIRED:'Please sign in again to confirm this administrative change.',
  INVALID_INPUT:'Check the form and try again.', INVALID_ORIGIN:'This request must come from the NEYLO application.',
  IDENTITY_MISMATCH:'Use the verified email associated with this account.',
  IDENTITY_REQUIRED:'Email verification is required.', VERIFIED_IDENTITY_REQUIRED:'Verify your email before completing your account.',
  INVALID_IDEMPOTENCY_KEY:'Refresh the page and retry.', IDEMPOTENCY_CONFLICT:'This request key was already used for another operation.',
  SELF_REFERRAL:'You cannot refer your own account.', NOT_FOUND:'This invitation or page could not be found.',
  INTERNAL:'The request could not be completed. Retry safely; your account will not receive duplicate credits.',
};
export class AppError extends Error {
  constructor(public code:string,public status=400){super(messages[code]??messages.INTERNAL);}
}
export function databaseError(message:string,code?:string):never {
  if(code==='42501') throw new AppError('FORBIDDEN',403);
  if(code==='23505') throw new AppError('HANDLE_UNAVAILABLE',409);
  if(Object.hasOwn(messages,message)) throw new AppError(message, message==='FORBIDDEN'?403:409);
  throw new AppError('INTERNAL',500);
}
